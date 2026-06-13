"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext } from "@/lib/family"

export async function addComment(transactionId: string, content: string) {
  try {
    if (!content?.trim()) return { error: "Mensagem vazia" }
    const ctx = await getFamilyContext()
    const supabase = await createClient()

    const { data: tx } = await supabase
      .from("transactions")
      .select("family_id")
      .eq("id", transactionId)
      .single()
    if (!tx || tx.family_id !== ctx.familyId) return { error: "Sem permissão" }

    const { error } = await supabase.from("transaction_comments").insert({
      transaction_id: transactionId,
      family_id: ctx.familyId,
      user_id: ctx.userId,
      content: content.trim().slice(0, 1000),
    })
    if (error) return { error: error.message }
    revalidatePath("/financeiro")
    revalidatePath("/financeiro/familia")
    return { ok: true }
  } catch (e) { return { error: e instanceof Error ? e.message : "Erro" } }
}
