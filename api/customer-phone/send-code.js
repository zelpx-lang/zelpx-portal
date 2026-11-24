"use strict";
const { sendJson, normalizeE164, readJson, authenticatedUser, twilioConfig, twilioPost, requireActiveCustomer, ensurePhoneAvailable } = require("../../lib/customer-phone");
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  try {
    const body = await readJson(req);
    const phone = normalizeE164(body.phone);
    if (!phone) return sendJson(res, 400, { error: "Enter a valid phone number in E.164 format, such as +15035550123." });
    const config = twilioConfig();
    const user = await authenticatedUser(req);
    await requireActiveCustomer(user.id, config);
    if (body.purpose === "contractor_account") {
      const check = await fetch(SUPABASE_URL + "/rest/v1/contractors?select=id&user_id=eq." + encodeURIComponent(user.id), { headers: { Authorization: "Bearer " + config.serviceRoleKey, apikey: config.serviceRoleKey } });
      if (!check.ok || !(await check.json().catch(() => [])).length) return sendJson(res, 403, { error: "Contractor account required." });
    }
    await ensurePhoneAvailable(user.id, phone, config);
    await twilioPost("https://verify.twilio.com/v2/Services/" + encodeURIComponent(config.serviceSid) + "/Verifications", config, { To: phone, Channel: "sms" });
    return sendJson(res, 200, { success: true, message: "Verification code sent." });
  } catch (error) {
    if (Number(error.code) === 60203) return sendJson(res, 429, { error: "Too many SMS attempts. Please wait 10 minutes before trying again.", code: "SMS_MAX_SEND_ATTEMPTS", retry_after_seconds: 600 });
    const status = error.status === 429 ? 429 : (error.status && error.status < 500 ? 400 : 503);
    return sendJson(res, status, { error: error.message || "Could not send verification code." });
  }
};
