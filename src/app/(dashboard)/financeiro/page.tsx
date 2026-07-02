import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext, getFamilyMembers } from "@/lib/family"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BalanceCard } from "@/components/finance/balance-card"
import { TransactionList } from "@/components/transactions/transaction-list"
import { TransactionForm } from "@/components/transactions/transaction-form"
import { BudgetSummary } from "@/components/finance/budget-summary"
import { TitheCard } from "@/components/finance/tithe-card"
import { MonthSelector } from "@/components/finance/month-selector"
import { currentMonthStart } from "@/lib/utils"

export const metadata: Metadata = { title: "Financeiro" }

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const ctx = await getFamilyContext()
  const supabase = await createClient()

  const params = await searchParams
  const month = params.month ?? currentMonthStart()
  const monthEnd = new Date(month)
  monthEnd.setMonth(monthEnd.getMonth() + 1)
  monthEnd.setDate(0)
  const monthEndStr = monthEnd.toISOString().split("T")[0]

  const [summaryResult, transactionsResult, categoriesResult, members, budgetsResult, proportionsResult] = await Promise.all([
    supabase.rpc("get_month_summary", { p_user_id: ctx.userId, p_month: month }),
    supabase
      .from("transactions")
      .select("*, category:categories(id,name,icon,type)")
      .eq("user_id", ctx.userId)
      .is("deleted_at", null)
      .gte("date", month)
      .lte("date", monthEndStr)
      .order("date", { ascending: false }),
    supabase
      .from("categories")
      .select("*")
      .eq("family_id", ctx.familyId)
      .order("name"),
    getFamilyMembers(ctx.familyId),
    supabase
      .from("budgets")
      .select("*, category:categories(id,name,icon,type)")
      .eq("family_id", ctx.familyId)
      .eq("month", month),
    supabase
      .from("income_proportions")
      .select("user_id, proportion")
      .eq("family_id", ctx.familyId)
      .eq("month", month),
  ])

  const transactions = transactionsResult.data ?? []
  const categories = categoriesResult.data ?? []
  const budgets = budgetsResult.data ?? []
  const proportions = Object.fromEntries(
    (proportionsResult.data ?? []).map((p) => [p.user_id, Number(p.proportion)])
  )

  // Totais do mês selecionado, servidos pelo snapshot quando disponível
  // (get_month_summary). Saldo = acumulado até o fim do mês; receita/despesa = do mês.
  const summary = summaryResult.data?.[0]
  const balance = Number(summary?.balance ?? 0)
  const income = Number(summary?.income ?? 0)
  const expenses = Number(summary?.expenses ?? 0)

  // Base do dízimo: apenas receitas genuínas (type income), sem retiradas de caixinha.
  const tithableIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Financeiro</h1>
        <div className="flex items-center gap-2">
          <MonthSelector month={month} />
          <TransactionForm
            familyId={ctx.familyId}
            userId={ctx.userId}
            categories={categories}
            familyMembers={members.map((m) => ({ user_id: m.user_id, name: m.name }))}
            proportions={proportions}
          />
        </div>
      </div>

      <BalanceCard balance={balance} income={income} expenses={expenses} month={month} />

      <TitheCard income={tithableIncome} />

      <div className="grid grid-cols-3 gap-3">
        <a href="/financeiro/recorrentes" className="flex items-center justify-center gap-2 p-3 rounded-lg bg-card hover:bg-muted text-sm border border-border">
          <span>🔁</span> Recorrentes
        </a>
        <a href="/orcamento" className="flex items-center justify-center gap-2 p-3 rounded-lg bg-card hover:bg-muted text-sm border border-border">
          <span>📊</span> Orçamento
        </a>
        <a href="/configuracoes/categorias" className="flex items-center justify-center gap-2 p-3 rounded-lg bg-card hover:bg-muted text-sm border border-border">
          <span>🏷️</span> Categorias
        </a>
      </div>

      {budgets.length > 0 && (
        <BudgetSummary budgets={budgets} transactions={transactions} />
      )}

      <Tabs defaultValue="individual">
        <TabsList className="w-full">
          <TabsTrigger value="individual" className="flex-1">Meus lançamentos</TabsTrigger>
          <TabsTrigger value="familia" className="flex-1" asChild>
            <a href={`/financeiro/familia?month=${month}`}>Visão da família</a>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="individual" className="mt-4">
          <TransactionList
            transactions={transactions}
            members={members}
            categories={categories}
            currentUserId={ctx.userId}
            emptyMessage="Nenhum lançamento este mês"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
