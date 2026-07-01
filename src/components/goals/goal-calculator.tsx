"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils"
import { Calculator } from "lucide-react"

interface GoalCalculatorProps {
  remaining: number
}

export function GoalCalculator({ remaining }: GoalCalculatorProps) {
  const [months, setMonths] = useState("12")

  const parsedMonths = Math.max(1, parseInt(months) || 1)
  const monthly = remaining / parsedMonths

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Simulador</h2>
      </div>

      <div className="bg-muted rounded-lg p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sim-months">Em quantos meses quer concluir?</Label>
          <Input
            id="sim-months"
            type="number"
            min="1"
            max="360"
            inputMode="numeric"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            className="max-w-[120px]"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Aporte mensal necessário</span>
          <span className="text-lg font-bold text-income">{formatCurrency(monthly)}</span>
        </div>

        {parsedMonths > 1 && (
          <p className="text-xs text-muted-foreground">
            {parsedMonths}x de {formatCurrency(monthly)} = {formatCurrency(remaining)} restante
          </p>
        )}
      </div>
    </section>
  )
}
