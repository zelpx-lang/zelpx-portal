import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port) return false;
    const host = url.hostname.toLowerCase();
    return host === "fcm.googleapis.com" ||
      host === "web.push.apple.com" ||
      host === "push.services.mozilla.com" ||
      host.endsWith(".push.services.mozilla.com") ||
      host.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  let secretKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secretKey) {
    try {
      secretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
    } catch {
      return json({ error: "Server configuration is incomplete" }, 500);
    }
  }
  if (!supabaseUrl || !secretKey) return json({ error: "Server configuration is incomplete" }, 500);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return json({ error: "Authentication required" }, 401);
  const { data: userData, error: userError } = await admin.auth.getUser(bearer);
  if (userError || !userData.user) return json({ error: "Invalid session" }, 401);
  const userId = userData.user.id;

  try {
    const body = await req.json();

    if (body.action === "subscribe") {
      const subscription = body.subscription;
      if (!subscription || !validPushEndpoint(subscription.endpoint) ||
          typeof subscription.keys?.p256dh !== "string" ||
          typeof subscription.keys?.auth !== "string" ||
          subscription.keys.p256dh.length < 40 ||
          subscription.keys.auth.length < 16) {
        return json({ error: "Invalid browser push subscription" }, 400);
      }

      const { data: existing, error: lookupError } = await admin
        .from("staging_push_test_subscriptions")
        .select("id,user_id")
        .eq("endpoint", subscription.endpoint)
        .maybeSingle();
      if (lookupError) throw new Error("Could not check existing subscription");
      if (existing && existing.user_id !== userId) {
        return json({ error: "This device endpoint is already linked to another test account" }, 409);
      }

      const { error: saveError } = await admin
        .from("staging_push_test_subscriptions")
        .upsert({
          user_id: userId,
          endpoint: subscription.endpoint,
          subscription,
          updated_at: new Date().toISOString(),
        }, { onConflict: "endpoint" });
      if (saveError) throw new Error("Could not save device subscription");
      return json({ success: true });
    }

    if (body.action === "unsubscribe") {
      const endpoint = body.endpoint;
      if (typeof endpoint !== "string") return json({ error: "Endpoint is required" }, 400);
      const { error } = await admin.from("staging_push_test_subscriptions")
        .delete().eq("user_id", userId).eq("endpoint", endpoint);
      if (error) throw new Error("Could not remove device subscription");
      return json({ success: true });
    }

    if (body.action === "send_test") {
      const { data: rows, error: queryError } = await admin
        .from("staging_push_test_subscriptions")
        .select("id,subscription")
        .eq("user_id", userId);
      if (queryError) throw new Error("Could not load your test devices");
      if (!rows?.length) return json({ error: "Register this browser for test notifications first" }, 409);

      const { data: secrets, error: secretsError } = await admin.rpc("get_push_runtime_secrets");
      if (secretsError || !secrets?.vapid_public_key || !secrets?.vapid_private_key || !secrets?.vapid_subject) {
        return json({ error: "Staging push configuration is incomplete" }, 503);
      }
      const subject = String(secrets.vapid_subject);
      webpush.setVapidDetails(
        subject.startsWith("mailto:") || subject.startsWith("https://") ? subject : `mailto:${subject}`,
        String(secrets.vapid_public_key),
        String(secrets.vapid_private_key),
      );

      let sent = 0;
      const staleIds: string[] = [];
      await Promise.all(rows.map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription, JSON.stringify({
            title: "ZELPX staging test",
            body: "Push delivery is connected. This is a test notification.",
            url: "/staging-push-test/",
            tag: "zelpx-staging-push-test",
          }), { TTL: 300 });
          sent++;
        } catch (error) {
          const status = (error as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) staleIds.push(row.id);
          else console.error("Staging push test delivery failed:", status ?? "unknown");
        }
      }));
      if (staleIds.length) {
        const { error } = await admin.from("staging_push_test_subscriptions").delete().in("id", staleIds);
        if (error) throw new Error("Could not remove expired test subscriptions");
      }
      return json({ success: true, sent, removed_expired: staleIds.length });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("Staging push test failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Staging push test failed" }, 500);
  }
});
