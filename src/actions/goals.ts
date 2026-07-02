"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getMonthStart } from "@/lib/utils"
import { z } from "zod"

const GoalSchema = z.object({
  name: z.string().min(1).max(100),
  target_value: z.number().positive(),
  familyId: z.string().uuid(),
})

export async function createGoal(input: z.infer<typeof GoalSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const parsed = GoalSchema.safeParse(input)
  if (!parsed.success) return { error: "Dados inválidos" }

  const { error } = await supabase.from("savings_goals").insert({
    family_id: parsed.data.familyId,
    name: parsed.data.name,
    target_value: parsed.data.target_value,
  })

  if (error) return { error: error.message }

  revalidatePath("/enxoval")
  return { ok: true }
}

export async function contributeToGoal(input: {
  goalId: string
  familyId: string
  amount: number
  direction: "deposit" | "withdraw"
  date?: string // YYYY-MM-DD, padrão: hoje
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  // Verifica se o usuário pertence à família alvo (suporta usuário em várias famílias).
  const { data: member } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .eq("family_id", input.familyId)
    .maybeSingle()

  if (!member) return { error: "Sem permissão" }

  const today = new Date().toISOString().split("T")[0]
  const date = input.date ?? today

  const { data, error } = await supabase.rpc("contribute_to_goal", {
    p_goal_id: input.goalId,
    p_user_id: user.id,
    p_family_id: input.familyId,
    p_amount: input.amount,
    p_direction: input.direction,
    p_date: date,
  })

  if (error) return { error: error.message }

  const monthStr = getMonthStart(new Date(date + "T00:00:00"))
  await supabase
    .from("balance_snapshots")
    .update({ is_dirty: true })
    .eq("user_id", user.id)
    .gte("month", monthStr)

  revalidatePath(`/enxoval/${input.goalId}`)
  revalidatePath("/enxoval")
  revalidatePath("/financeiro")
  return { ok: true, transactionId: data }
}

export async function updateContribution(input: {
  contributionId: string
  goalId: string
  amount: number
  date: string // YYYY-MM-DD
  oldDate: string // para invalidar o mês anterior se mudou
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const { error } = await supabase.rpc("update_contribution", {
    p_contribution_id: input.contributionId,
    p_amount: input.amount,
    p_date: input.date,
  })

  if (error) return { error: error.message }

  // Invalidar snapshots a partir do mês mais antigo afetado
  const earlierMonth = input.date < input.oldDate ? input.date : input.oldDate
  const monthStr = getMonthStart(new Date(earlierMonth + "T00:00:00"))
  await supabase
    .from("balance_snapshots")
    .update({ is_dirty: true })
    .eq("user_id", user.id)
    .gte("month", monthStr)

  revalidatePath(`/enxoval/${input.goalId}`)
  revalidatePath("/enxoval")
  revalidatePath("/financeiro")
  return { ok: true }
}
