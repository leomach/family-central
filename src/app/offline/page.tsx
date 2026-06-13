"use client"

import { useEffect, useState } from "react"
import { onQueueChange } from "@/lib/offline-queue"
import { Button } from "@/components/ui/button"
import { WifiOff, RefreshCw, CloudOff } from "lucide-react"

export default function OfflinePage() {
  const [pending, setPending] = useState(0)
  useEffect(() => onQueueChange(setPending), [])

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-background">
      <div className="text-center space-y-5 max-w-sm">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <WifiOff className="h-9 w-9 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Sem conexão</h1>
          <p className="text-muted-foreground text-sm">
            Esta página precisa de internet. Lançamentos criados enquanto offline são salvos no seu aparelho e sincronizados automaticamente quando a conexão voltar.
          </p>
        </div>

        {pending > 0 && (
          <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 px-4 py-3 text-sm flex items-center gap-2 justify-center">
            <CloudOff className="h-4 w-4" />
            <span>{pending} pendente{pending > 1 ? "s" : ""} aguardando envio</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button onClick={() => window.location.reload()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
          <Button variant="outline" onClick={() => window.location.href = "/"}>
            Voltar ao início
          </Button>
        </div>
      </div>
    </div>
  )
}
