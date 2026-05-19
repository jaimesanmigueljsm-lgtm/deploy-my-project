/**
 * sw.js — KILL SWITCH
 *
 * Clears all caches then unregisters itself. The inline SW killer in
 * index.html handles the one-time reload after unregistration — having
 * client.navigate() here too caused a double-reload race that froze the
 * browser ("La página no responde").
 *
 * Mechanism:
 *  1. install: skipWaiting() — take over immediately without waiting
 *  2. activate: delete every cache → unregister
 *  3. fetch: no listener → browser handles all requests directly
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        /* no-op */
      }

      try {
        await self.registration.unregister();
      } catch {
        /* no-op */
      }
    })(),
  );
});
