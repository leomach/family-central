"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createCategory, updateCategory, deleteCategory } from "@/actions/categories"
import type { Category } from "@/types/database"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "@/components/ui/toaster"
import { Plus, Pencil, Trash2 } from "lucide-react"

type CategoryType = "income" | "expense"

export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const expenses = categories.filter((c) => c.type === "expense")
  const income = categories.filter((c) => c.type === "income")

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(category: Category) {
    setEditing(category)
    setFormOpen(true)
  }

  async function handleDelete() {
    if (!deleting) return
    const result = await deleteCategory(deleting.id)
    if (result.error) {
      toast({ title: "Erro ao excluir", description: result.error, variant: "destructive" })
    } else {
      toast({ title: "Categoria excluída" })
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova categoria
        </Button>
      </div>

      <CategoryGroup title="Despesas" items={expenses} onEdit={openEdit} onDelete={setDeleting} />
      <CategoryGroup title="Receitas" items={income} onEdit={openEdit} onDelete={setDeleting} />

      <CategoryFormDialog
        key={editing?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editing}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Excluir "${deleting?.name}"?`}
        description="Lançamentos existentes ficarão sem categoria e orçamentos vinculados a ela serão removidos. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}

function CategoryGroup({
  title,
  items,
  onEdit,
  onDelete,
}: {
  title: string
  items: Category[]
  onEdit: (c: Category) => void
  onDelete: (c: Category) => void
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Nenhuma categoria cadastrada</p>
        ) : (
          items.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-1.5">
              <span className="flex items-center gap-2 text-sm">
                <span className="w-6 text-center">{c.icon}</span>
                {c.name}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(c)} aria-label="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(c)} aria-label="Excluir">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  onSaved: () => void
}) {
  const [type, setType] = useState<CategoryType>(category?.type ?? "expense")
  const [name, setName] = useState(category?.name ?? "")
  const [icon, setIcon] = useState(category?.icon ?? "")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast({ title: "Informe um nome", variant: "destructive" })
      return
    }
    setLoading(true)
    const payload = { name: name.trim(), type, icon: icon.trim() || null }
    const result = category
      ? await updateCategory({ id: category.id, ...payload })
      : await createCategory(payload)
    setLoading(false)

    if (result.error) {
      toast({ title: "Erro ao salvar", description: result.error, variant: "destructive" })
      return
    }
    toast({ title: category ? "Categoria atualizada" : "Categoria criada" })
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="flex rounded-md overflow-hidden border border-input">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium transition-colors ${type === "expense" ? "bg-expense text-white" : "text-muted-foreground hover:bg-muted"}`}
              onClick={() => setType("expense")}
            >
              Despesa
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium transition-colors ${type === "income" ? "bg-income text-white" : "text-muted-foreground hover:bg-muted"}`}
              onClick={() => setType("income")}
            >
              Receita
            </button>
          </div>

          <div className="flex gap-2">
            <div className="space-y-2 w-20">
              <Label htmlFor="icon">Ícone</Label>
              <Input
                id="icon"
                placeholder="🏠"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="text-center"
                maxLength={8}
              />
            </div>
            <div className="space-y-2 flex-1">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" placeholder="Ex: Pets" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Salvar categoria"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
