"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext } from "@/lib/family"

const RecurringSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive().max(99999999),
  description: z.string().min(1).max(200),
  category_id: z.string().uuid().nullable().optional(),
  frequency: z.enum(["monthly", "weekly", "yearly"]),
  day_of_month: z.number().int().min(1).max(31).optional(),
  day_of_week: z.number().int().min(0).max(6).optional(),
  shared_participants: z.array(z.string().uuid()).min(2).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

export async function createRecurring(input: z.infer<typeof RecurringSchema>) {
  try {
    const parsed = RecurringSchema.safeParse(input)
    if (!parsed.success) return { error: "Dados inválidos" }

    const ctx = await getFamilyContext()
    const supabase = await createClient()

    const { error } = await supabase.from("recurring_transactions").insert({
      family_id: ctx.familyId,
      user_id: ctx.userId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      description: parsed.data.description,
      category_id: parsed.data.category_id ?? null,
      frequency: parsed.data.frequency,
      day_of_month: parsed.data.day_of_month ?? null,
      day_of_week: parsed.data.day_of_week ?? null,
      shared_participants: parsed.data.shared_participants ?? null,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date ?? null,
      next_run_date: parsed.data.start_date,
      is_active: true,
    })

    if (error) return { error: error.message }
    revalidatePath("/financeiro/recorrentes")
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro desconhecido" }
  }
}

export async function toggleRecurring(id: string, active: boolean) {
  try {
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { error } = await supabase
      .from("recurring_transactions")
      .update({ is_active: active })
      .eq("id", id)
      .eq("family_id", ctx.familyId)
    if (error) return { error: error.message }
    revalidatePath("/financeiro/recorrentes")
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro desconhecido" }
  }
}

export async function deleteRecurring(id: string) {
  try {
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { error } = await supabase
      .from("recurring_transactions")
      .delete()
      .eq("id", id)
      .eq("family_id", ctx.familyId)
    if (error) return { error: error.message }
    revalidatePath("/financeiro/recorrentes")
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro desconhecido" }
  }
}
