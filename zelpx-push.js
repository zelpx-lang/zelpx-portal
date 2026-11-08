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

  let autoRole = null, autoDb = null, autoPromptInstalled = false, autoBusy = false;
  window.ZELPXAutoSubscribe = async function(db, role) {
    autoDb = db; autoRole = role;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    if (Notification.permission === "granted") {
      try {
        if (role === "customer") await window.ZELPXEnableCustomerPurchasePush(db, null);
        else if (role === "admin") await window.ZELPXEnableAdminPush(db, null);
        else await window.ZELPXEnableContractorLeadPush(db, null);
        return true;
      } catch (e) { console.warn("Automatic push subscription failed:", e); return false; }
    }
    if (Notification.permission === "default" && !autoPromptInstalled) {
      autoPromptInstalled = true;
      const ask = async () => {
        if (autoBusy || !autoDb || !autoRole || Notification.permission !== "default") return;
        autoBusy = true;
        try {
          const permission = await Notification.requestPermission();
          if (permission === "granted") await window.ZELPXAutoSubscribe(autoDb, autoRole);
        } catch (e) { console.warn("Notification permission was not granted:", e); }
        finally {
          autoBusy = false;
          window.removeEventListener("pointerdown", ask, true);
          window.removeEventListener("keydown", ask, true);
        }
      };
      window.addEventListener("pointerdown", ask, true);
      window.addEventListener("keydown", ask, true);
    }
    return false;
  };
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
      // Some browsers (notably mobile browser builds) return null for
      // applicationServerKey even when the existing subscription is valid.
      // Never destroy a working subscription just because the browser hides this value.
      if (currentKey) {
        const matches = currentKey.byteLength === expectedKey.byteLength &&
          Array.from(new Uint8Array(currentKey)).every((byte, index) => byte === expectedKey[index]);
        if (!matches) {
          await subscription.unsubscribe();
          subscription = null;
        }
      }
    }
    return subscription || registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: expectedKey
    });
  }
  window.ZELPXEnableCustomerPurchasePush = async function(db, button) {
    if (!( "serviceWorker" in navigator) || !( "PushManager" in window) || !( "Notification" in window)) {
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
        body: { action: "customer_purchase_subscribe", subscription: subscription.toJSON() }
      });
      if (error) throw error;
      rememberPushEnabled("customer_purchases");
      if (button) button.textContent = "✓ Purchase notifications enabled";
      return true;
    } finally { if (button) button.disabled = false; }
  };
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
      rememberPushEnabled("contractor_leads");
      if (button) button.textContent = "🔔 Lead alerts enabled";
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
      rememberPushEnabled("admin");
      if (button) button.textContent = "🔔 Admin notifications enabled";
      return true;
    } finally { if (button) button.disabled = false; }
  };
  window.ZELPXRefreshPushForConversation = async function(db, conversationId, recipientType = "contractor") {
    if (!("Notification" in window) || Notification.permission !== "granted") return false;
    return window.ZELPXEnablePushForConversation(db, conversationId, null, recipientType);
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
      rememberPushEnabled("chat:" + recipientType + ":" + conversationId);
      if (button) button.textContent = "🔔 Chat notifications enabled";
      return true;
    } finally { if (button) button.disabled = false; }
  };
})();