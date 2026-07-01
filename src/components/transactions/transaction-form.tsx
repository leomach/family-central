"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createTransaction } from "@/actions/transactions"
import { enqueue } from "@/lib/offline-queue"
import type { Category } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/toaster"
import { Plus } from "lucide-react"
import { formatCurrency, splitAmount } from "@/lib/utils"

interface TransactionFormProps {
  familyId: string
  userId: string
  categories: Category[]
  familyMembers?: { user_id: string; name: string }[]
  // Proporção de renda do mês por usuário — usada para prever o rateio real.
  proportions?: Record<string, number>
}

export function TransactionForm({ familyId, userId, categories, familyMembers = [], proportions = {} }: TransactionFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<"income" | "expense">("expense")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [date, setDate] = useState("")
  useEffect(() => {
    // Data local do dispositivo (não UTC) — evita "pular" para o dia seguinte à noite.
    const d = new Date()
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
  }, [])
  const [shared, setShared] = useState(false)
  const [participants, setParticipants] = useState<string[]>([userId])
  const [loading, setLoading] = useState(false)

  const filteredCategories = categories.filter((c) => c.type === type)
  const otherMembers = familyMembers.filter((m) => m.user_id !== userId)

  function toggleParticipant(uid: string) {
    setParticipants((prev) => prev.includes(uid) ? prev.filter((p) => p !== uid) : [...prev, uid])
  }

  function reset() {
    setAmount("")
    setDescription("")
    setCategoryId("")
    setShared(false)
    setParticipants([userId])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedAmount = parseFloat(amount.replace(",", "."))
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" })
      return
    }

    setLoading(true)

    const payload = {
      type,
      amount: parsedAmount,
      description,
      category_id: categoryId || null,
      date,
      familyId,
      participants: shared ? participants : undefined,
    }

    // Se offline → enfileira no IndexedDB
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        await enqueue({ kind: "transaction", payload })
        toast({
          title: "Salvo offline",
          description: "Enviaremos automaticamente quando a conexão voltar.",
        })
        setOpen(false)
        reset()
      } catch {
        toast({ title: "Erro ao salvar offline", variant: "destructive" })
      }
      setLoading(false)
      return
    }

    // Online → tenta direto. Se falhar por rede, cai pra fila.
    try {
      const result = await createTransaction(payload)
      if (result.error) {
        toast({ title: "Erro ao salvar", description: result.error, variant: "destructive" })
      } else {
        toast({ title: "Lançamento salvo!" })
        setOpen(false)
        reset()
        router.refresh()
      }
    } catch {
      // Provavelmente rede caiu durante o envio
      try {
        await enqueue({ kind: "transaction", payload })
        toast({ title: "Salvo offline", description: "Sincronizaremos quando voltar a conexão." })
        setOpen(false)
        reset()
      } catch {
        toast({ title: "Erro inesperado", variant: "destructive" })
      }
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="flex rounded-md overflow-hidden border border-input">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium transition-colors ${type === "expense" ? "bg-expense text-white" : "text-muted-foreground hover:bg-muted"}`}
              onClick={() => setType("expense")}
            >
              Despesa
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium transition-colors ${type === "income" ? "bg-income text-white" : "text-muted-foreground hover:bg-muted"}`}
              onClick={() => setType("income")}
            >
              Receita
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input id="amount" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" placeholder="Ex: Supermercado" value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
              <SelectContent>
                {filteredCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          {type === "expense" && otherMembers.length > 0 && (
            <div className="space-y-3 pt-1 border-t border-border">
              <div className="flex items-center gap-2">
                <Checkbox id="shared" checked={shared} onCheckedChange={(v) => {
                  setShared(!!v)
                  if (!v) setParticipants([userId])
                }} />
                <Label htmlFor="shared" className="cursor-pointer">Dividir com a família</Label>
              </div>

              {shared && (() => {
                // Prevê o rateio real (proporcional à renda, mesmo cálculo do backend).
                const parsedAmount = parseFloat(amount.replace(",", ".")) || 0
                const propMap = new Map(Object.entries(proportions))
                const split = parsedAmount > 0 ? splitAmount(parsedAmount, participants, propMap) : null
                const shares = split && !("error" in split) ? split : null
                return (
                <div className="space-y-2 pl-6">
                  {shares === null && parsedAmount > 0 && (
                    <p className="text-xs text-destructive">Valor muito baixo para dividir entre os participantes.</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">Rateio proporcional à renda do mês.</p>
                  {otherMembers.map((m) => {
                    const selected = participants.includes(m.user_id)
                    const share = selected && shares
                      ? formatCurrency(shares.get(m.user_id) ?? 0)
                      : null
                    return (
                      <div key={m.user_id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox id={m.user_id} checked={selected} onCheckedChange={() => toggleParticipant(m.user_id)} />
                          <Label htmlFor={m.user_id} className="cursor-pointer">{m.name}</Label>
                        </div>
                        {share && <span className="text-xs text-muted-foreground">{share}</span>}
                      </div>
                    )
                  })}
                </div>
                )
              })()}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Salvar lançamento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
