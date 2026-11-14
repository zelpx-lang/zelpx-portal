import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://app.zelpx.com",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: cors });

function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function pemBytes(pem: string): Uint8Array {
  const clean = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const raw = atob(clean);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function googleAccessToken(sa: {client_email:string; private_key:string; token_uri?:string}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const unsigned = header + "." + claim;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemBytes(sa.private_key),
    {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"}, false, ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)
  ));
  const assertion = unsigned + "." + b64url(signature);
  const response = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({
      grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("Google OAuth token exchange failed");
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
  if (req.method !== "POST") return reply({error:"Method not allowed"},405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return reply({error:"Server configuration incomplete"},500);

  const auth = req.headers.get("Authorization");
  if (!auth) return reply({error:"Authentication required"},401);
  const userClient = createClient(supabaseUrl, anonKey, {global:{headers:{Authorization:auth}}});
  const {data:{user},error:userError} = await userClient.auth.getUser();
  if (userError || !user) return reply({error:"Invalid session"},401);
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    if (body.action === "register_token") {
      const token = typeof body.fcm_token === "string" ? body.fcm_token.trim() : "";
      const deviceId = typeof body.device_id === "string" ? body.device_id.trim() : "";
      if (token.length < 40 || token.length > 4096 || !deviceId || deviceId.length > 128)
        return reply({error:"Valid fcm_token and device_id are required"},400);
      const {error} = await admin.from("fcm_device_tokens").upsert({
        user_id:user.id, device_id:deviceId, fcm_token:token,
        platform:"android", updated_at:new Date().toISOString()
      },{onConflict:"user_id,device_id"});
      if (error) {
        console.error("FCM token registration failed",error.message);
        return reply({error:"Could not register device"},500);
      }
      return reply({success:true});
    }

    if (body.action !== "incoming_call") return reply({error:"Unsupported action"},400);
    const conversationId = body.conversation_id;
    const callId = body.call_id;
    const callerRole = body.caller_role;
    if (typeof conversationId !== "string" || typeof callId !== "string" ||
        !["customer","contractor"].includes(callerRole))
      return reply({error:"Invalid call request"},400);

    const {data:conversation,error:convError} = await admin.from("lead_conversations")
      .select("id,lead_id,contractor_id").eq("id",conversationId).maybeSingle();
    if (convError || !conversation) return reply({error:"Conversation not found"},404);

    let recipientUserId: string | null = null;
    if (callerRole === "customer") {
      const {data:request} = await admin.from("service_requests").select("id")
        .eq("lead_id",conversation.lead_id).eq("user_id",user.id).limit(1).maybeSingle();
      if (!request) return reply({error:"Customer does not own this conversation"},403);
      const {data:contractor} = await admin.from("contractors").select("user_id")
        .eq("id",conversation.contractor_id).maybeSingle();
      recipientUserId = contractor?.user_id || null;
    } else {
      const {data:contractor} = await admin.from("contractors").select("id")
        .eq("id",conversation.contractor_id).eq("user_id",user.id).maybeSingle();
      if (!contractor) return reply({error:"Contractor does not own this conversation"},403);
      const {data:request} = await admin.from("service_requests").select("user_id")
        .eq("lead_id",conversation.lead_id).limit(1).maybeSingle();
      recipientUserId = request?.user_id || null;
    }
    if (!recipientUserId) return reply({error:"Call recipient account not found"},404);

    const {data:devices,error:deviceError} = await admin.from("fcm_device_tokens")
      .select("id,fcm_token").eq("user_id",recipientUserId);
    if (deviceError) return reply({error:"Could not load recipient devices"},500);
    if (!devices?.length) return reply({success:true,sent:0,reason:"no_registered_android_devices"});

    const rawServiceAccount = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!rawServiceAccount) return reply({error:"Firebase service account secret missing"},500);
    const sa = JSON.parse(rawServiceAccount);
    if (sa.project_id !== "zelpx-af340" || !sa.client_email || !sa.private_key)
      return reply({error:"Firebase service account configuration invalid"},500);
    const accessToken = await googleAccessToken(sa);
    let sent = 0;
    const stale: string[] = [];
    const results = await Promise.all(devices.map(async (device) => {
      const response = await fetch(
        "https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(sa.project_id) + "/messages:send",
        {
          method:"POST",
          headers:{Authorization:"Bearer " + accessToken,"Content-Type":"application/json"},
          body:JSON.stringify({message:{
            token:device.fcm_token,
            data:{
              type:"incoming_call", call_id:callId, conversation_id:conversationId,
              lead_id:conversation.lead_id,
              recipient_role:callerRole === "customer" ? "contractor" : "customer",
              caller_name:typeof body.caller_name === "string" ? body.caller_name.slice(0,80) : "ZELPX caller"
            },
            android:{priority:"HIGH",ttl:"45s"}
          }})
        }
      );
      if (response.ok) { sent++; return; }
      const err = await response.text();
      console.error("FCM delivery failed",response.status,err.slice(0,300));
      if (response.status === 404 || (response.status === 400 && err.includes("UNREGISTERED")))
        stale.push(device.id);
    }));
    if (stale.length) await admin.from("fcm_device_tokens").delete().in("id",stale);
    return reply({success:true,sent,removed_expired:stale.length});
  } catch (error) {
    console.error("zelpx-fcm-call failed",String(error));
    return reply({error:"Unexpected server error"},500);
  }
});
