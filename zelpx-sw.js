const ZELPX_ORIGIN = "https://app.zelpx.com";
const ZELPX_ALLOWED_ORIGINS = new Set([ZELPX_ORIGIN, "https://zelpx-portal-f65iurntk-zelpx.vercel.app", "https://zelpx-portal-git-feature-android-call-prototype-zelpx.vercel.app"]);

function getSafeNotificationUrl(value) {
  try {
    const parsed = new URL(typeof value === "string" ? value : "/", ZELPX_ORIGIN);
    // Never send users to temporary Vercel preview deployments or another host.
    if (!ZELPX_ALLOWED_ORIGINS.has(parsed.origin)) {
      return new URL(parsed.pathname + parsed.search + parsed.hash, ZELPX_ORIGIN).href;
    }
    return parsed.href;
  } catch (_) {
    return ZELPX_ORIGIN + "/";
  }
}

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || "ZELPX — New notification";
  const options = {
    body: data.body || "You have a new update.",
    icon: "/icons/zelpx-192.svg",
    badge: "/icons/zelpx-192.svg",
    tag: data.tag || "zelpx-notification",
    renotify: true,
    silent: false,
    requireInteraction: data.requireInteraction === true,
    vibrate: [500, 250, 500],
    data: { url: getSafeNotificationUrl(data.url) }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = getSafeNotificationUrl(event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const targetUrl = new URL(target);
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Reuse only a window on the production origin. A preview deployment may
    // still be open, but it must never receive a cross-origin navigate call.
    for (const client of clientsList) {
      try {
        if (new URL(client.url).origin === ZELPX_ORIGIN) {
          if ("navigate" in client) await client.navigate(target);
          return await client.focus();
        }
      } catch (_) {}
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl.href);
  })());
});
