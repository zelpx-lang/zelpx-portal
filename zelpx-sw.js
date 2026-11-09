self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || "ZELPX — New chat message";
  const options = {
    body: data.body || "You have a new message.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "zelpx-chat-message",
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200],
    data: { url: data.url || "/" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url || "/";
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
