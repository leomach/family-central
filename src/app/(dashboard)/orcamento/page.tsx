import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext } from "@/lib/family"
import { BudgetManager } from "@/components/finance/budget-manager"
import { currentMonthStart } from "@/lib/utils"

export const metadata: Metadata = { title: "Orçamento" }

export default async function OrcamentoPage({
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

  const [budgetsResult, categoriesResult, transactionsResult] = await Promise.all([
    supabase
      .from("budgets")
      .select("*, category:categories(id,name,icon,type)")
      .eq("family_id", ctx.familyId)
      .eq("month", month),
    supabase
      .from("categories")
      .select("*")
      .or(`family_id.is.null,family_id.eq.${ctx.familyId}`)
      .eq("type", "expense")
      .order("name"),
    supabase
      .from("transactions")
      .select("category_id, amount")
      .eq("family_id", ctx.familyId)
      .is("deleted_at", null)
      .in("type", ["expense"])
      .gte("date", month)
      .lte("date", monthEnd.toISOString().split("T")[0]),
  ])

  const spentByCategory = new Map<string, number>()
  ;(transactionsResult.data ?? []).forEach((t) => {
    if (t.category_id) {
      spentByCategory.set(t.category_id, (spentByCategory.get(t.category_id) ?? 0) + Number(t.amount))
    }
  })

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Orçamento mensal</h1>
      <BudgetManager
        month={month}
        budgets={budgetsResult.data ?? []}
        categories={categoriesResult.data ?? []}
        spentByCategory={Object.fromEntries(spentByCategory)}
      />
    </div>
  )
}
