"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Todo } from "@/types/database"
import { createTodo, toggleTodo, deleteTodo } from "@/actions/todos"
import { useRevalidateOnFocus } from "@/hooks/use-revalidate-on-focus"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/toaster"
import { Plus, Trash2, RefreshCw } from "lucide-react"
import { cn, formatDate } from "@/lib/utils"

interface Props {
  initialTodos: Todo[]
  members: { user_id: string; name: string }[]
  currentUserId: string
  familyId: string
}

export function TodoListView({ initialTodos, members, currentUserId }: Props) {
  const router = useRouter()
  const [todos, setTodos] = useState<Todo[]>(initialTodos)
  const [, startTransition] = useTransition()
  const [refreshing, setRefreshing] = useState(false)

  useRevalidateOnFocus({ intervalMs: 60_000 })

  if (JSON.stringify(todos.map((t) => `${t.id}:${t.completed}`)) !==
      JSON.stringify(initialTodos.map((t) => `${t.id}:${t.completed}`))) {
    setTodos(initialTodos)
  }

  function handleToggle(todo: Todo) {
    setTodos((prev) => prev.map((t) => t.id === todo.id ? { ...t, completed: !t.completed } : t))
    startTransition(async () => {
      const r = await toggleTodo(todo.id, !todo.completed)
      if (r.error) toast({ title: "Erro", description: r.error, variant: "destructive" })
      else router.refresh()
    })
  }

  function handleDelete(todo: Todo) {
    setTodos((prev) => prev.filter((t) => t.id !== todo.id))
    startTransition(async () => {
      const r = await deleteTodo(todo.id)
      if (r.error) toast({ title: "Erro", description: r.error, variant: "destructive" })
      else router.refresh()
    })
  }

  async function handleManualRefresh() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 600)
  }

  const pending = todos.filter((t) => !t.completed)
  const done = todos.filter((t) => t.completed)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="icon" onClick={handleManualRefresh} disabled={refreshing} className="h-8 w-8" aria-label="Atualizar">
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
        <NewTodoButton members={members} onCreated={() => router.refresh()} />
      </div>

      {todos.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-medium">Nenhuma tarefa</p>
          <p className="text-sm mt-1">Adicione tarefas para vocês organizarem o lar</p>
        </div>
      )}

      <div className="space-y-1.5">
        {pending.map((t) => (
          <TodoRow key={t.id} todo={t} members={members} currentUserId={currentUserId} onToggle={handleToggle} onDelete={handleDelete} />
        ))}
      </div>

      {done.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground py-1">Concluídas ({done.length})</p>
          {done.map((t) => (
            <TodoRow key={t.id} todo={t} members={members} currentUserId={currentUserId} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

function TodoRow({ todo, members, currentUserId, onToggle, onDelete }: {
  todo: Todo
  members: { user_id: string; name: string }[]
  currentUserId: string
  onToggle: (t: Todo) => void
  onDelete: (t: Todo) => void
}) {
  const assignee = members.find((m) => m.user_id === todo.assigned_to)
  const isOverdue = todo.due_date && !todo.completed && new Date(todo.due_date + "T23:59:59") < new Date()

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-card hover:bg-muted/40 group">
      <Checkbox checked={todo.completed} onCheckedChange={() => onToggle(todo)} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm font-medium", todo.completed && "line-through text-muted-foreground")}>
            {todo.title}
          </p>
          {todo.priority === "high" && !todo.completed && (
            <Badge variant="destructive" className="text-[10px] h-4 px-1.5 shrink-0">Alta</Badge>
          )}
        </div>
        {todo.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{todo.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          {assignee && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {assignee.user_id === currentUserId ? "Você" : assignee.name.split(" ")[0]}
            </Badge>
          )}
          {todo.due_date && (
            <span className={cn("text-[10px]", isOverdue ? "text-destructive" : "text-muted-foreground")}>
              {isOverdue ? "Atrasada — " : ""}{formatDate(todo.due_date)}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onDelete(todo)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-opacity"
        aria-label="Remover"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function NewTodoButton({ members, onCreated }: { members: { user_id: string; name: string }[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [assignedTo, setAssignedTo] = useState<string>("")
  const [dueDate, setDueDate] = useState("")
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const r = await createTodo({
      title,
      description: description || null,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
      priority,
    })
    setLoading(false)
    if (r.error) toast({ title: "Erro", description: r.error, variant: "destructive" })
    else {
      toast({ title: "Tarefa criada!" })
      setOpen(false); setTitle(""); setDescription(""); setAssignedTo(""); setDueDate(""); setPriority("normal")
      onCreated()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Nova tarefa</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="todo-title">Título</Label>
            <Input id="todo-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="todo-desc">Descrição (opcional)</Label>
            <Input id="todo-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Atribuir a</Label>
            <Select value={assignedTo || "none"} onValueChange={(v) => setAssignedTo(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Ninguém" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguém</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="todo-due">Vence em</Label>
              <Input id="todo-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as "low" | "normal" | "high")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading || !title.trim()}>
            {loading ? "Salvando..." : "Criar tarefa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
