"use strict";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://zsrnjkndgbchfxibxiyd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_prE7ENnFQaUGIq3h8U_uAQ_V9SjuBnb";

function sendJson(res, status, body) {
  res.status(status).setHeader("Cache-Control", "no-store").json(body);
}
function normalizeE164(value) {
  const phone = String(value || "").trim();
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;
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
  const match = header.match(/^Bearer\s+(.+)$/i);
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
    throw new Error("SMS verification is not fully configured for this deployment.");
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
    error.code = Number(data.code || 0);
    throw error;
  }
  return data;
}
async function requireActiveCustomer(userId, config) {
  const url = SUPABASE_URL + "/rest/v1/profiles?select=role,customer_account_status&id=eq." + encodeURIComponent(userId);
  const response = await fetch(url, { headers: { Authorization: "Bearer " + config.serviceRoleKey, apikey: config.serviceRoleKey } });
  if (!response.ok) throw new Error("Could not confirm the customer account status.");
  const rows = await response.json().catch(() => []);
  // The customer portal explicitly supports both customer and contractor profiles.
  // Keep the role unchanged; only admins and blocked customer accounts are denied here.
  if (!Array.isArray(rows) || rows.length !== 1 || !["customer", "contractor"].includes(rows[0].role)) {
    const error = new Error("This phone verification is not available for this account.");
    error.status = 403;
    throw error;
  }
  if (rows[0].role === "customer" && rows[0].customer_account_status === "blocked") {
    const error = new Error("This customer account is suspended. Contact ZELPX support.");
    error.status = 403;
    throw error;
  }
}
async function ensurePhoneAvailable(userId, phone, config) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/zelpx_phone_available", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + config.serviceRoleKey,
      "apikey": config.serviceRoleKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_phone: phone, p_user_id: userId })
  });
  if (!response.ok) throw new Error("Could not check whether this phone number is available. Please try again.");
  const available = await response.json().catch(() => false);
  if (available !== true) {
    const error = new Error("This phone number is already linked to another ZELPX account. SMS cannot be sent. Use a number that is not registered to another account.");
    error.status = 409;
    throw error;
  }
}
async function saveVerifiedPhone(userId, phone, config) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/profiles?id=eq." + encodeURIComponent(userId) + "&role=in.%28customer%2Ccontractor%29", {
    method: "PATCH",
    headers: {
      "Authorization": "Bearer " + config.serviceRoleKey,
      "apikey": config.serviceRoleKey,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({
      phone,
      phone_verified_at: new Date().toISOString(),
      phone_verified_number: phone
    })
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    if (detail.code === "23505") {
      throw new Error("This phone number is already linked to another ZELPX account. Each phone number can belong to only one account.");
    }
    throw new Error("SMS code was accepted, but the verified number could not be saved. Please try again or contact ZELPX support.");
  }
  const rows = await response.json().catch(() => []);
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].phone !== phone || rows[0].phone_verified_number !== phone) {
    throw new Error("SMS code was accepted, but no customer profile row was updated. Please contact support; your old number has not been replaced.");
  }
}
async function saveRequestSmsProof(userId, phone, config) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/profiles?id=eq." + encodeURIComponent(userId) + "&role=in.%28customer%2Ccontractor%29&phone=eq." + encodeURIComponent(phone), {
    method: "PATCH",
    headers: {
      "Authorization": "Bearer " + config.serviceRoleKey,
      "apikey": config.serviceRoleKey,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({
      request_sms_verified_at: new Date().toISOString(),
      request_sms_verified_phone: phone
    })
  });
  if (!response.ok) throw new Error("SMS was verified, but the one-time order confirmation could not be saved. Please try again.");
  const rows = await response.json().catch(() => []);
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("The profile phone changed during verification. Please request a new SMS code.");
  }
}


async function saveVerifiedContractorPhone(userId, phone, config) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/contractors?user_id=eq." + encodeURIComponent(userId), {
    method: "PATCH",
    headers: {
      "Authorization": "Bearer " + config.serviceRoleKey,
      "apikey": config.serviceRoleKey,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({
      contractor_phone: phone,
      contractor_phone_verified_at: new Date().toISOString(),
      contractor_phone_verified_number: phone
    })
  });
  if (!response.ok) throw new Error("SMS code was accepted, but contractor verification could not be saved.");
  const rows = await response.json().catch(() => []);
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].contractor_phone_verified_number !== phone) {
    throw new Error("No contractor account was updated with the verified phone. Please contact support.");
  }
}

module.exports = { saveVerifiedContractorPhone, sendJson, normalizeE164, readJson, authenticatedUser, twilioConfig, twilioPost, requireActiveCustomer, ensurePhoneAvailable, saveVerifiedPhone, saveRequestSmsProof };
