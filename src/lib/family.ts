import "server-only"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export type FamilyContext = {
  userId: string
  familyId: string
  familyName: string
  role: "owner" | "admin" | "member"
  userName: string
  userEmail: string
}

export async function getFamilyContext(): Promise<FamilyContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: member } = await supabase
    .from("family_members")
    .select("family_id, role, families(name)")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!member) redirect("/onboarding")

  const families = (member as { families?: { name: string } | { name: string }[] }).families
  const familyName = Array.isArray(families) ? (families[0]?.name ?? "Família") : (families?.name ?? "Família")

  return {
    userId: user.id,
    familyId: member.family_id,
    familyName,
    role: member.role as FamilyContext["role"],
    userName: (user.user_metadata?.full_name as string) ?? user.email ?? "Você",
    userEmail: user.email ?? "",
  }
}

export type MemberInfo = {
  user_id: string
  role: "owner" | "admin" | "member"
  name: string
  email: string
}

export async function getFamilyMembers(familyId: string): Promise<MemberInfo[]> {
  const supabase = await createClient()
  const service = await createServiceClient()

  const { data: members } = await supabase
    .from("family_members")
    .select("user_id, role")
    .eq("family_id", familyId)

  if (!members) return []

  const result: MemberInfo[] = []
  for (const m of members) {
    const { data: userData } = await service.auth.admin.getUserById(m.user_id)
    const user = userData?.user
    result.push({
      user_id: m.user_id,
      role: m.role as MemberInfo["role"],
      name: (user?.user_metadata?.full_name as string) ?? user?.email ?? "Membro",
      email: user?.email ?? "",
    })
  }
  return result
}
