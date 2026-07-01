"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext } from "@/lib/family"

const CategorySchema = z.object({
  name: z.string().trim().min(1, "Informe um nome").max(40),
  type: z.enum(["income", "expense"]),
  icon: z.string().trim().max(8).optional().nullable(),
})

function revalidate() {
  revalidatePath("/configuracoes/categorias")
  revalidatePath("/financeiro")
  revalidatePath("/orcamento")
  revalidatePath("/financeiro/recorrentes")
}

export async function createCategory(input: z.infer<typeof CategorySchema>) {
  try {
    const parsed = CategorySchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { error } = await supabase.from("categories").insert({
      family_id: ctx.familyId,
      name: parsed.data.name,
      type: parsed.data.type,
      icon: parsed.data.icon || null,
    })
    if (error) {
      if (error.code === "23505") return { error: "Já existe uma categoria com esse nome e tipo" }
      return { error: error.message }
    }
    revalidate()
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro" }
  }
}

const UpdateSchema = CategorySchema.extend({ id: z.string().uuid() })

export async function updateCategory(input: z.infer<typeof UpdateSchema>) {
  try {
    const parsed = UpdateSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { error } = await supabase
      .from("categories")
      .update({
        name: parsed.data.name,
        type: parsed.data.type,
        icon: parsed.data.icon || null,
      })
      .eq("id", parsed.data.id)
      .eq("family_id", ctx.familyId)
    if (error) {
      if (error.code === "23505") return { error: "Já existe uma categoria com esse nome e tipo" }
      return { error: error.message }
    }
    revalidate()
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro" }
  }
}

export async function deleteCategory(id: string) {
  try {
    if (!z.string().uuid().safeParse(id).success) return { error: "Dados inválidos" }
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    // Categorias de sistema (family_id NULL) não são apagáveis pela RLS.
    // Ao apagar: transações referenciando ficam sem categoria (ON DELETE SET NULL)
    // e orçamentos vinculados são removidos (ON DELETE CASCADE).
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id)
      .eq("family_id", ctx.familyId)
    if (error) return { error: error.message }
    revalidate()
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro" }
  }
}
