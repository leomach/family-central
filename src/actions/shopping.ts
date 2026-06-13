"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext } from "@/lib/family"

export async function createShoppingList(name: string, icon = "🛒") {
  try {
    if (!name?.trim()) return { error: "Nome obrigatório" }
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ family_id: ctx.familyId, name: name.trim(), icon, created_by: ctx.userId })
      .select()
      .single()
    if (error) return { error: error.message }
    revalidatePath("/compras")
    return { ok: true, id: data.id }
  } catch (e) { return { error: e instanceof Error ? e.message : "Erro" } }
}

export async function archiveList(listId: string) {
  try {
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { error } = await supabase
      .from("shopping_lists")
      .update({ archived: true })
      .eq("id", listId)
      .eq("family_id", ctx.familyId)
    if (error) return { error: error.message }
    revalidatePath("/compras")
    return { ok: true }
  } catch (e) { return { error: e instanceof Error ? e.message : "Erro" } }
}

const ItemSchema = z.object({
  list_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  quantity: z.number().positive().default(1),
  unit: z.string().max(20).nullable().optional(),
  estimated_price: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(200).nullable().optional(),
})

export async function addShoppingItem(input: z.infer<typeof ItemSchema>) {
  try {
    const parsed = ItemSchema.safeParse(input)
    if (!parsed.success) return { error: "Dados inválidos" }
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { error } = await supabase.from("shopping_items").insert({
      list_id: parsed.data.list_id,
      family_id: ctx.familyId,
      name: parsed.data.name,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit ?? null,
      estimated_price: parsed.data.estimated_price ?? null,
      notes: parsed.data.notes ?? null,
      added_by: ctx.userId,
      completed: false,
    })
    if (error) return { error: error.message }
    revalidatePath(`/compras/${parsed.data.list_id}`)
    return { ok: true }
  } catch (e) { return { error: e instanceof Error ? e.message : "Erro" } }
}

export async function toggleItem(itemId: string, completed: boolean) {
  try {
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { data: item } = await supabase
      .from("shopping_items")
      .select("list_id")
      .eq("id", itemId)
      .eq("family_id", ctx.familyId)
      .single()
    if (!item) return { error: "Item não encontrado" }

    const { error } = await supabase
      .from("shopping_items")
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        completed_by: completed ? ctx.userId : null,
      })
      .eq("id", itemId)
    if (error) return { error: error.message }
    revalidatePath(`/compras/${item.list_id}`)
    return { ok: true }
  } catch (e) { return { error: e instanceof Error ? e.message : "Erro" } }
}

export async function deleteItem(itemId: string) {
  try {
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { data: item } = await supabase
      .from("shopping_items")
      .select("list_id")
      .eq("id", itemId)
      .eq("family_id", ctx.familyId)
      .single()
    if (!item) return { error: "Item não encontrado" }
    const { error } = await supabase.from("shopping_items").delete().eq("id", itemId)
    if (error) return { error: error.message }
    revalidatePath(`/compras/${item.list_id}`)
    return { ok: true }
  } catch (e) { return { error: e instanceof Error ? e.message : "Erro" } }
}

export async function clearCompletedItems(listId: string) {
  try {
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .eq("list_id", listId)
      .eq("family_id", ctx.familyId)
      .eq("completed", true)
    if (error) return { error: error.message }
    revalidatePath(`/compras/${listId}`)
    return { ok: true }
  } catch (e) { return { error: e instanceof Error ? e.message : "Erro" } }
}
