const { sendJson, normalizePhone, getAuthenticatedUser, getTwilioConfig, twilioHeaders } = require("../../lib/customer-phone");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  try {
    const user = await getAuthenticatedUser(req);
    const phone = normalizePhone(req.body && req.body.phone);
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      return sendJson(res, 400, { error: "Enter a valid phone number in international format, including country code." });
    }
    const config = getTwilioConfig();
    const url = "https://verify.twilio.com/v2/Services/" + encodeURIComponent(config.serviceSid) + "/Verifications";
    const response = await fetch(url, {
      method: "POST",
      headers: twilioHeaders(config),
      body: new URLSearchParams({ To: phone, Channel: "sms" })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const safeMessage = response.status === 429
        ? "Too many verification attempts. Please wait before requesting another code."
        : "SMS could not be sent. Check the number and try again.";
      return sendJson(res, response.status === 429 ? 429 : 502, { error: safeMessage });
    }
    return sendJson(res, 200, { success: true, status: result.status || "pending" });
  } catch (error) {
    const status = /sign in|session/i.test(error.message) ? 401 : /not configured/i.test(error.message) ? 503 : 500;
    return sendJson(res, status, { error: error.message || "Could not start phone verification." });
  }
};
