"use client"

import { useState } from "react"
import { createEvent } from "@/actions/events"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toaster"
import { Plus } from "lucide-react"
import type { EventType } from "@/types/database"

export function NewEventForm() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [type, setType] = useState<EventType>("reminder")
  const [recurring, setRecurring] = useState<string>("none")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const r = await createEvent({
      title,
      description: description || null,
      event_date: eventDate,
      type,
      recurring: recurring === "none" ? null : (recurring as "yearly" | "monthly" | "weekly"),
    })
    setLoading(false)
    if (r.error) toast({ title: "Erro", description: r.error, variant: "destructive" })
    else {
      toast({ title: "Evento criado!" })
      setOpen(false); setTitle(""); setDescription(""); setEventDate(""); setRecurring("none")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Novo evento</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Novo evento</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="ev-title">Título</Label>
            <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-desc">Descrição (opcional)</Label>
            <Input id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-date">Data</Label>
            <Input id="ev-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as EventType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reminder">🔔 Lembrete</SelectItem>
                <SelectItem value="anniversary">🎉 Data especial</SelectItem>
                <SelectItem value="bill">💸 Conta a pagar</SelectItem>
                <SelectItem value="appointment">📅 Compromisso</SelectItem>
                <SelectItem value="goal">🎯 Objetivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Repetir</Label>
            <Select value={recurring} onValueChange={setRecurring}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não repete</SelectItem>
                <SelectItem value="weekly">Semanalmente</SelectItem>
                <SelectItem value="monthly">Mensalmente</SelectItem>
                <SelectItem value="yearly">Anualmente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading || !title.trim() || !eventDate}>
            {loading ? "Salvando..." : "Criar evento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
