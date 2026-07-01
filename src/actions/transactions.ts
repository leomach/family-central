"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getMonthStart, splitAmount } from "@/lib/utils"
import type { TransactionType } from "@/types/database"
import { z } from "zod"

const TransactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  description: z.string().min(1).max(200),
  category_id: z.string().uuid().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  familyId: z.string().uuid(),
  participants: z.array(z.string().uuid()).optional(),
})

export async function createTransaction(input: z.infer<typeof TransactionSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const parsed = TransactionSchema.safeParse(input)
  if (!parsed.success) return { error: "Dados inválidos" }

  const { type, amount, description, category_id, date, familyId, participants } = parsed.data

  // Shared transaction
  if (participants && participants.length > 1) {
    return createSharedTransaction({ type, amount, description, category_id, date, familyId, participants, userId: user.id })
  }

  const { error } = await supabase.from("transactions").insert({
    family_id: familyId,
    user_id: user.id,
    type: type as TransactionType,
    amount,
    description,
    category_id: category_id ?? null,
    date,
  })

  if (error) return { error: error.message }

  if (type === "income") {
    await recalculateProportions(familyId, getMonthStart(date))
  }

  await invalidateSnapshots(user.id, date)
  revalidatePath("/financeiro")
  return { ok: true }
}

async function createSharedTransaction(data: {
  type: "income" | "expense"
  amount: number
  description: string
  category_id?: string | null
  date: string
  familyId: string
  participants: string[]
  userId: string
}) {
  const supabase = await createClient()
  const serviceClient = await createServiceClient()

  // Validate all participants belong to the same family
  const { data: members } = await supabase
    .from("family_members")
    .select("user_id")
    .eq("family_id", data.familyId)

  const memberIds = (members ?? []).map((m) => m.user_id)
  const invalidParticipants = data.participants.filter((p) => !memberIds.includes(p))
  if (invalidParticipants.length > 0) return { error: "Participante inválido" }

  // Get proportions for the month
  const month = getMonthStart(data.date)
  const { data: proportions } = await supabase
    .from("income_proportions")
    .select("*")
    .eq("family_id", data.familyId)
    .eq("month", month)
    .in("user_id", data.participants)

  // Divide proporcionalmente à renda (com fallback para divisão igual).
  // splitAmount trabalha em centavos, distribui o resto e garante mínimo de 1
  // centavo por participante — nenhuma parcela pode violar o CHECK (amount > 0).
  const proportionMap = new Map(
    (proportions ?? []).map((p) => [p.user_id, Number(p.proportion)])
  )
  const split = splitAmount(data.amount, data.participants, proportionMap)
  if ("error" in split) return { error: split.error }
  const amounts = split

  // Create transaction_group
  const { data: group, error: groupError } = await serviceClient
    .from("transaction_groups")
    .insert({ family_id: data.familyId, description: data.description, total_amount: data.amount, date: data.date })
    .select()
    .single()

  if (groupError) return { error: groupError.message }

  // Insert one transaction per participant
  const inserts = data.participants.map((uid) => ({
    family_id: data.familyId,
    user_id: uid,
    group_id: group.id,
    type: data.type as TransactionType,
    amount: amounts.get(uid)!,
    description: data.description,
    category_id: data.category_id ?? null,
    date: data.date,
  }))

  const { error: txError } = await serviceClient.from("transactions").insert(inserts)
  if (txError) return { error: txError.message }

  // Invalidate snapshots for all participants
  await Promise.all(data.participants.map((uid) => invalidateSnapshots(uid, data.date)))

  revalidatePath("/financeiro")
  revalidatePath("/financeiro/familia")
  return { ok: true }
}

export async function deleteTransaction(transactionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const { data: tx } = await supabase
    .from("transactions")
    .select("group_id, date, family_id, user_id")
    .eq("id", transactionId)
    .single()

  if (!tx) return { error: "Transação não encontrada" }
  if (tx.user_id !== user.id) return { error: "Sem permissão" }

  if (tx.group_id) {
    // Soft-delete all transactions in the group
    const { data: groupTxs } = await supabase
      .from("transactions")
      .select("id, user_id")
      .eq("group_id", tx.group_id)

    const serviceClient = await createServiceClient()
    await serviceClient
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("group_id", tx.group_id)

    await Promise.all(
      (groupTxs ?? []).map((t) => invalidateSnapshots(t.user_id, tx.date))
    )
  } else {
    await supabase
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", transactionId)

    await invalidateSnapshots(user.id, tx.date)
  }

  revalidatePath("/financeiro")
  revalidatePath("/financeiro/familia")
  return { ok: true }
}

async function recalculateProportions(familyId: string, month: string) {
  const supabase = await createClient()

  const { data: members } = await supabase
    .from("family_members")
    .select("user_id")
    .eq("family_id", familyId)

  if (!members || members.length === 0) return

  const monthEnd = new Date(month)
  monthEnd.setMonth(monthEnd.getMonth() + 1)
  monthEnd.setDate(0)

  const { data: incomes } = await supabase
    .from("transactions")
    .select("user_id, amount")
    .eq("family_id", familyId)
    .eq("type", "income")
    .is("deleted_at", null)
    .gte("date", month)
    .lte("date", monthEnd.toISOString().split("T")[0])

  const totalByUser = new Map<string, number>()
  members.forEach((m) => totalByUser.set(m.user_id, 0))
  ;(incomes ?? []).forEach((i) => {
    totalByUser.set(i.user_id, (totalByUser.get(i.user_id) ?? 0) + i.amount)
  })

  const total = Array.from(totalByUser.values()).reduce((a, b) => a + b, 0)
  if (total === 0) return

  // A última proporção recebe o resto (1 - soma das anteriores) para que o
  // conjunto some exatamente 1 — evita o 0,33+0,33+0,33 = 0,99 do arredondamento.
  const entries = Array.from(totalByUser.entries())
  let acc = 0
  const upserts = entries.map(([uid, inc], idx) => {
    let proportion: number
    if (idx < entries.length - 1) {
      proportion = Number((inc / total).toFixed(5))
      acc += proportion
    } else {
      proportion = Number(Math.min(Math.max(1 - acc, 0), 1).toFixed(5))
    }
    return { family_id: familyId, user_id: uid, month, proportion }
  })

  await supabase.from("income_proportions").upsert(upserts, {
    onConflict: "family_id,user_id,month",
  })
}

async function invalidateSnapshots(userId: string, transactionDate: string) {
  const supabase = await createClient()
  const monthStr = getMonthStart(transactionDate)

  await supabase
    .from("balance_snapshots")
    .update({ is_dirty: true })
    .eq("user_id", userId)
    .gte("month", monthStr)
}
