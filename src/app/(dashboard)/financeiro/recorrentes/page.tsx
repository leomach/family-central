import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext, getFamilyMembers } from "@/lib/family"
import { RecurringList } from "@/components/recurring/recurring-list"

export const metadata: Metadata = { title: "Recorrentes" }

export default async function RecorrentesPage() {
  const ctx = await getFamilyContext()
  const supabase = await createClient()

  const [recurringResult, categoriesResult, members] = await Promise.all([
    supabase
      .from("recurring_transactions")
      .select("*, category:categories(id,name,icon,type)")
      .eq("family_id", ctx.familyId)
      .order("next_run_date"),
    supabase
      .from("categories")
      .select("*")
      .or(`family_id.is.null,family_id.eq.${ctx.familyId}`)
      .order("name"),
    getFamilyMembers(ctx.familyId),
  ])

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/financeiro" className="text-muted-foreground hover:text-foreground text-sm">← Voltar</Link>
        <h1 className="text-xl font-bold">Lançamentos recorrentes</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Cadastre receitas e despesas que se repetem (salário, aluguel, Netflix). O sistema gera as transações automaticamente.
      </p>

      <RecurringList
        initial={recurringResult.data ?? []}
        categories={categoriesResult.data ?? []}
        members={members.map((m) => ({ user_id: m.user_id, name: m.name }))}
        currentUserId={ctx.userId}
      />
    </div>
  )
}
