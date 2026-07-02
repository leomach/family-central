import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { Church } from "lucide-react"

interface TitheCardProps {
  // Receita genuína do mês (apenas type = income; não inclui retiradas de caixinha).
  income: number
}

export function TitheCard({ income }: TitheCardProps) {
  const tithe = Math.round(income * 0.1 * 100) / 100

  return (
    <Card>
      <CardContent className="py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Church className="h-4 w-4 shrink-0" />
          <span className="text-sm">Dízimo esperado do mês</span>
          <span className="text-xs">(10%)</span>
        </div>
        <span className="text-sm font-semibold text-primary whitespace-nowrap">{formatCurrency(tithe)}</span>
      </CardContent>
    </Card>
  )
}
