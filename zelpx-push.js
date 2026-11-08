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

  async function ensureButton(db, user) {
    if (!user || !("serviceWorker" in navigator) ||
        !("PushManager" in window) || !("Notification" in window)) return;

    let button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement("button");
      button.id = BUTTON_ID;
      button.type = "button";
      button.textContent = "🔔 Enable message notifications";
      button.setAttribute("aria-label", "Enable ZELPX message notifications");
      Object.assign(button.style, {
        position: "fixed", right: "14px", bottom: "18px", zIndex: "9999",
        border: "0", borderRadius: "24px", padding: "13px 17px",
        background: "#176da8", color: "#fff", fontSize: "14px",
        fontWeight: "700", boxShadow: "0 3px 14px #0003", cursor: "pointer"
      });
      document.body.appendChild(button);
    }

    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
    const existing = await registration.pushManager.getSubscription();
    if (existing && Notification.permission === "granted") {
      button.textContent = "🔔 Message notifications enabled";
    } else {
      button.textContent = "🔔 Enable message notifications";
    }

    button.onclick = async () => {
      button.disabled = true;
      try {
        if (VAPID_PUBLIC_KEY === "ADD_VAPID_PUBLIC_KEY_HERE" || !VAPID_PUBLIC_KEY) {
          throw new Error("Push setup is not finished: add the VAPID public key to zelpx-push.js.");
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          throw new Error("Notifications were not allowed. Enable them in your browser settings.");
        }
        const subscription = await registration.pushManager.getSubscription() ||
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          });
        const sub = subscription.toJSON();
        const { error } = await db.from("chat_push_subscriptions").upsert({
          user_id: user.id,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          updated_at: new Date().toISOString()
        }, { onConflict: "endpoint" });
        if (error) throw error;
        button.textContent = "🔔 Message notifications enabled";
        alert("ZELPX message notifications are enabled on this device.");
      } catch (error) {
        console.error("ZELPX push setup failed", error);
        alert("Could not enable notifications: " + (error.message || "Unknown error"));
      } finally {
        button.disabled = false;
      }
    };
  }

  async function start() {
    const db = window.zelpxDb;
    if (!db) return;
    const { data: { session } } = await db.auth.getSession();
    if (session?.user) await ensureButton(db, session.user);

    db.auth.onAuthStateChange((event, sessionNow) => {
      if (sessionNow?.user) {
        // Avoid awaiting Supabase work inside the auth callback.
        setTimeout(() => ensureButton(db, sessionNow.user).catch(console.error), 0);
      } else {
        document.getElementById(BUTTON_ID)?.remove();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => start().catch(console.error), { once: true });
  } else {
    start().catch(console.error);
  }
})();