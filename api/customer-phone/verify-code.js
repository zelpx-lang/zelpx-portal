const { SUPABASE_URL, sendJson, normalizePhone, getAuthenticatedUser, getTwilioConfig, twilioHeaders } = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  try {
    const user = await getAuthenticatedUser(req);
    const phone = normalizePhone(req.body && req.body.phone);
    const code = typeof (req.body && req.body.code) === "string" ? req.body.code.trim() : "";
    if (!/^\\+[1-9]\\d{7,14}$/.test(phone) || !/^\\d{6}$/.test(code)) {
      return sendJson(res, 400, { error: "Enter a valid phone number and the 6-digit SMS code." });
    }
    const config = getTwilioConfig();
    const url = "https://verify.twilio.com/v2/Services/" + encodeURIComponent(config.serviceSid) + "/VerificationCheck";
    const response = await fetch(url, {
      method: "POST",
      headers: twilioHeaders(config),
      body: new URLSearchParams({ To: phone, Code: code })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status !== "approved") {
      return sendJson(res, 400, { error: "The code is incorrect or expired. Request a new code and try again." });
    }

    const updateResponse = await fetch(SUPABASE_URL + "/rest/v1/profiles?id=eq." + encodeURIComponent(user.id), {
      method: "PATCH",
      headers: {
        "apikey": config.serviceKey,
        "Authorization": "Bearer " + config.serviceKey,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        phone,
        phone_verified_at: new Date().toISOString(),
        phone_verified_number: phone
      })
    });
    if (!updateResponse.ok) {
      return sendJson(res, 500, { error: "The number was verified, but ZELPX could not save it to your profile. Please contact support." });
    }
    return sendJson(res, 200, { success: true, verified: true, phone });
  } catch (error) {
    const status = /sign in|session/i.test(error.message) ? 401 : /not configured/i.test(error.message) ? 503 : 500;
    return sendJson(res, status, { error: error.message || "Could not verify this phone number." });
  }
};
