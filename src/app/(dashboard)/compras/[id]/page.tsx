import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext } from "@/lib/family"
import { ShoppingListView } from "@/components/shopping/shopping-list-view"

export const metadata: Metadata = { title: "Lista" }

export default async function ListaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getFamilyContext()
  const supabase = await createClient()

  const { data: list } = await supabase
    .from("shopping_lists")
    .select("*")
    .eq("id", id)
    .eq("family_id", ctx.familyId)
    .single()

  if (!list) notFound()

  const { data: items } = await supabase
    .from("shopping_items")
    .select("*")
    .eq("list_id", list.id)
    .order("completed")
    .order("created_at", { ascending: false })

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/compras" className="text-muted-foreground hover:text-foreground text-sm">← Listas</Link>
      </div>
      <ShoppingListView list={list} initialItems={items ?? []} />
    </div>
  )
}
