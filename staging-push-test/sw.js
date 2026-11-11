self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title || "ZELPX staging test", {
    body: data.body || "Push delivery is connected.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "zelpx-staging-push-test",
    data: { url: data.url || "/staging-push-test/" }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data?.url || "/staging-push-test/";
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
