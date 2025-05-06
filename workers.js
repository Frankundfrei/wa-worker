export default {
    /**
     * WhatsApp → Cloudflare Worker → n8n
     * -------------------------------------------------------------
     * •  GET  = Verifizierungs‑Handshake   (hub.challenge)
     * •  POST = WhatsApp‑Events
     *      – Status‑Events    werden gedroppt
     *      – Echo‑Nachrichten werden gedroppt
     *      – Echte User‑Msgs  → an n8n weitergeleitet
     * -------------------------------------------------------------
     *  ENV VARS (Settings → Variables and Secrets):
     *  N8N_URL                = https://app.n8n.cloud/webhook/wa-in
     *  BUSINESS_PHONE_MSISDN  = 491701234567     // ohne +
     *  VERIFY_TOKEN           = deinVerifyToken
     */
    async fetch(request, env) {
      // ---- Logging Helper ---------------------------------------
      const log = (...msg) => console.log(new Date().toISOString(), ...msg);
  
      // ---- 1) GET  = Webhook‑Verifizierung ----------------------
      if (request.method === "GET") {
        const url = new URL(request.url);
        const token     = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
  
        log("GET handshake:", token, challenge);
  
        if (token === env.VERIFY_TOKEN && challenge) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      }
  
      // ---- 2) POST = WhatsApp‑Events ----------------------------
      let raw;
      try {
        raw = await request.json();
      } catch {
        return new Response("Bad JSON", { status: 400 });
      }
      log("POST payload length:", request.headers.get("content-length"));
  
      const val = raw?.entry?.[0]?.changes?.[0]?.value;
  
      // 2a) Status‑Events wegfiltern
      if (!val?.messages || val.statuses) {
        log("drop: status event");
        return new Response("dropped status", { status: 200 });
      }
  
      // 2b) Echo‑Messages (von eigener Nummer) wegfiltern
      const from = val.messages[0]?.from;
      if (from === env.BUSINESS_PHONE_MSISDN) {
        log("drop: echo from own number", from);
        return new Response("dropped echo", { status: 200 });
      }
  
      // 2c) Weiterleiten an n8n
      try {
        const resp = await fetch(env.N8N_URL, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(raw),
        });
        log("forward to n8n →", env.N8N_URL, "status:", resp.status);
      } catch (err) {
        log("ERROR forwarding to n8n:", err);
        return new Response("n8n unreachable", { status: 502 });
      }
      return new Response("ok", { status: 200 });
    }
  }