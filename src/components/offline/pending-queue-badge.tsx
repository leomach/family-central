"use client"

import { useEffect, useState } from "react"
import { onQueueChange, flushQueue } from "@/lib/offline-queue"
import { CloudOff } from "lucide-react"

export function PendingQueueBadge() {
  const [count, setCount] = useState(0)
  const [flushing, setFlushing] = useState(false)

  useEffect(() => onQueueChange(setCount), [])

  if (count === 0) return null

  async function handleFlush() {
    setFlushing(true)
    await flushQueue()
    setFlushing(false)
  }

  return (
    <button
      onClick={handleFlush}
      disabled={flushing}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/15 text-amber-200 border border-amber-500/30 text-xs hover:bg-amber-500/25 transition-colors"
      aria-label={`${count} ${count === 1 ? "lançamento pendente" : "lançamentos pendentes"} — clique para tentar enviar`}
    >
      <CloudOff className="h-3.5 w-3.5" />
      <span>{count} pendente{count > 1 ? "s" : ""}</span>
    </button>
  )
}
