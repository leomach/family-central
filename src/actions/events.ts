"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext } from "@/lib/family"

const EventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["reminder", "anniversary", "bill", "appointment", "goal"]),
  icon: z.string().max(8).nullable().optional(),
  recurring: z.enum(["yearly", "monthly", "weekly"]).nullable().optional(),
})

export async function createEvent(input: z.infer<typeof EventSchema>) {
  try {
    const parsed = EventSchema.safeParse(input)
    if (!parsed.success) return { error: "Dados inválidos" }
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { error } = await supabase.from("events").insert({
      family_id: ctx.familyId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      event_date: parsed.data.event_date,
      type: parsed.data.type,
      icon: parsed.data.icon ?? null,
      recurring: parsed.data.recurring ?? null,
      created_by: ctx.userId,
    })
    if (error) return { error: error.message }
    revalidatePath("/calendario")
    return { ok: true }
  } catch (e) { return { error: e instanceof Error ? e.message : "Erro" } }
}

export async function deleteEvent(id: string) {
  try {
    const ctx = await getFamilyContext()
    const supabase = await createClient()
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id)
      .eq("family_id", ctx.familyId)
    if (error) return { error: error.message }
    revalidatePath("/calendario")
    return { ok: true }
  } catch (e) { return { error: e instanceof Error ? e.message : "Erro" } }
}
