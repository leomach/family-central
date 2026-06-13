"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function useRevalidateOnFocus({ intervalMs = 0 }: { intervalMs?: number } = {}) {
  const router = useRouter()

  useEffect(() => {
    let lastRefresh = Date.now()
    const refresh = () => {
      lastRefresh = Date.now()
      router.refresh()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - lastRefresh > 5000) refresh()
      }
    }

    const onFocus = () => {
      if (Date.now() - lastRefresh > 5000) refresh()
    }

    const onOnline = () => refresh()

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("focus", onFocus)
    window.addEventListener("online", onOnline)

    let interval: ReturnType<typeof setInterval> | null = null
    if (intervalMs > 0) {
      interval = setInterval(() => {
        if (document.visibilityState === "visible" && navigator.onLine) refresh()
      }, intervalMs)
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("online", onOnline)
      if (interval) clearInterval(interval)
    }
  }, [router, intervalMs])
}
