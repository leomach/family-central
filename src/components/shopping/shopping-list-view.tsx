"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ShoppingList, ShoppingItem } from "@/types/database"
import { addShoppingItem, toggleItem, deleteItem, clearCompletedItems } from "@/actions/shopping"
import { useRevalidateOnFocus } from "@/hooks/use-revalidate-on-focus"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/toaster"
import { formatCurrency, cn } from "@/lib/utils"
import { Trash2, Plus, RefreshCw } from "lucide-react"

interface Props { list: ShoppingList; initialItems: ShoppingItem[] }

export function ShoppingListView({ list, initialItems }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<ShoppingItem[]>(initialItems)
  const [newName, setNewName] = useState("")
  const [, startTransition] = useTransition()
  const [refreshing, setRefreshing] = useState(false)

  useRevalidateOnFocus({ intervalMs: 60_000 })

  function syncFromProps() {
    setItems(initialItems)
  }
  if (JSON.stringify(items.map((i) => i.id)) !== JSON.stringify(initialItems.map((i) => i.id))) {
    syncFromProps()
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const tempId = `temp-${Date.now()}`
    const optimistic: ShoppingItem = {
      id: tempId, list_id: list.id, family_id: list.family_id,
      name: newName.trim(), quantity: 1, unit: null, estimated_price: null, notes: null,
      completed: false, completed_at: null, completed_by: null,
      added_by: "", created_at: new Date().toISOString(),
    }
    setItems((prev) => [optimistic, ...prev])
    setNewName("")
    const r = await addShoppingItem({ list_id: list.id, name: optimistic.name, quantity: 1 })
    if (r.error) {
      setItems((prev) => prev.filter((i) => i.id !== tempId))
      toast({ title: "Erro ao adicionar", description: r.error, variant: "destructive" })
    } else {
      router.refresh()
    }
  }

  function handleToggle(item: ShoppingItem) {
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, completed: !i.completed } : i))
    startTransition(async () => {
      const r = await toggleItem(item.id, !item.completed)
      if (r.error) toast({ title: "Erro", description: r.error, variant: "destructive" })
      else router.refresh()
    })
  }

  function handleDelete(item: ShoppingItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    startTransition(async () => {
      const r = await deleteItem(item.id)
      if (r.error) toast({ title: "Erro", description: r.error, variant: "destructive" })
      else router.refresh()
    })
  }

  async function handleClearCompleted() {
    const completed = items.filter((i) => i.completed)
    if (completed.length === 0) return
    setItems((prev) => prev.filter((i) => !i.completed))
    const r = await clearCompletedItems(list.id)
    if (r.error) toast({ title: "Erro", description: r.error, variant: "destructive" })
    else router.refresh()
  }

  async function handleManualRefresh() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 600)
  }

  const pending = items.filter((i) => !i.completed)
  const done = items.filter((i) => i.completed)
  const estimatedTotal = pending.reduce((s, i) => s + Number(i.estimated_price ?? 0) * Number(i.quantity), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span>{list.icon ?? "🛒"}</span>{list.name}
          </h1>
          {estimatedTotal > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Estimativa: {formatCurrency(estimatedTotal)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleManualRefresh} disabled={refreshing} className="h-8 w-8" aria-label="Atualizar">
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
          {done.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearCompleted}>
              Limpar concluídos ({done.length})
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          placeholder="Adicionar item..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          autoFocus
        />
        <Button type="submit" size="icon" disabled={!newName.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      <div className="space-y-1">
        {pending.map((item) => (
          <ItemRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete} />
        ))}
      </div>

      {done.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground py-1">Concluídos</p>
          {done.map((item) => (
            <ItemRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Lista vazia. Adicione o primeiro item acima.
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, onToggle, onDelete }: {
  item: ShoppingItem
  onToggle: (i: ShoppingItem) => void
  onDelete: (i: ShoppingItem) => void
}) {
  return (
    <div className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 group">
      <Checkbox
        checked={item.completed}
        onCheckedChange={() => onToggle(item)}
      />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", item.completed && "line-through text-muted-foreground")}>
          {item.name}
          {item.quantity > 1 && <span className="text-muted-foreground ml-1">×{item.quantity}</span>}
        </p>
      </div>
      <button
        onClick={() => onDelete(item)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-opacity"
        aria-label="Remover"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
