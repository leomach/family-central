import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getFamilyContext, getFamilyMembers } from "@/lib/family"
import { TodoListView } from "@/components/todos/todo-list-view"

export const metadata: Metadata = { title: "Tarefas" }

export default async function TarefasPage() {
  const ctx = await getFamilyContext()
  const supabase = await createClient()

  const [todosResult, members] = await Promise.all([
    supabase.from("todos")
      .select("*")
      .eq("family_id", ctx.familyId)
      .order("completed")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    getFamilyMembers(ctx.familyId),
  ])

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Tarefas compartilhadas</h1>
      <TodoListView
        initialTodos={todosResult.data ?? []}
        members={members.map((m) => ({ user_id: m.user_id, name: m.name }))}
        currentUserId={ctx.userId}
        familyId={ctx.familyId}
      />
    </div>
  )
}
