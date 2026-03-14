/**
 * Service Worker — Next.js 16 compatible manual PWA setup.
 *
 * Why manual: next-pwa doesn't support Next.js 16 App Router reliably.
 * This is the battle-tested alternative (see PLAYBOOK §5).
 *
 * Strategy:
 * - Navigation requests: network-first (always get fresh HTML)
 * - Static assets (JS/CSS/images/fonts): stale-while-revalidate
 *
 * Update CACHE_NAME when you want to force all clients to refresh.
 */

const CACHE_NAME = "app-v1"

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event

  if (request.method !== "GET") return
  if (!request.url.startsWith("http")) return

  // Navigation: network-first
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    )
    return
  }

  // Static assets: stale-while-revalidate
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetched = fetch(request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
          }
          return response
        })
        return cached || fetched
      })
    )
  }
})
