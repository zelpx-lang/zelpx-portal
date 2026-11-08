(() => {
  "use strict";
  const VAPID_PUBLIC_KEY = "BClS3p1rqgYSceDWth12YNbU-ptxCU_nw-ZWX_zLaZv-2cr8Y7Mn7B97j5szad49e1unuvIvbl_F_E-DE3fG8J4";
  const PUSH_STATE_KEY = "zelpx_push_enabled_v1";
  function rememberPushEnabled(kind, id) {
    try {
      const state = JSON.parse(localStorage.getItem(PUSH_STATE_KEY) || "{}");
      state[kind + (id ? ":" + id : "")] = true;
      localStorage.setItem(PUSH_STATE_KEY, JSON.stringify(state));
    } catch (_) {}
  }
  async function restorePushButton(button, kind, enabledText) {
    if (!button) return;
    try {
      const state = JSON.parse(localStorage.getItem(PUSH_STATE_KEY) || "{}");
      const remembered = !!state[kind];
      const permissionGranted = "Notification" in window && Notification.permission === "granted";
      const registration = ("serviceWorker" in navigator) ? await navigator.serviceWorker.getRegistration("/") : null;
      const subscription = registration && await registration.pushManager.getSubscription();
      if (remembered && permissionGranted && subscription) button.textContent = enabledText;
    } catch (_) {}
  }
  document.addEventListener("DOMContentLoaded", () => {
    restorePushButton(document.getElementById("enableContractorPushBtn"), "contractor_leads", "🔔 Lead alerts enabled");
    restorePushButton(document.getElementById("enableAdminPushBtn"), "admin", "🔔 Admin notifications enabled");
  });
  function urlBase64ToUint8Array(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, ch => ch.charCodeAt(0));
  }
  async function getCurrentVapidSubscription(registration) {
    const expectedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const currentKey = subscription.options && subscription.options.applicationServerKey;
      const matches = currentKey && currentKey.byteLength === expectedKey.byteLength &&
        Array.from(new Uint8Array(currentKey)).every((byte, index) => byte === expectedKey[index]);
      if (!matches) {
        await subscription.unsubscribe();
        subscription = null;
      }
    }
    return subscription || registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: expectedKey
    });
  }
  window.ZELPXEnableContractorLeadPush = async function(db, button) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      throw new Error("Push notifications are not supported by this browser.");
    }
    if (button) button.disabled = true;
    try {
      const registration = await navigator.serviceWorker.register("/zelpx-sw.js", { scope: "/" });
      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("Allow notifications for this site in browser settings, then try again.");
      }
      const subscription = await getCurrentVapidSubscription(registration);
      const { error } = await db.functions.invoke("send-chat-push", {
        body: { action: "contractor_subscribe", subscription: subscription.toJSON() }
      });
      if (error) throw error;
      rememberPushEnabled("contractor_leads");\n      if (button) button.textContent = "🔔 Lead alerts enabled";
      return true;
    } finally { if (button) button.disabled = false; }
  };
  window.ZELPXEnableAdminPush = async function(db, button) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      throw new Error("Push notifications are not supported by this browser.");
    }
    if (button) button.disabled = true;
    try {
      const registration = await navigator.serviceWorker.register("/zelpx-sw.js", { scope: "/" });
      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("Allow notifications for this site in browser settings, then try again.");
      }
      const subscription = await getCurrentVapidSubscription(registration);
      const { error } = await db.functions.invoke("send-chat-push", {
        body: { action: "admin_subscribe", subscription: subscription.toJSON() }
      });
      if (error) throw error;
      rememberPushEnabled("admin");\n      if (button) button.textContent = "🔔 Admin notifications enabled";
      return true;
    } finally { if (button) button.disabled = false; }
  };
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
      const subscription = await getCurrentVapidSubscription(registration);
      const { error } = await db.functions.invoke("send-chat-push", {
        body: { action: "subscribe", recipient_type: recipientType, conversation_id: conversationId, subscription: subscription.toJSON() }
      });
      if (error) throw error;
      rememberPushEnabled("chat:" + recipientType + ":" + conversationId);\n      if (button) button.textContent = "🔔 Chat notifications enabled";
      return true;
    } finally { if (button) button.disabled = false; }
  };
})();