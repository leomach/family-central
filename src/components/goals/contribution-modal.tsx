"use client"

import { useState } from "react"
import { contributeToGoal } from "@/actions/goals"
import type { SavingsGoal } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toaster"
import { formatCurrency } from "@/lib/utils"
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react"

interface ContributionModalProps {
  goal: SavingsGoal
  userId: string
  familyId: string
  direction: "deposit" | "withdraw"
}

export function ContributionModal({ goal, userId, familyId, direction }: ContributionModalProps) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)

  const isDeposit = direction === "deposit"
  const parsedAmount = parseFloat(amount.replace(",", ".")) || 0
  const newGoalValue = isDeposit
    ? goal.current_value + parsedAmount
    : Math.max(goal.current_value - parsedAmount, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (parsedAmount <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" })
      return
    }
    if (!isDeposit && parsedAmount > goal.current_value) {
      toast({ title: "Saldo insuficiente na caixinha", variant: "destructive" })
      return
    }

    setLoading(true)
    const result = await contributeToGoal({
      goalId: goal.id,
      familyId,
      amount: parsedAmount,
      direction,
    })

    if (result.error) {
      toast({ title: "Erro", description: result.error, variant: "destructive" })
    } else {
      toast({ title: isDeposit ? "Depósito realizado!" : "Retirada realizada!" })
      setOpen(false)
      setAmount("")
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isDeposit ? "default" : "outline"} className="flex-1 gap-2">
          {isDeposit ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
          {isDeposit ? "Depositar" : "Retirar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isDeposit ? "Depositar em" : "Retirar de"} {goal.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo atual</span>
              <span className="font-medium text-income">{formatCurrency(goal.current_value)}</span>
            </div>
            {parsedAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Após operação</span>
                <span className="font-medium">{formatCurrency(newGoalValue)}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contribution-amount">Valor (R$)</Label>
            <Input
              id="contribution-amount"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {isDeposit
              ? "O valor será debitado do seu saldo pessoal."
              : "O valor será creditado no seu saldo pessoal."}
          </p>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Processando..." : isDeposit ? "Confirmar depósito" : "Confirmar retirada"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
