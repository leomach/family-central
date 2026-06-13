"use client"

import { useState } from "react"
import type { Budget, Category } from "@/types/database"
import { upsertBudget, deleteBudget } from "@/actions/budgets"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toaster"
import { Plus, Trash2 } from "lucide-react"
import { formatCurrency, formatMonth, cn } from "@/lib/utils"

interface Props {
  month: string
  budgets: Budget[]
  categories: Category[]
  spentByCategory: Record<string, number>
}

export function BudgetManager({ month, budgets, categories, spentByCategory }: Props) {
  const [open, setOpen] = useState(false)
  const [categoryId, setCategoryId] = useState("")
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)

  const budgetedCategoryIds = new Set(budgets.map((b) => b.category_id))
  const availableCategories = categories.filter((c) => !budgetedCategoryIds.has(c.id))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const value = parseFloat(amount.replace(",", "."))
    if (isNaN(value) || value <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" })
      return
    }
    setLoading(true)
    const r = await upsertBudget({ category_id: categoryId, month, limit_amount: value })
    setLoading(false)
    if (r.error) toast({ title: "Erro", description: r.error, variant: "destructive" })
    else {
      toast({ title: "Orçamento salvo!" })
      setOpen(false); setCategoryId(""); setAmount("")
    }
  }

  async function handleDelete(id: string) {
    const r = await deleteBudget(id)
    if (r.error) toast({ title: "Erro", description: r.error, variant: "destructive" })
  }

  const totalBudget = budgets.reduce((s, b) => s + Number(b.limit_amount), 0)
  const totalSpent = budgets.reduce((s, b) => s + (spentByCategory[b.category_id] ?? 0), 0)
  const totalPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground capitalize">{formatMonth(month)}</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={availableCategories.length === 0} className="gap-1.5">
              <Plus className="h-4 w-4" />Novo limite
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Definir limite mensal</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget-amount">Limite (R$)</Label>
                <Input id="budget-amount" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !categoryId}>
                {loading ? "Salvando..." : "Salvar limite"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {budgets.length > 0 && (
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total gasto</p>
              <p className={cn("text-sm font-medium", totalPercent > 100 ? "text-destructive" : totalPercent > 80 ? "text-amber-500" : "text-foreground")}>
                {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
              </p>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all rounded-full",
                  totalPercent > 100 ? "bg-destructive" : totalPercent > 80 ? "bg-amber-500" : "bg-income"
                )}
                style={{ width: `${Math.min(totalPercent, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {budgets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">📊</p>
          <p className="font-medium">Nenhum limite definido</p>
          <p className="text-sm mt-1">Defina limites mensais por categoria para se manter no controle</p>
        </div>
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => {
            const spent = spentByCategory[b.category_id] ?? 0
            const limit = Number(b.limit_amount)
            const percent = (spent / limit) * 100
            const remaining = limit - spent
            return (
              <Card key={b.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span>{b.category?.icon}</span>
                      <p className="font-medium text-sm">{b.category?.name}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div
                      className={cn(
                        "h-full transition-all rounded-full",
                        percent > 100 ? "bg-destructive" : percent > 80 ? "bg-amber-500" : "bg-income"
                      )}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {formatCurrency(spent)} de {formatCurrency(limit)}
                    </span>
                    <span className={cn(remaining < 0 ? "text-destructive" : "text-muted-foreground")}>
                      {remaining < 0 ? `Excedeu ${formatCurrency(Math.abs(remaining))}` : `Resta ${formatCurrency(remaining)}`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
