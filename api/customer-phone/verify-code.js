"use strict";
const { sendJson, normalizeE164, readJson, authenticatedUser, twilioConfig, twilioPost, requireActiveCustomer, ensurePhoneAvailable, saveVerifiedPhone, saveVerifiedContractorPhone, saveRequestSmsProof } = require("../../lib/customer-phone");
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  try {
    const user = await authenticatedUser(req);
    const body = await readJson(req);
    const phone = normalizeE164(body.phone);
    const code = String(body.code || "").trim();
    if (!phone || !/^\d{6}$/.test(code)) return sendJson(res, 400, { error: "Enter a valid phone number and the 6-digit SMS code." });
    const config = twilioConfig();
    await requireActiveCustomer(user.id, config);
    if (body.purpose === "contractor_account") {
      const check = await fetch(SUPABASE_URL + "/rest/v1/contractors?select=id&user_id=eq." + encodeURIComponent(user.id), { headers: { Authorization: "Bearer " + config.serviceRoleKey, apikey: config.serviceRoleKey } });
      if (!check.ok || !(await check.json().catch(() => [])).length) return sendJson(res, 403, { error: "Contractor account required." });
    }
    await ensurePhoneAvailable(user.id, phone, config);
    const result = await twilioPost("https://verify.twilio.com/v2/Services/" + encodeURIComponent(config.serviceSid) + "/VerificationCheck", config, { To: phone, Code: code });
    if (result.status !== "approved") return sendJson(res, 400, { error: "The SMS code is incorrect or expired. Request a new code and try again." });
    if (body.purpose === "contractor_account") await saveVerifiedContractorPhone(user.id, phone, config);
    else await saveVerifiedPhone(user.id, phone, config);
    if (body.purpose === "request_submission") await saveRequestSmsProof(user.id, phone, config);
    return sendJson(res, 200, { success: true, verified: true, phone });
  } catch (error) {
    const status = error.status === 429 ? 429 : (error.status && error.status < 500 ? 400 : 503);
    return sendJson(res, status, { error: error.message || "Could not verify the SMS code." });
  }
};
