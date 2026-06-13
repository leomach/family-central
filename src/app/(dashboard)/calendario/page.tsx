import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext } from "@/lib/family"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { NewEventForm } from "@/components/calendar/new-event-form"
import { DeleteEventButton } from "@/components/calendar/delete-event-button"
import { formatDate } from "@/lib/utils"

export const metadata: Metadata = { title: "Calendário" }

const TYPE_LABEL = {
  reminder: "Lembrete",
  anniversary: "Data especial",
  bill: "Conta",
  appointment: "Compromisso",
  goal: "Objetivo",
} as const

const TYPE_ICON = {
  reminder: "🔔",
  anniversary: "🎉",
  bill: "💸",
  appointment: "📅",
  goal: "🎯",
} as const

export default async function CalendarioPage() {
  const ctx = await getFamilyContext()
  const supabase = await createClient()
  const today = new Date().toISOString().split("T")[0]

  const [futureResult, pastResult] = await Promise.all([
    supabase.from("events")
      .select("*")
      .eq("family_id", ctx.familyId)
      .gte("event_date", today)
      .order("event_date"),
    supabase.from("events")
      .select("*")
      .eq("family_id", ctx.familyId)
      .lt("event_date", today)
      .order("event_date", { ascending: false })
      .limit(10),
  ])

  const future = futureResult.data ?? []
  const past = pastResult.data ?? []

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Calendário</h1>
        <NewEventForm />
      </div>

      {future.length === 0 && past.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-medium">Nenhum evento ainda</p>
          <p className="text-sm mt-1">Adicione aniversários, contas a pagar e datas importantes</p>
        </div>
      )}

      {future.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Próximos</h2>
          {future.map((e) => {
            const daysUntil = Math.ceil((new Date(e.event_date + "T00:00:00").getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            return (
              <Card key={e.id}>
                <CardContent className="pt-4 pb-4 flex items-start justify-between gap-3">
                  <div className="flex gap-3 items-start min-w-0">
                    <span className="text-xl">{e.icon ?? TYPE_ICON[e.type]}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{e.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">{TYPE_LABEL[e.type]}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(e.event_date)}
                          {daysUntil === 0 && " · hoje"}
                          {daysUntil === 1 && " · amanhã"}
                          {daysUntil > 1 && ` · em ${daysUntil} dias`}
                        </span>
                      </div>
                      {e.description && <p className="text-xs text-muted-foreground mt-1">{e.description}</p>}
                    </div>
                  </div>
                  <DeleteEventButton eventId={e.id} />
                </CardContent>
              </Card>
            )
          })}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Passados</h2>
          {past.map((e) => (
            <Card key={e.id} className="opacity-60">
              <CardContent className="pt-3 pb-3 flex items-center justify-between gap-3">
                <div className="flex gap-3 items-center min-w-0">
                  <span className="text-lg">{e.icon ?? TYPE_ICON[e.type]}</span>
                  <div className="min-w-0">
                    <p className="text-sm">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(e.event_date)}</p>
                  </div>
                </div>
                <DeleteEventButton eventId={e.id} />
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  )
}
