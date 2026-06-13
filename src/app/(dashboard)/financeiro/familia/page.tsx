import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext, getFamilyMembers } from "@/lib/family"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TransactionList } from "@/components/transactions/transaction-list"
import { formatCurrency, currentMonthStart } from "@/lib/utils"

export const metadata: Metadata = { title: "Visão da Família" }

export default async function FamiliaFinanceiroPage() {
  const ctx = await getFamilyContext()
  const supabase = await createClient()

  const month = currentMonthStart()
  const monthEnd = new Date(month)
  monthEnd.setMonth(monthEnd.getMonth() + 1)
  monthEnd.setDate(0)
  const monthEndStr = monthEnd.toISOString().split("T")[0]

  const [transactionsResult, proportionsResult, members] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, category:categories(id,name,icon,type)")
      .eq("family_id", ctx.familyId)
      .is("deleted_at", null)
      .gte("date", month)
      .lte("date", monthEndStr)
      .order("date", { ascending: false }),
    supabase
      .from("income_proportions")
      .select("*")
      .eq("family_id", ctx.familyId)
      .eq("month", month),
    getFamilyMembers(ctx.familyId),
  ])

  const transactions = transactionsResult.data ?? []
  const proportions = proportionsResult.data ?? []

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const totalExpenses = transactions
    .filter((t) => t.type === "expense" || t.type === "transfer_out")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const perMember = members.map((m) => {
    const inc = transactions
      .filter((t) => t.user_id === m.user_id && t.type === "income")
      .reduce((s, t) => s + Number(t.amount), 0)
    const exp = transactions
      .filter((t) => t.user_id === m.user_id && (t.type === "expense" || t.type === "transfer_out"))
      .reduce((s, t) => s + Number(t.amount), 0)
    const proportion = Number(proportions.find((p) => p.user_id === m.user_id)?.proportion ?? 0)
    return { ...m, inc, exp, proportion }
  })

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/financeiro" className="text-muted-foreground hover:text-foreground text-sm">← Voltar</Link>
        <h1 className="text-xl font-bold">Visão da Família</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">Receita total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-income">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">Despesas totais</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-expense">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proporção de renda este mês</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {perMember.map((m) => (
            <div key={m.user_id} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{m.user_id === ctx.userId ? `${m.name} (você)` : m.name}</span>
                <span className="font-semibold">{(m.proportion * 100).toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${m.proportion * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Receita: <span className="text-income">{formatCurrency(m.inc)}</span></span>
                <span>Despesas: <span className="text-expense">{formatCurrency(m.exp)}</span></span>
              </div>
            </div>
          ))}
          {perMember.every((m) => m.proportion === 0) && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Cadastre receitas no mês para calcular a proporção
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="all">
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">Todos</TabsTrigger>
          <TabsTrigger value="shared" className="flex-1">Compartilhados</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <TransactionList transactions={transactions} members={members} showOwner emptyMessage="Nenhum lançamento este mês" />
        </TabsContent>
        <TabsContent value="shared" className="mt-4">
          <TransactionList
            transactions={transactions.filter((t) => t.group_id)}
            members={members}
            showOwner
            emptyMessage="Nenhum lançamento compartilhado"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
