// Kill-stub. Unregisters itself if a prior deploy installed a service worker.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", async (event) => {
  event.waitUntil(
    (async () => {
      try { await self.registration.unregister(); } catch {}
      const clients = await self.clients.matchAll({ type: "window" });
      for (const c of clients) {
        try { c.navigate(c.url); } catch {}
      }
    })()
  );
});
