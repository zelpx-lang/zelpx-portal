(() => {
  const VAPID_PUBLIC_KEY = "REPLACE_WITH_VAPID_PUBLIC_KEY";
  const SW_PATH = "/zelpx-sw.js";

  function urlBase64ToUint8Array(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
  }

  async function setup() {
    const db = window.zelpxDb;
    if (!db || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    const { data: { session } } = await db.auth.getSession();
    if (!session?.user) return;

    const button = document.createElement("button");
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

    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
    const existing = await registration.pushManager.getSubscription();
    if (existing && Notification.permission === "granted") {
      button.textContent = "🔔 Message notifications enabled";
    }

    button.addEventListener("click", async () => {
      try {
        if (VAPID_PUBLIC_KEY.startsWith("REPLACE_")) {
          alert("ZELPX push notifications are not configured yet. The administrator must add the VAPID public key.");
          return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          alert("Please allow notifications for ZELPX in your browser settings.");
          return;
        }
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        const sub = subscription.toJSON();
        const { error } = await db.from("chat_push_subscriptions").upsert({
          user_id: session.user.id,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          updated_at: new Date().toISOString()
        }, { onConflict: "endpoint" });
        if (error) throw error;
        button.textContent = "🔔 Message notifications enabled";
        alert("ZELPX notifications enabled on this device.");
      } catch (error) {
        console.error("ZELPX push setup failed", error);
        alert("Could not enable notifications: " + (error.message || "Unknown error"));
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setup().catch(console.error));
  else setup().catch(console.error);
})();
