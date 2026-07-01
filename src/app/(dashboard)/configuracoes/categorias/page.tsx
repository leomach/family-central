import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext } from "@/lib/family"
import { CategoryManager } from "@/components/categories/category-manager"

export const metadata: Metadata = { title: "Categorias" }

export default async function CategoriasPage() {
  const ctx = await getFamilyContext()
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("family_id", ctx.familyId)
    .order("name")

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/configuracoes" className="text-muted-foreground hover:text-foreground text-sm">← Voltar</Link>
        <h1 className="text-xl font-bold">Categorias financeiras</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Personalize as categorias usadas em lançamentos, orçamentos e recorrentes. Você pode criar, editar e excluir as categorias da sua família.
      </p>

      <CategoryManager categories={categories ?? []} />
    </div>
  )
}
