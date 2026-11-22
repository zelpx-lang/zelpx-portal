// Same-origin proxy for the Supabase address-verification Edge Function.
// The browser calls this Vercel route, so the Edge Function's app.zelpx.com-only
// CORS policy does not block Preview deployments. No service-role key is used here.
const SUPABASE_FUNCTION_URL = "https://zsrnjkndgbchfxibxiyd.supabase.co/functions/v1/verify-service-address";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed." });
  }

  // Only accept browser calls made to this same Vercel deployment.
  const origin = req.headers.origin;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== String(host).split(",")[0].trim()) {
        return res.status(403).json({ error: "Cross-origin request blocked." });
      }
    } catch (_) {
      return res.status(403).json({ error: "Invalid request origin." });
    }
  }

  const authorization = req.headers.authorization || "";
  const apikey = req.headers.apikey || "";
  if (!authorization.startsWith("Bearer ") || !apikey) {
    return res.status(401).json({ error: "Please sign in again and retry address verification." });
  }

  try {
    const upstream = await fetch(SUPABASE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "apikey": apikey,
        "Authorization": authorization
      },
      body: typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}),
      signal: AbortSignal.timeout(15000)
    });

    const body = await upstream.text();
    res.status(upstream.status);
    return res.send(body || JSON.stringify({ error: "Address verification returned an empty response." }));
  } catch (error) {
    console.error("Address verification proxy failed:", error);
    return res.status(502).json({
      error: "Address verification service is temporarily unavailable. Please try again."
    });
  }
};
