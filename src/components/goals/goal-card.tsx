import type { SavingsGoal } from "@/types/database"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

export function GoalCard({ goal }: { goal: SavingsGoal }) {
  const progress = Math.min((goal.current_value / goal.target_value) * 100, 100)
  const remaining = Math.max(goal.target_value - goal.current_value, 0)

  return (
    <Card className="hover:border-primary/50 transition-colors cursor-pointer">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start justify-between">
          <p className="font-semibold">{goal.name}</p>
          {goal.status === "completed" && <Badge className="shrink-0 ml-2">✅ Concluído</Badge>}
        </div>

        <div className="space-y-1.5">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="text-income font-medium">{formatCurrency(goal.current_value)}</span>
            <span>{progress.toFixed(0)}% — faltam {formatCurrency(remaining)}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">Meta: {formatCurrency(goal.target_value)}</p>
      </CardContent>
    </Card>
  )
}
