const SUPABASE_URL = "https://zsrnjkndgbchfxibxiyd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_prE7ENnFQaUGIq3h8U_uAQ_V9SjuBnb";

function sendJson(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(body));
}

function normalizePhone(value) {
  return typeof value === "string" ? value.replace(/[\\s().-]/g, "") : "";
}

async function getAuthenticatedUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("Please sign in again.");
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + token }
  });
  if (!response.ok) throw new Error("Your session could not be verified. Please sign in again.");
  return response.json();
}

function getTwilioConfig() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SMS verification is not configured yet. ZELPX support must finish the secure SMS provider setup.");
  }
  return {
    accountSid: TWILIO_ACCOUNT_SID,
    authToken: TWILIO_AUTH_TOKEN,
    serviceSid: TWILIO_VERIFY_SERVICE_SID,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
}

function twilioHeaders(config) {
  return {
    "Authorization": "Basic " + Buffer.from(config.accountSid + ":" + config.authToken).toString("base64"),
    "Content-Type": "application/x-www-form-urlencoded"
  };
}

module.exports = { SUPABASE_URL, sendJson, normalizePhone, getAuthenticatedUser, getTwilioConfig, twilioHeaders };
