import { defaultCache } from "@serwist/next/worker"
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { Serwist } from "serwist"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[]
  }
}

declare const self: ServiceWorkerGlobalScope

const sw = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Fontes Google → Cache First (1 ano)
    {
      matcher: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts",
        expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // FontAwesome CDN
    {
      matcher: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "fontawesome",
        expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Ícones gerados dinamicamente → Cache First (30 dias)
    {
      matcher: /\/api\/icon\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "app-icons",
        expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Imagens estáticas → Cache First (30 dias)
    {
      matcher: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "images",
        expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    // Manifest
    {
      matcher: /\/manifest(\.webmanifest)?$/i,
      handler: "StaleWhileRevalidate",
      options: { cacheName: "manifest" },
    },
    // Supabase REST → Network First (5s timeout, cache 1 dia)
    {
      matcher: /^https:\/\/.*\.supabase\.co\/(rest|auth)\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "supabase",
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Páginas Next.js (navegação) → Network First com fallback offline
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: "NetworkFirst",
      options: {
        cacheName: "pages",
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
    // RSC payloads
    {
      matcher: /\/_next\/data\/.*/i,
      handler: "StaleWhileRevalidate",
      options: { cacheName: "rsc" },
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
})

sw.addEventListeners()

// Background Sync → quando o navegador detecta volta da conexão, ele dispara este evento.
// Apenas notifica o cliente, que executa o flush usando as Server Actions já autenticadas.
self.addEventListener("sync", (event) => {
  const e = event as ExtendableEvent & { tag: string }
  if (e.tag === "flush-queue") {
    e.waitUntil(notifyClientsToFlush())
  }
})

async function notifyClientsToFlush() {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
  clients.forEach((client) => client.postMessage({ type: "FLUSH_QUEUE" }))
}

// Push Notifications: estrutura pronta, aguarda Server Action de envio
self.addEventListener("push", (event) => {
  if (!event.data) return
  try {
    const data = event.data.json() as { title: string; body?: string; url?: string }
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/api/icon/192",
        badge: "/api/icon/96",
        data: { url: data.url ?? "/" },
      })
    )
  } catch {
    // payload inválido
  }
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string })?.url ?? "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
