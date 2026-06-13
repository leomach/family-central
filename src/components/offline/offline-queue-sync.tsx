"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { flushQueue, onQueueChange } from "@/lib/offline-queue"
import { toast } from "@/components/ui/toaster"

export function OfflineQueueSync() {
  const router = useRouter()

  useEffect(() => {
    let lastCount = 0
    const off = onQueueChange((count) => { lastCount = count })

    async function tryFlush() {
      if (!navigator.onLine) return
      const r = await flushQueue()
      if (r.done > 0) {
        toast({
          title: `${r.done} sincronizado${r.done > 1 ? "s" : ""}`,
          description: r.failed > 0 ? `${r.failed} ainda pendente${r.failed > 1 ? "s" : ""}` : undefined,
        })
        router.refresh()
      }
    }

    function onOnline() { tryFlush() }
    function onVisible() {
      if (document.visibilityState === "visible") tryFlush()
    }

    window.addEventListener("online", onOnline)
    document.addEventListener("visibilitychange", onVisible)

    // Tenta logo no mount caso já esteja online com pendentes
    setTimeout(tryFlush, 800)

    // Listener de mensagem do service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (e) => {
        if (e.data?.type === "FLUSH_QUEUE") tryFlush()
      })
    }

    // Periódico: a cada 2 min, se online + há pendentes
    const interval = setInterval(() => {
      if (navigator.onLine && lastCount > 0) tryFlush()
    }, 2 * 60 * 1000)

    return () => {
      off()
      window.removeEventListener("online", onOnline)
      document.removeEventListener("visibilitychange", onVisible)
      clearInterval(interval)
    }
  }, [router])

  return null
}
