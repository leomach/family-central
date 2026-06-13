"use client"

import { get, set, del } from "idb-keyval"

export type QueueOp =
  | { kind: "transaction"; payload: TransactionPayload }
  | { kind: "todo"; payload: TodoPayload }
  | { kind: "shopping_item"; payload: ShoppingItemPayload }

export type TransactionPayload = {
  type: "income" | "expense"
  amount: number
  description: string
  category_id: string | null
  date: string
  familyId: string
  participants?: string[]
}

export type TodoPayload = {
  title: string
  description: string | null
  assigned_to: string | null
  due_date: string | null
  priority: "low" | "normal" | "high"
}

export type ShoppingItemPayload = {
  list_id: string
  name: string
  quantity: number
  unit?: string | null
  estimated_price?: number | null
  notes?: string | null
}

export type QueueItem = QueueOp & {
  id: string
  createdAt: number
  attempts: number
  lastError?: string
}

const KEY = "family-central:offline-queue:v1"

export async function enqueue(op: QueueOp): Promise<QueueItem> {
  const queue = await getQueue()
  const item: QueueItem = {
    ...op,
    id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()),
    createdAt: Date.now(),
    attempts: 0,
  }
  queue.push(item)
  await set(KEY, queue)

  // Tenta registrar background sync
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      const sync = (reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync
      if (sync) await sync.register("flush-queue")
    } catch { /* iOS Safari não suporta */ }
  }
  notifyListeners()
  return item
}

export async function getQueue(): Promise<QueueItem[]> {
  return (await get<QueueItem[]>(KEY)) ?? []
}

export async function setQueue(queue: QueueItem[]) {
  if (queue.length === 0) await del(KEY)
  else await set(KEY, queue)
  notifyListeners()
}

export async function removeFromQueue(id: string) {
  const queue = await getQueue()
  await setQueue(queue.filter((q) => q.id !== id))
}

type Listener = (count: number) => void
const listeners = new Set<Listener>()

export function onQueueChange(listener: Listener): () => void {
  listeners.add(listener)
  getQueue().then((q) => listener(q.length))
  return () => { listeners.delete(listener) }
}

async function notifyListeners() {
  const q = await getQueue()
  listeners.forEach((l) => l(q.length))
}

// Importações dinâmicas para evitar incluir actions em todos os bundles
export async function flushQueue(): Promise<{ done: number; failed: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { done: 0, failed: 0 }

  const queue = await getQueue()
  if (queue.length === 0) return { done: 0, failed: 0 }

  let done = 0
  let failed = 0
  const remaining: QueueItem[] = []

  for (const item of queue) {
    try {
      const ok = await runItem(item)
      if (ok) done++
      else {
        remaining.push({ ...item, attempts: item.attempts + 1, lastError: "falha desconhecida" })
        failed++
      }
    } catch (e) {
      remaining.push({
        ...item,
        attempts: item.attempts + 1,
        lastError: e instanceof Error ? e.message : "erro",
      })
      failed++
    }
  }

  await setQueue(remaining)
  return { done, failed }
}

async function runItem(item: QueueItem): Promise<boolean> {
  switch (item.kind) {
    case "transaction": {
      const { createTransaction } = await import("@/actions/transactions")
      const r = await createTransaction(item.payload)
      return !r.error
    }
    case "todo": {
      const { createTodo } = await import("@/actions/todos")
      const r = await createTodo(item.payload)
      return !r.error
    }
    case "shopping_item": {
      const { addShoppingItem } = await import("@/actions/shopping")
      const r = await addShoppingItem(item.payload)
      return !r.error
    }
  }
}
