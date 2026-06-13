"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext } from "@/lib/family"

const TodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
})

export async function createTodo(input: z.infer<typeof TodoSchema>) {
  try {
    const parsed = TodoSchema.safeParse(input)
    if (!parsed.success) return { error: "Dados inválidos" }
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { error } = await supabase.from("todos").insert({
      family_id: ctx.familyId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      assigned_to: parsed.data.assigned_to ?? null,
      due_date: parsed.data.due_date ?? null,
      priority: parsed.data.priority,
      created_by: ctx.userId,
      completed: false,
    })
    if (error) return { error: error.message }
    revalidatePath("/tarefas")
    return { ok: true }
  } catch (e) { return { error: e instanceof Error ? e.message : "Erro" } }
}

export async function toggleTodo(id: string, completed: boolean) {
  try {
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { error } = await supabase
      .from("todos")
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        completed_by: completed ? ctx.userId : null,
      })
      .eq("id", id)
      .eq("family_id", ctx.familyId)
    if (error) return { error: error.message }
    revalidatePath("/tarefas")
    return { ok: true }
  } catch (e) { return { error: e instanceof Error ? e.message : "Erro" } }
}

export async function deleteTodo(id: string) {
  try {
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { error } = await supabase
      .from("todos")
      .delete()
      .eq("id", id)
      .eq("family_id", ctx.familyId)
    if (error) return { error: error.message }
    revalidatePath("/tarefas")
    return { ok: true }
  } catch (e) { return { error: e instanceof Error ? e.message : "Erro" } }
}
