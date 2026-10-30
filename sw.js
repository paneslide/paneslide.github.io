/* PaneSlide moved to paneslide.com. This worker replaces the old offline-app worker on paneslide.github.io:
   it deletes every cache, unregisters itself and reloads open pages, so they load the bridge page from the network. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) { try { c.navigate(c.url); } catch (err) {} }
})()));
// no fetch handler: every request goes straight to the network
