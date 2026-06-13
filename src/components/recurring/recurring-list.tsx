"use client"

import { useState, useTransition } from "react"
import type { RecurringTransaction, Category } from "@/types/database"
import { createRecurring, toggleRecurring, deleteRecurring } from "@/actions/recurring"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/toaster"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { Plus, Trash2, Pause, Play } from "lucide-react"

const FREQ_LABEL = { monthly: "mensal", weekly: "semanal", yearly: "anual" } as const

interface Props {
  initial: RecurringTransaction[]
  categories: Category[]
  members: { user_id: string; name: string }[]
  currentUserId: string
}

export function RecurringList({ initial, categories, members, currentUserId }: Props) {
  const [items] = useState(initial)
  const [, start] = useTransition()

  function handleToggle(id: string, current: boolean) {
    start(async () => {
      const r = await toggleRecurring(id, !current)
      if (r.error) toast({ title: "Erro", description: r.error, variant: "destructive" })
    })
  }

  function handleDelete(id: string) {
    if (!confirm("Remover este lançamento recorrente? Lançamentos já gerados não serão afetados.")) return
    start(async () => {
      const r = await deleteRecurring(id)
      if (r.error) toast({ title: "Erro", description: r.error, variant: "destructive" })
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <NewRecurringForm categories={categories} members={members} currentUserId={currentUserId} />
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">🔁</p>
          <p className="font-medium">Nenhum lançamento recorrente</p>
        </div>
      ) : (
        items.map((r) => (
          <Card key={r.id} className={cn(!r.is_active && "opacity-60")}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-xl">{r.category?.icon ?? (r.type === "income" ? "💰" : "💸")}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{r.description}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">{FREQ_LABEL[r.frequency]}</Badge>
                      {r.shared_participants && r.shared_participants.length > 1 && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">Compartilhado</Badge>
                      )}
                      {!r.is_active && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Pausado</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Próximo: {formatDate(r.next_run_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className={cn("text-sm font-semibold", r.type === "income" ? "text-income" : "text-expense")}>
                    {r.type === "income" ? "+" : "−"}{formatCurrency(Number(r.amount))}
                  </p>
                  <button onClick={() => handleToggle(r.id, r.is_active)} className="text-muted-foreground hover:text-foreground p-1" aria-label={r.is_active ? "Pausar" : "Ativar"}>
                    {r.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => handleDelete(r.id)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Remover">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

function NewRecurringForm({ categories, members, currentUserId }: { categories: Category[]; members: { user_id: string; name: string }[]; currentUserId: string }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<"income" | "expense">("expense")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [frequency, setFrequency] = useState<"monthly" | "weekly" | "yearly">("monthly")
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0])
  const [shared, setShared] = useState(false)
  const [participants, setParticipants] = useState<string[]>([currentUserId])
  const [loading, setLoading] = useState(false)

  const filteredCategories = categories.filter((c) => c.type === type)
  const otherMembers = members.filter((m) => m.user_id !== currentUserId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(amount.replace(",", "."))
    if (isNaN(v) || v <= 0) { toast({ title: "Valor inválido", variant: "destructive" }); return }
    setLoading(true)
    const r = await createRecurring({
      type, amount: v, description,
      category_id: categoryId || null,
      frequency,
      start_date: startDate,
      shared_participants: shared && participants.length > 1 ? participants : undefined,
    })
    setLoading(false)
    if (r.error) toast({ title: "Erro", description: r.error, variant: "destructive" })
    else {
      toast({ title: "Cadastrado!" })
      setOpen(false); setAmount(""); setDescription(""); setCategoryId(""); setShared(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Novo recorrente</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Novo lançamento recorrente</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="flex rounded-md overflow-hidden border border-input">
            <button type="button" onClick={() => setType("expense")} className={cn("flex-1 py-2 text-sm font-medium", type === "expense" ? "bg-expense text-white" : "text-muted-foreground")}>Despesa</button>
            <button type="button" onClick={() => setType("income")} className={cn("flex-1 py-2 text-sm font-medium", type === "income" ? "bg-income text-white" : "text-muted-foreground")}>Receita</button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rec-amount">Valor (R$)</Label>
            <Input id="rec-amount" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rec-desc">Descrição</Label>
            <Input id="rec-desc" placeholder="Ex: Netflix, Aluguel..." value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {filteredCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Repetição</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as "monthly" | "weekly" | "yearly")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-start">Início</Label>
              <Input id="rec-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
          </div>

          {type === "expense" && otherMembers.length > 0 && (
            <div className="space-y-3 pt-1 border-t border-border">
              <div className="flex items-center gap-2">
                <Checkbox id="rec-shared" checked={shared} onCheckedChange={(v) => {
                  setShared(!!v); if (!v) setParticipants([currentUserId])
                  else setParticipants([currentUserId, ...otherMembers.map((m) => m.user_id)])
                }} />
                <Label htmlFor="rec-shared">Dividir igualmente</Label>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Criar recorrente"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
