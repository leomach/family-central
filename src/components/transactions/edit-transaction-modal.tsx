"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { updateTransaction } from "@/actions/transactions"
import { createClient } from "@/lib/supabase/client"
import type { Category, Transaction } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toaster"

interface EditTransactionModalProps {
  transaction: Transaction
  categories: Category[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditTransactionModal({ transaction: tx, categories, open, onOpenChange }: EditTransactionModalProps) {
  const router = useRouter()
  const isShared = !!tx.group_id
  // Compartilhada é sempre despesa dividida — o tipo fica travado.
  const [type, setType] = useState<"income" | "expense">(tx.type === "income" ? "income" : "expense")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState(tx.description)
  const [categoryId, setCategoryId] = useState(tx.category_id ?? "")
  const [date, setDate] = useState(tx.date)
  const [loading, setLoading] = useState(false)
  // Para compartilhada, o valor editável é o TOTAL do grupo (não a parcela).
  const [loadingTotal, setLoadingTotal] = useState(isShared)

  useEffect(() => {
    if (!open) return
    setDescription(tx.description)
    setCategoryId(tx.category_id ?? "")
    setDate(tx.date)
    setType(tx.type === "income" ? "income" : "expense")

    if (isShared && tx.group_id) {
      setLoadingTotal(true)
      const supabase = createClient()
      supabase
        .from("transaction_groups")
        .select("total_amount")
        .eq("id", tx.group_id)
        .single()
        .then(({ data }) => {
          setAmount(data ? String(Number(data.total_amount)).replace(".", ",") : String(Number(tx.amount)).replace(".", ","))
          setLoadingTotal(false)
        })
    } else {
      setAmount(String(Number(tx.amount)).replace(".", ","))
    }
  }, [open, tx, isShared])

  const filteredCategories = categories.filter((c) => c.type === type)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedAmount = parseFloat(amount.replace(",", "."))
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" })
      return
    }

    setLoading(true)
    const result = await updateTransaction({
      id: tx.id,
      type,
      amount: parsedAmount,
      description,
      category_id: categoryId || null,
      date,
    })
    setLoading(false)

    if (result.error) {
      toast({ title: "Erro ao salvar", description: result.error, variant: "destructive" })
    } else {
      toast({ title: "Lançamento atualizado!" })
      onOpenChange(false)
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {!isShared && (
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
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-amount">{isShared ? "Valor total (R$)" : "Valor (R$)"}</Label>
            <Input
              id="edit-amount"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={loadingTotal}
              required
            />
            {isShared && (
              <p className="text-[11px] text-muted-foreground">
                O valor será redividido entre os participantes (proporcional à renda do mês).
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Descrição</Label>
            <Input id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} required />
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
            <Label htmlFor="edit-date">Data</Label>
            <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <Button type="submit" className="w-full" disabled={loading || loadingTotal}>
            {loading ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
