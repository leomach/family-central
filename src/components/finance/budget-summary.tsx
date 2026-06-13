import Link from "next/link"
import type { Budget, Transaction } from "@/types/database"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, cn } from "@/lib/utils"

interface Props { budgets: Budget[]; transactions: Transaction[] }

export function BudgetSummary({ budgets, transactions }: Props) {
  const spent = new Map<string, number>()
  transactions
    .filter((t) => t.type === "expense" && t.category_id)
    .forEach((t) => spent.set(t.category_id!, (spent.get(t.category_id!) ?? 0) + Number(t.amount)))

  const totalLimit = budgets.reduce((s, b) => s + Number(b.limit_amount), 0)
  const totalSpent = budgets.reduce((s, b) => s + (spent.get(b.category_id) ?? 0), 0)
  const percent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0

  return (
    <Link href="/orcamento" className="block">
      <Card className="hover:border-primary/40 transition-colors">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-normal text-muted-foreground flex items-center justify-between">
            <span>Orçamento do mês</span>
            <span className="text-xs">{budgets.length} categoria{budgets.length !== 1 ? "s" : ""}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline justify-between mb-2">
            <p className={cn("text-base font-semibold", percent > 100 ? "text-destructive" : "text-foreground")}>
              {formatCurrency(totalSpent)}
            </p>
            <p className="text-xs text-muted-foreground">de {formatCurrency(totalLimit)}</p>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all rounded-full",
                percent > 100 ? "bg-destructive" : percent > 80 ? "bg-amber-500" : "bg-income"
              )}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
