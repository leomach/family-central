import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext } from "@/lib/family"
import { Card, CardContent } from "@/components/ui/card"
import { NewListForm } from "@/components/shopping/new-list-form"

export const metadata: Metadata = { title: "Compras" }

export default async function ComprasPage() {
  const ctx = await getFamilyContext()
  const supabase = await createClient()

  const { data: lists } = await supabase
    .from("shopping_lists")
    .select("*")
    .eq("family_id", ctx.familyId)
    .eq("archived", false)
    .order("created_at", { ascending: false })

  // Count items per list
  const counts = new Map<string, { pending: number; total: number }>()
  if (lists && lists.length > 0) {
    const { data: items } = await supabase
      .from("shopping_items")
      .select("list_id, completed")
      .in("list_id", lists.map((l) => l.id))
    ;(items ?? []).forEach((i) => {
      const c = counts.get(i.list_id) ?? { pending: 0, total: 0 }
      c.total++
      if (!i.completed) c.pending++
      counts.set(i.list_id, c)
    })
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Listas de compras</h1>
        <NewListForm />
      </div>

      {(!lists || lists.length === 0) ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">🛒</p>
          <p className="font-medium">Nenhuma lista ainda</p>
          <p className="text-sm mt-1">Crie a primeira lista — mercado, farmácia, casa...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => {
            const c = counts.get(list.id) ?? { pending: 0, total: 0 }
            return (
              <Link key={list.id} href={`/compras/${list.id}`}>
                <Card className="hover:border-primary/40 transition-colors">
                  <CardContent className="pt-4 pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{list.icon ?? "🛒"}</span>
                      <div>
                        <p className="font-semibold">{list.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.total === 0 ? "Vazia" : `${c.pending} pendente${c.pending !== 1 ? "s" : ""} de ${c.total}`}
                        </p>
                      </div>
                    </div>
                    {c.pending > 0 && (
                      <div className="text-xs bg-primary text-primary-foreground rounded-full h-6 min-w-6 px-2 flex items-center justify-center">
                        {c.pending}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
