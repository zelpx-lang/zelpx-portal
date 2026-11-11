import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type OutboxRow = {
  id: number;
  source_id: string;
  event_type: "new_lead" | "new_chat_message";
  recipient_type: "customer" | "contractor";
  recipient_id: string;
  conversation_id: string | null;
  title: string;
  body: string;
  target_url: string;
  delivered_at: string | null;
  attempt_count: number;
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const webhookSecret = Deno.env.get("ZELPX_PUSH_WEBHOOK_SECRET") ?? "";
  const suppliedSecret = req.headers.get("x-zelpx-push-secret") ?? "";
  if (webhookSecret.length < 32 || !constantTimeEqual(suppliedSecret, webhookSecret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server configuration is incomplete" }, 500);
  }
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return json({ error: "Push delivery is not configured" }, 503);
  }

  let claimedOutboxId: number | null = null;
  let adminClient: ReturnType<typeof createClient> | null = null;
  try {
    const payload = await req.json();
    const record = payload?.record;
    const outboxId = Number(record?.id);
    if (!Number.isSafeInteger(outboxId) || outboxId < 1) {
      return json({ error: "A valid outbox record is required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    adminClient = admin;

    // Atomically claim the event so webhook retries/concurrent deliveries
    // cannot send the same notification twice.
    const { data: claimedRows, error: claimError } = await admin
      .rpc("claim_push_notification", { p_notification_id: outboxId });
    if (claimError) throw new Error("Could not claim notification event");
    const row = claimedRows?.[0];
    if (!row) return json({ success: true, duplicate_or_in_progress: true, sent: 0 });
    claimedOutboxId = outboxId;
    const event = row as OutboxRow;

    let subscriptions: Array<{ id: string; endpoint: string; subscription: unknown; table: string }> = [];

    if (event.event_type === "new_lead" && event.recipient_type === "contractor") {
      const { data: rows, error } = await admin
        .from("contractor_push_subscriptions")
        .select("id,endpoint,subscription")
        .eq("user_id", event.recipient_id);
      if (error) throw new Error("Could not load contractor subscriptions");
      subscriptions = (rows ?? []).map((r) => ({ ...r, table: "contractor_push_subscriptions" }));
    } else if (event.event_type === "new_chat_message" && event.conversation_id) {
      if (event.recipient_type === "customer") {
        const { data: rows, error } = await admin
          .from("chat_push_subscriptions")
          .select("id,endpoint,subscription")
          .eq("conversation_id", event.conversation_id)
          .eq("recipient_type", "customer");
        if (error) throw new Error("Could not load customer chat subscriptions");
        subscriptions = (rows ?? []).map((r) => ({ ...r, table: "chat_push_subscriptions" }));
      } else {
        const { data: contractor, error: contractorError } = await admin
          .from("contractors")
          .select("id")
          .eq("user_id", event.recipient_id)
          .maybeSingle();
        if (contractorError) throw new Error("Could not load contractor recipient");
        const [accountRows, chatRows] = await Promise.all([
          contractor
            ? admin.from("contractor_push_subscriptions").select("id,endpoint,subscription").eq("contractor_id", contractor.id)
            : Promise.resolve({ data: [], error: null }),
          admin.from("chat_push_subscriptions").select("id,endpoint,subscription")
            .eq("conversation_id", event.conversation_id).eq("recipient_type", "contractor"),
        ]);
        if (accountRows.error || chatRows.error) throw new Error("Could not load contractor chat subscriptions");
        subscriptions = [
          ...(accountRows.data ?? []).map((r) => ({ ...r, table: "contractor_push_subscriptions" })),
          ...(chatRows.data ?? []).map((r) => ({ ...r, table: "chat_push_subscriptions" })),
        ];
      }
    }

    const unique = new Map<string, typeof subscriptions[number]>();
    for (const sub of subscriptions) if (!unique.has(sub.endpoint)) unique.set(sub.endpoint, sub);
    subscriptions = [...unique.values()];

    if (!subscriptions.length) {
      await admin.from("push_notification_outbox")
        .update({ delivered_at: new Date().toISOString(), processing_at: null, last_error: null })
        .eq("id", event.id).is("delivered_at", null);
      return json({ success: true, sent: 0, reason: "no_subscriptions" });
    }

    const normalizedSubject = vapidSubject.startsWith("mailto:") || vapidSubject.startsWith("https://")
      ? vapidSubject
      : `mailto:${vapidSubject}`;
    webpush.setVapidDetails(normalizedSubject, vapidPublicKey, vapidPrivateKey);

    // The notification copy is deliberately generic. Never put message text,
    // customer contact details, or private lead information into push payloads.
    const safePayload = JSON.stringify({
      title: event.title,
      body: event.body,
      url: event.target_url,
      tag: `zelpx-${event.event_type}-${event.source_id}`,
    });

    let sent = 0;
    const stale: Array<{ id: string; table: string }> = [];
    const failures: string[] = [];

    await Promise.all(subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, safePayload, { TTL: 3600 });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) stale.push({ id: sub.id, table: sub.table });
        else failures.push(String(status ?? "delivery_error"));
      }
    }));

    for (const table of ["contractor_push_subscriptions", "chat_push_subscriptions"]) {
      const ids = stale.filter((x) => x.table === table).map((x) => x.id);
      if (ids.length) await admin.from(table).delete().in("id", ids);
    }

    const update = {
      delivered_at: sent > 0 || failures.length === 0 ? new Date().toISOString() : null,
      processing_at: null,
      last_error: failures.length ? failures.slice(0, 3).join(",").slice(0, 300) : null,
    };
    const { error: updateError } = await admin.from("push_notification_outbox")
      .update(update).eq("id", event.id).is("delivered_at", null);
    if (updateError) throw new Error("Could not update notification delivery status");

    return json({ success: true, sent, removed_expired: stale.length, retryable_failures: failures.length });
  } catch (error) {
    if (adminClient && claimedOutboxId !== null) {
      await adminClient.from("push_notification_outbox")
        .update({ processing_at: null, last_error: "dispatch_error" })
        .eq("id", claimedOutboxId).is("delivered_at", null);
    }
    console.error("ZELPX push dispatch failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Notification dispatch failed" }, 500);
  }
});
