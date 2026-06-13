"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext } from "@/lib/family"

const BudgetSchema = z.object({
  category_id: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit_amount: z.number().positive(),
})

export async function upsertBudget(input: z.infer<typeof BudgetSchema>) {
  try {
    const parsed = BudgetSchema.safeParse(input)
    if (!parsed.success) return { error: "Dados inválidos" }
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { error } = await supabase.from("budgets").upsert({
      family_id: ctx.familyId,
      category_id: parsed.data.category_id,
      month: parsed.data.month,
      limit_amount: parsed.data.limit_amount,
    }, { onConflict: "family_id,category_id,month" })
    if (error) return { error: error.message }
    revalidatePath("/financeiro")
    revalidatePath("/orcamento")
    return { ok: true }
  } catch (e) { return { error: e instanceof Error ? e.message : "Erro" } }
}

export async function deleteBudget(id: string) {
  try {
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { error } = await supabase
      .from("budgets")
      .delete()
      .eq("id", id)
      .eq("family_id", ctx.familyId)
    if (error) return { error: error.message }
    revalidatePath("/financeiro")
    revalidatePath("/orcamento")
    return { ok: true }
  } catch (e) { return { error: e instanceof Error ? e.message : "Erro" } }
}
