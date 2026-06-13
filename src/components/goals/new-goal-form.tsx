"use client"

import { useState } from "react"
import { createGoal } from "@/actions/goals"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toaster"
import { Plus } from "lucide-react"

export function NewGoalForm({ familyId }: { familyId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [targetValue, setTargetValue] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = parseFloat(targetValue.replace(",", "."))
    if (isNaN(value) || value <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" })
      return
    }
    setLoading(true)
    const result = await createGoal({ name, target_value: value, familyId })
    if (result.error) {
      toast({ title: "Erro", description: result.error, variant: "destructive" })
    } else {
      toast({ title: "Objetivo criado!" })
      setOpen(false)
      setName("")
      setTargetValue("")
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nova caixinha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova caixinha</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="goal-name">Nome do objetivo</Label>
            <Input
              id="goal-name"
              placeholder="Ex: Geladeira, Viagem..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-value">Valor da meta (R$)</Label>
            <Input
              id="goal-value"
              inputMode="decimal"
              placeholder="0,00"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando..." : "Criar objetivo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
