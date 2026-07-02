"use client"

import { useState } from "react"
import { updateContribution } from "@/actions/goals"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toaster"
import { formatCurrency } from "@/lib/utils"
import { Pencil } from "lucide-react"

interface EditContributionModalProps {
  contributionId: string
  goalId: string
  currentAmount: number  // sempre positivo
  currentDate: string    // YYYY-MM-DD
  isDeposit: boolean
}

export function EditContributionModal({
  contributionId,
  goalId,
  currentAmount,
  currentDate,
  isDeposit,
}: EditContributionModalProps) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(currentAmount.toFixed(2).replace(".", ","))
  const [date, setDate] = useState(currentDate)
  const [loading, setLoading] = useState(false)

  const parsedAmount = parseFloat(amount.replace(",", ".")) || 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (parsedAmount <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" })
      return
    }

    setLoading(true)
    const result = await updateContribution({
      contributionId,
      goalId,
      amount: parsedAmount,
      date,
      oldDate: currentDate,
    })

    if (result.error) {
      toast({ title: "Erro ao editar", description: result.error, variant: "destructive" })
    } else {
      toast({ title: "Registro atualizado!" })
      setOpen(false)
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar {isDeposit ? "depósito" : "retirada"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="bg-muted rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor atual</span>
              <span className={`font-medium ${isDeposit ? "text-income" : "text-expense"}`}>
                {isDeposit ? "+" : "-"}{formatCurrency(currentAmount)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Valor (R$)</Label>
              <Input
                id="edit-amount"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date">Data</Label>
              <Input
                id="edit-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
