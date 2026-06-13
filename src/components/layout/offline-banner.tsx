"use client"

import { useOnline } from "@/hooks/use-online"
import { PendingQueueBadge } from "@/components/offline/pending-queue-badge"
import { WifiOff } from "lucide-react"

export function OfflineBanner() {
  const online = useOnline()

  if (online) {
    return (
      <div className="sticky top-0 z-30 flex justify-end px-4 pt-2">
        <PendingQueueBadge />
      </div>
    )
  }

  return (
    <div className="bg-amber-500/15 text-amber-200 border-b border-amber-500/30 px-4 py-2 sticky top-0 z-30 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <span>Sem conexão — alterações serão sincronizadas quando voltar online.</span>
      </div>
      <PendingQueueBadge />
    </div>
  )
}
