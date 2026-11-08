(() => {
  "use strict";
  const VAPID_PUBLIC_KEY = "BJ_Re5koTbkuNzJHO85KMY2w8QXE8iQCH2E-UeG7p6pXkHgG0mKFYh06_j2hpszx9Z3fruqcHdzCOAYUtKCz780";
  function urlBase64ToUint8Array(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, ch => ch.charCodeAt(0));
  }
  window.ZELPXEnablePushForConversation = async function(db, conversationId, button, recipientType = "contractor") {
    if (!conversationId || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      throw new Error("Push notifications are not supported by this browser.");
    }
    if (button) button.disabled = true;
    try {
      const registration = await navigator.serviceWorker.register("/zelpx-sw.js", { scope: "/" });
      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("Allow notifications in your browser settings, then try again.");
      }
      const subscription = await registration.pushManager.getSubscription() ||
        await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
      const { error } = await db.functions.invoke("send-chat-push", {
        body: { action: "subscribe", recipient_type: recipientType, conversation_id: conversationId, subscription: subscription.toJSON() }
      });
      if (error) throw error;
      if (button) button.textContent = "🔔 Chat notifications enabled";
      return true;
    } finally { if (button) button.disabled = false; }
  };
})();