import type { Metadata } from "next"
import { getFamilyContext, getFamilyMembers } from "@/lib/family"
import { InviteSection } from "./invite-section"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LogoutButton } from "./logout-button"

export const metadata: Metadata = { title: "Configurações" }

export default async function ConfiguracoesPage() {
  const ctx = await getFamilyContext()
  const members = await getFamilyMembers(ctx.familyId)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Configurações</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Minha conta</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Nome: </span>{ctx.userName}</p>
          <p><span className="text-muted-foreground">E-mail: </span>{ctx.userEmail}</p>
          <p><span className="text-muted-foreground">Família: </span>{ctx.familyName}</p>
          <p>
            <span className="text-muted-foreground">Papel: </span>
            <Badge variant="outline" className="ml-1">{ctx.role}</Badge>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Membros da família</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between">
              <div>
                <p className="text-sm">{m.user_id === ctx.userId ? `${m.name} (você)` : m.name}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <Badge variant="secondary">{m.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {(ctx.role === "owner" || ctx.role === "admin") && (
        <InviteSection familyId={ctx.familyId} />
      )}

      <LogoutButton />
    </div>
  )
}
