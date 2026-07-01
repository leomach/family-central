import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext } from "@/lib/family"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { formatCurrency, formatDateShort, currentMonthStart } from "@/lib/utils"
import { TrendingUp, Target, ListChecks, ShoppingCart, Calendar as CalendarIcon, ArrowRight } from "lucide-react"

export const metadata: Metadata = { title: "Início" }

export default async function HomePage() {
  const ctx = await getFamilyContext()
  const supabase = await createClient()
  const today = new Date().toISOString().split("T")[0]
  const month = currentMonthStart()
  const in7Days = new Date()
  in7Days.setDate(in7Days.getDate() + 7)
  const in7DaysStr = in7Days.toISOString().split("T")[0]

  const [balance, monthIncome, monthExpense, openTodos, pendingItems, upcomingEvents, activeGoals] = await Promise.all([
    supabase.rpc("get_user_balance", { p_user_id: ctx.userId }),
    supabase.from("transactions")
      .select("amount").eq("user_id", ctx.userId).in("type", ["income", "transfer_in"])
      .is("deleted_at", null).gte("date", month),
    supabase.from("transactions")
      .select("amount").eq("user_id", ctx.userId).in("type", ["expense", "transfer_out"])
      .is("deleted_at", null).gte("date", month),
    supabase.from("todos")
      .select("id,title,priority,due_date,assigned_to")
      .eq("family_id", ctx.familyId).eq("completed", false)
      .order("due_date", { ascending: true, nullsFirst: false }).limit(5),
    supabase.from("shopping_items")
      .select("id,name,list_id,shopping_lists(name,icon)")
      .eq("family_id", ctx.familyId).eq("completed", false)
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("events")
      .select("*")
      .eq("family_id", ctx.familyId)
      .gte("event_date", today).lte("event_date", in7DaysStr)
      .order("event_date").limit(5),
    supabase.from("savings_goals")
      .select("*")
      .eq("family_id", ctx.familyId).eq("status", "active")
      .order("created_at", { ascending: false }).limit(3),
  ])

  const income = (monthIncome.data ?? []).reduce((s, t) => s + Number(t.amount), 0)
  const expense = (monthExpense.data ?? []).reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Olá, {ctx.userName.split(" ")[0]} 👋</p>
        <h1 className="text-2xl font-bold mt-0.5">Bem-vindo de volta</h1>
      </div>

      {/* Saldo card */}
      <Link href="/financeiro" className="block">
        <Card className="hover:border-primary/40 transition-colors">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Seu saldo</p>
                <p className={`text-3xl font-bold mt-1 ${(balance.data ?? 0) >= 0 ? "text-income" : "text-expense"}`}>
                  {formatCurrency(balance.data ?? 0)}
                </p>
                <div className="flex gap-3 mt-2 text-xs">
                  <span className="text-income">↑ {formatCurrency(income)}</span>
                  <span className="text-expense">↓ {formatCurrency(expense)}</span>
                </div>
              </div>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        <QuickAction href="/compras" icon={<ShoppingCart className="h-5 w-5" />} label="Compras" />
        <QuickAction href="/tarefas" icon={<ListChecks className="h-5 w-5" />} label="Tarefas" />
        <QuickAction href="/enxoval" icon={<Target className="h-5 w-5" />} label="Caixinhas" />
        <QuickAction href="/calendario" icon={<CalendarIcon className="h-5 w-5" />} label="Agenda" />
      </div>

      {/* Tarefas pendentes */}
      {(openTodos.data ?? []).length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Tarefas pendentes</CardTitle>
            <Link href="/tarefas" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
              ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-0">
            {(openTodos.data ?? []).map((t) => (
              <Link key={t.id} href="/tarefas" className="flex items-center justify-between py-2 border-b border-border last:border-0 hover:opacity-80">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm truncate">{t.title}</span>
                  {t.priority === "high" && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">!</Badge>}
                </div>
                {t.due_date && <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatDateShort(t.due_date)}</span>}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Itens de compra */}
      {(pendingItems.data ?? []).length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Lista de compras</CardTitle>
            <Link href="/compras" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
              ver listas <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-0">
            {(pendingItems.data ?? []).map((i) => {
              const list = (i as { shopping_lists?: { name: string; icon: string } }).shopping_lists
              return (
                <Link key={i.id} href={`/compras/${i.list_id}`} className="flex items-center justify-between py-2 border-b border-border last:border-0 hover:opacity-80">
                  <span className="text-sm">{list?.icon ?? "🛒"} {i.name}</span>
                  <span className="text-xs text-muted-foreground">{list?.name}</span>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Próximos eventos */}
      {(upcomingEvents.data ?? []).length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Próximos 7 dias</CardTitle>
            <Link href="/calendario" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
              ver agenda <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-0">
            {(upcomingEvents.data ?? []).map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <span>{e.icon ?? eventTypeIcon(e.type)}</span>
                  <span className="text-sm">{e.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateShort(e.event_date)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Metas ativas */}
      {(activeGoals.data ?? []).length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Caixinhas em andamento</CardTitle>
            <Link href="/enxoval" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
              ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {(activeGoals.data ?? []).map((g) => {
              const p = Math.min((Number(g.current_value) / Number(g.target_value)) * 100, 100)
              return (
                <Link key={g.id} href={`/enxoval/${g.id}`} className="block space-y-1 hover:opacity-80">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{g.name}</span>
                    <span className="text-xs text-muted-foreground">{p.toFixed(0)}%</span>
                  </div>
                  <Progress value={p} className="h-1.5" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="text-income">{formatCurrency(Number(g.current_value))}</span>
                    <span>{formatCurrency(Number(g.target_value))}</span>
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-card hover:bg-muted border border-border transition-colors">
      <div className="text-foreground">{icon}</div>
      <span className="text-xs">{label}</span>
    </Link>
  )
}

function eventTypeIcon(type: string) {
  return { reminder: "🔔", anniversary: "🎉", bill: "💸", appointment: "📅", goal: "🎯" }[type] ?? "📅"
}
