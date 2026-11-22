"use strict";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://zsrnjkndgbchfxibxiyd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_prE7ENnFQaUGIq3h8U_uAQ_V9SjuBnb";

function sendJson(res, status, body) {
  res.status(status).setHeader("Cache-Control", "no-store").json(body);
}
function normalizeE164(value) {
  const phone = String(value || "").trim();
  if (!/^\\+[1-9]\\d{7,14}$/.test(phone)) return null;
  return phone;
}
async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4096) throw new Error("Request is too large.");
  }
  try { return JSON.parse(raw || "{}"); } catch (_) { throw new Error("Invalid request body."); }
}
async function authenticatedUser(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\\s+(.+)$/i);
  if (!match) throw new Error("Please sign in again.");
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { "Authorization": "Bearer " + match[1], "apikey": SUPABASE_PUBLISHABLE_KEY }
  });
  if (!response.ok) throw new Error("Your session is invalid or expired. Please sign in again.");
  return response.json();
}
function twilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!accountSid || !authToken || !serviceSid || !serviceRoleKey) {
    throw new Error("SMS verification is not fully configured for this Preview deployment.");
  }
  return { accountSid, authToken, serviceSid, serviceRoleKey };
}
async function twilioPost(url, config, fields) {
  const auth = Buffer.from(config.accountSid + ":" + config.authToken).toString("base64");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + auth,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(fields)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.message || "SMS provider rejected the request.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}
async function saveVerifiedPhone(userId, phone, config) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/profiles?id=eq." + encodeURIComponent(userId), {
    method: "PATCH",
    headers: {
      "Authorization": "Bearer " + config.serviceRoleKey,
      "apikey": config.serviceRoleKey,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify({
      phone,
      phone_verified_at: new Date().toISOString(),
      phone_verified_number: phone
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error("SMS code was accepted, but the verified number could not be saved. Check the Preview database migration. " + detail.slice(0, 180));
  }
}
module.exports = { sendJson, normalizeE164, readJson, authenticatedUser, twilioConfig, twilioPost, saveVerifiedPhone };
