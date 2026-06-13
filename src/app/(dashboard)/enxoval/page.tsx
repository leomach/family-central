import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { GoalCard } from "@/components/goals/goal-card"
import { NewGoalForm } from "@/components/goals/new-goal-form"

export const metadata: Metadata = { title: "Enxoval & Caixinhas" }

export default async function EnxovalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: member } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .single()
  if (!member) redirect("/onboarding")

  const { data: goals } = await supabase
    .from("savings_goals")
    .select("*")
    .eq("family_id", member.family_id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })

  const active = (goals ?? []).filter((g) => g.status === "active")
  const completed = (goals ?? []).filter((g) => g.status === "completed")

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Enxoval & Caixinhas</h1>
        <NewGoalForm familyId={member.family_id} />
      </div>

      {active.length === 0 && completed.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">🎯</p>
          <p className="font-medium">Nenhum objetivo ainda</p>
          <p className="text-sm mt-1">Crie uma caixinha para começar a poupar</p>
        </div>
      )}

      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Em andamento</h2>
          {active.map((goal) => (
            <Link key={goal.id} href={`/enxoval/${goal.id}`}>
              <GoalCard goal={goal} />
            </Link>
          ))}
        </section>
      )}

      {completed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Concluídos</h2>
          {completed.map((goal) => (
            <Link key={goal.id} href={`/enxoval/${goal.id}`}>
              <GoalCard goal={goal} />
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
