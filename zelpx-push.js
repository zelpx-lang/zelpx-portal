(() => {
  "use strict";
  const VAPID_PUBLIC_KEY = "BJ_Re5koTbkuNzJHO85KMY2w8QXE8iQCH2E-UeG7p6pXkHgG0mKFYh06_j2hpszx9Z3fruqcHdzCOAYUtKCz780";
  const SW_PATH = "/zelpx-sw.js";
  const BUTTON_ID = "zelpxPushButton";

  function urlBase64ToUint8Array(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from(raw, ch => ch.charCodeAt(0));
  }

  async function enableConversationNotifications(db, conversationId, panel) {
    if (!conversationId || !("serviceWorker" in navigator) ||
        !("PushManager" in window) || !("Notification" in window)) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = "🔔 Enable chat notifications";
    button.style.marginTop = "10px";
    panel.append(button);

    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
    const existing = await registration.pushManager.getSubscription();
    if (existing && Notification.permission === "granted") {
      button.textContent = "🔔 Notifications enabled on this device";
    }

    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        if (!VAPID_PUBLIC_KEY) throw new Error("VAPID public key is not configured.");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("Please allow notifications in your browser.");
        const subscription = await registration.pushManager.getSubscription() ||
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          });
        const { data: { session } } = await db.auth.getSession();
        if (!session?.access_token) throw new Error("Please sign in again.");
        const { error } = await db.functions.invoke("send-chat-push", {
          body: { action: "subscribe", conversation_id: conversationId, subscription: subscription.toJSON() }
        });
        if (error) throw error;
        button.textContent = "🔔 Chat notifications enabled";
      } catch (error) {
        console.error("ZELPX push setup failed", error);
        alert("Could not enable notifications: " + (error.message || "Unknown error"));
      } finally {
        button.disabled = false;
      }
    });
  }
  window.ZELPXEnableChatNotifications = enableConversationNotifications;
\n})();\n