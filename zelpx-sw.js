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
    vibrate: [1000, 500, 1000, 500, 1000],
    actions: [
      { action: "answer", title: "Answer" },
      { action: "decline", title: "Decline" }
    ],
    data: {
      url: getSafeNotificationUrl(data.url),
      callId: data.call_id || null,
      conversationId: data.conversation_id || null,
      isIncomingCall: String(data.tag || "").startsWith("zelpx-incoming-call-")
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const targetUrl = new URL(getSafeNotificationUrl(notificationData.url));
  if (notificationData.isIncomingCall) {
    targetUrl.searchParams.set("call_action", event.action === "decline" ? "decline" : "answer");
    if (notificationData.callId) targetUrl.searchParams.set("call_id", notificationData.callId);
  }
  const target = targetUrl.href;
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      try {
        if (new URL(client.url).origin === targetUrl.origin) {
          if ("navigate" in client) await client.navigate(target);
          return await client.focus();
        }
      } catch (_) {}
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
