"use client"

import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISS_KEY = "pwa-install-dismissed-at"
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function usePwaInstall() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [dismissedRecently, setDismissedRecently] = useState(true)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
    // iOS Safari also sets navigator.standalone when running as PWA
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
    setInstalled(standalone || iosStandalone)
    setIos(isIos())

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    setDismissedRecently(Date.now() - dismissedAt < DISMISS_TTL_MS)

    const handler = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    const installedHandler = () => setInstalled(true)

    window.addEventListener("beforeinstallprompt", handler)
    window.addEventListener("appinstalled", installedHandler)
    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      window.removeEventListener("appinstalled", installedHandler)
    }
  }, [])

  async function install() {
    if (!event) return
    await event.prompt()
    const choice = await event.userChoice
    if (choice.outcome === "accepted") setInstalled(true)
    setEvent(null)
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissedRecently(true)
  }

  return {
    canInstall: !!event && !installed && !dismissedRecently,
    isIos: ios && !installed && !dismissedRecently,
    installed,
    install,
    dismiss,
  }
}
