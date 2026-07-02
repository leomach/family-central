import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatMonth } from "@/lib/utils"
import { TrendingUp, TrendingDown } from "lucide-react"

interface BalanceCardProps {
  balance: number
  income: number
  expenses: number
  month: string
}

export function BalanceCard({ balance, income, expenses, month }: BalanceCardProps) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground capitalize">{formatMonth(month)}</p>
          <p className={`text-3xl font-bold mt-1 ${balance >= 0 ? "text-income" : "text-expense"}`}>
            {formatCurrency(balance)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">saldo acumulado</p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-income/10">
              <TrendingUp className="h-3.5 w-3.5 text-income" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receitas</p>
              <p className="text-sm font-semibold text-income">{formatCurrency(income)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-expense/10">
              <TrendingDown className="h-3.5 w-3.5 text-expense" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Despesas</p>
              <p className="text-sm font-semibold text-expense">{formatCurrency(expenses)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
