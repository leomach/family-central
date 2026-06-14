import { defaultCache } from "@serwist/next/worker"
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { CacheFirst, NetworkFirst, StaleWhileRevalidate, Serwist } from "serwist"
import { ExpirationPlugin } from "serwist"
import { CacheableResponsePlugin } from "serwist"

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
      handler: new CacheFirst({
        cacheName: "google-fonts",
        plugins: [
          new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
          new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
      }),
    },
    // FontAwesome CDN
    {
      matcher: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
      handler: new CacheFirst({
        cacheName: "fontawesome",
        plugins: [
          new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
          new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
      }),
    },
    // Ícones gerados dinamicamente → Cache First (30 dias)
    {
      matcher: /\/api\/icon\/.*/i,
      handler: new CacheFirst({
        cacheName: "app-icons",
        plugins: [
          new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 }),
          new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
      }),
    },
    // Imagens estáticas → Cache First (30 dias)
    {
      matcher: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: new CacheFirst({
        cacheName: "images",
        plugins: [
          new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }),
        ],
      }),
    },
    // Manifest
    {
      matcher: /\/manifest(\.webmanifest)?$/i,
      handler: new StaleWhileRevalidate({ cacheName: "manifest" }),
    },
    // Supabase REST → Network First (5s timeout, cache 1 dia)
    {
      matcher: /^https:\/\/.*\.supabase\.co\/(rest|auth)\/.*/i,
      handler: new NetworkFirst({
        cacheName: "supabase",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 }),
          new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
      }),
    },
    // Páginas Next.js (navegação) → Network First com fallback offline
    {
      matcher: ({ request }: { request: Request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages",
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }),
        ],
      }),
    },
    // RSC payloads
    {
      matcher: /\/_next\/data\/.*/i,
      handler: new StaleWhileRevalidate({ cacheName: "rsc" }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }: { request: Request }) => request.destination === "document",
      },
    ],
  },
})

sw.addEventListeners()

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
