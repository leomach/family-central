"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createShoppingList } from "@/actions/shopping"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toaster"
import { Plus } from "lucide-react"

const ICONS = ["🛒", "🏠", "💊", "👶", "🎁", "🌱", "🐶", "🍞"]

export function NewListForm() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("🛒")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const r = await createShoppingList(name, icon)
    setLoading(false)
    if (r.error) toast({ title: "Erro", description: r.error, variant: "destructive" })
    else {
      toast({ title: "Lista criada!" })
      setOpen(false)
      setName("")
      if (r.id) router.push(`/compras/${r.id}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Nova lista</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nova lista</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="list-name">Nome</Label>
            <Input id="list-name" placeholder="Ex: Mercado da semana" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Ícone</Label>
            <div className="flex gap-2 flex-wrap">
              {ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className={`h-10 w-10 rounded-md text-xl border ${icon === i ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando..." : "Criar lista"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
