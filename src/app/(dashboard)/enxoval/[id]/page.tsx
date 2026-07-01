import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { ContributionModal } from "@/components/goals/contribution-modal"
import { GoalCalculator } from "@/components/goals/goal-calculator"
import { getFamilyMembers } from "@/lib/family"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = { title: "Objetivo" }

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: member } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .single()
  if (!member) redirect("/onboarding")

  const { data: goal } = await supabase
    .from("savings_goals")
    .select("*")
    .eq("id", id)
    .eq("family_id", member.family_id)
    .single()

  if (!goal) notFound()

  const [{ data: contributions }, familyMembers] = await Promise.all([
    supabase
      .from("savings_contributions")
      .select("*")
      .eq("goal_id", goal.id)
      .order("created_at", { ascending: false })
      .limit(20),
    getFamilyMembers(member.family_id),
  ])

  const memberNames = Object.fromEntries(familyMembers.map((m) => [m.user_id, m.name]))

  const progress = (goal.current_value / goal.target_value) * 100
  const remaining = Math.max(goal.target_value - goal.current_value, 0)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <a href="/enxoval" className="text-muted-foreground hover:text-foreground text-sm">← Voltar</a>
      </div>

      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{goal.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Meta: {formatCurrency(goal.target_value)}
            </p>
          </div>
          <Badge variant={goal.status === "completed" ? "default" : "secondary"}>
            {goal.status === "completed" ? "✅ Concluído" : "Em andamento"}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-income">{formatCurrency(goal.current_value)}</span>
            <span className="text-muted-foreground">{formatCurrency(goal.target_value)}</span>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-3" />
          <p className="text-xs text-muted-foreground text-right">{progress.toFixed(1)}% atingido</p>
        </div>

        {goal.status === "active" && (
          <div className="flex gap-3">
            <ContributionModal
              goal={goal}
              userId={user.id}
              familyId={member.family_id}
              direction="deposit"
            />
            <ContributionModal
              goal={goal}
              userId={user.id}
              familyId={member.family_id}
              direction="withdraw"
            />
          </div>
        )}
      </div>

      {goal.status === "active" && remaining > 0 && (
        <GoalCalculator remaining={remaining} />
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Histórico</h2>
        {(contributions ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma movimentação ainda</p>
        )}
        {(contributions ?? []).map((c) => (
          <div key={c.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
            <div>
              <p className="text-sm">{c.amount > 0 ? "Depósito" : "Retirada"}</p>
              <p className="text-xs text-muted-foreground">
                {memberNames[c.user_id] ?? "Membro"} · {formatDate(c.created_at)}
              </p>
            </div>
            <p className={`font-semibold ${c.amount > 0 ? "text-income" : "text-expense"}`}>
              {c.amount > 0 ? "+" : ""}{formatCurrency(Math.abs(c.amount))}
            </p>
          </div>
        ))}
      </section>
    </div>
  )
}
