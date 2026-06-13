"use server"

import { revalidatePath } from "next/cache"
import { randomUUID } from "node:crypto"
import { createClient, createServiceClient } from "@/lib/supabase/server"

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

export async function createFamily(name: string) {
  if (!name || name.trim().length === 0) return { error: "Nome inválido" }

  // 1. Valida a sessão com o cliente normal (auth)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Sessão expirada. Faça login novamente." }

  // 2. Usa Service Role para inserir família + membro (bypassa RLS)
  // É seguro: o user.id veio da sessão validada acima
  const service = await createServiceClient()

  const familyId = randomUUID()
  const { error: familyError } = await service
    .from("families")
    .insert({ id: familyId, name: name.trim() })

  if (familyError) return { error: familyError.message }

  const { error: memberError } = await service
    .from("family_members")
    .insert({ family_id: familyId, user_id: user.id, role: "owner" })

  if (memberError) {
    // Cleanup: remove a família órfã
    await service.from("families").delete().eq("id", familyId)
    return { error: memberError.message }
  }

  revalidatePath("/")
  return { ok: true }
}

export async function joinFamily(code: string) {
  if (!code || code.length !== 8) return { error: "Código inválido" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Sessão expirada. Faça login novamente." }

  // Service Role: busca e valida convite + adiciona membro
  const service = await createServiceClient()

  const { data: invite } = await service
    .from("family_invites")
    .select("*")
    .eq("code", code)
    .is("used_by", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (!invite) return { error: "Código inválido ou expirado" }

  // Verifica se o usuário já está em alguma família
  const { data: existing } = await service
    .from("family_members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (existing) return { error: "Você já faz parte de uma família" }

  const { error: memberError } = await service
    .from("family_members")
    .insert({ family_id: invite.family_id, user_id: user.id, role: "member" })

  if (memberError) return { error: memberError.message }

  await service
    .from("family_invites")
    .update({ used_by: user.id })
    .eq("id", invite.id)

  revalidatePath("/")
  return { ok: true }
}

export async function generateInvite(familyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Sessão expirada. Faça login novamente." }

  // Verifica permissão via cliente normal (RLS aplicada)
  const { data: member } = await supabase
    .from("family_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("family_id", familyId)
    .maybeSingle()

  if (!member || !["owner", "admin"].includes(member.role)) {
    return { error: "Sem permissão" }
  }

  const service = await createServiceClient()
  const code = generateCode()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const { error } = await service
    .from("family_invites")
    .insert({
      family_id: familyId,
      code,
      created_by: user.id,
      expires_at: expiresAt.toISOString(),
    })

  if (error) return { error: error.message }
  return { code }
}
