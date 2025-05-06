````markdown
# n8n × WhatsApp Cloud API — Edge filtering with Cloudflare Workers
Cut **~80 %** of webhook noise and keep your n8n run‑quota for *real* user messages.

---

## ✨ Why bother?

| Pain without filter | Impact on **n8n Cloud** |
|---------------------|--------------------------|
| WhatsApp sends **_all_** events to your webhook:<br>• echo of every outbound message<br>• 3‑4 delivery/read `status` pings per message<br>• `hub.verify_token` handshake<br>• periodic health checks | Each hit spawns a workflow execution → counted as a **run**.<br>Hundreds – thousands per day → $$$ + noisy logs |

---

## 🎯 Goal & Fix

**Goal** – n8n should execute **only on real user messages**, not on status spam or echo loops.

**Fix** – place a tiny (≈ 20 LOC) **Cloudflare Worker** in front of n8n:

```mermaid
graph TD
    A[User phone] -->|text / media| B[WhatsApp Cloud API]
    B -->|raw flood| C[Cloudflare Worker]
    C -->|GET → hub.challenge 200| C
    C -->|status / echo → DROP| C
    C -->|clean POST JSON| D[n8n Webhook]
    D --> E[Your workflow logic]
````

* **handles** the initial `GET hub.verify_token` handshake
* **drops** `status` and echo events
* **forwards** only clean POST payloads
* **result:** > 80 % less traffic hitting n8n while every important message still arrives

---

## 🚀 Deploy in 5 minutes

### 1 · Create the Worker

```text
dash.cloudflare.com → Workers & Pages → Create Service → “Start from scratch”
name it e.g.  wa-filter
```

### 2 · Paste this `worker.js`

> Put the full script in your repo; here’s the gist:

```js
export default {
  async fetch(request, env) {
    /* 1 — GET handshake */
    if (request.method === "GET") {
      const u = new URL(request.url);
      if (
        u.searchParams.get("hub.verify_token") === env.VERIFY_TOKEN &&
        u.searchParams.get("hub.challenge")
      )
        return new Response(u.searchParams.get("hub.challenge"), { status: 200 });
      return new Response("Forbidden", { status: 403 });
    }

    /* 2 — POST events */
    const raw = await request.json();
    const v   = raw?.entry?.[0]?.changes?.[0]?.value;

    if (!v?.messages || v.statuses)                         // delivery/read spam
      return new Response("dropped status", { status: 200 });

    if (v.messages[0]?.from === env.BUSINESS_PHONE_MSISDN)  // echo of own msg
      return new Response("dropped echo",   { status: 200 });

    /* 3 — forward to n8n */
    return fetch(env.N8N_URL, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify(raw),
    });
  }
}
```

### 3 · Add environment variables

*Settings → Variables & Secrets*

| Name                    | Example value                                    |
| ----------------------- | ------------------------------------------------ |
| `N8N_URL`               | `https://w‑2.app.n8n.cloud/webhook/wa-in/<uuid>` |
| `BUSINESS_PHONE_MSISDN` | `491701234567`                                   |
| `VERIFY_TOKEN`          | same string you enter in Meta                    |

Click **Save** → **Deploy**.

### 4 · Point Meta to the Worker

```
Meta → WhatsApp → Configuration → Webhooks
Callback URL = https://wa-filter.<id>.workers.dev
Verify Token = <VERIFY_TOKEN>
```

### 5 · Minimum n8n setup

| Need            | Details                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **n8n version** |  ≥ 1.71 (WhatsApp Business Cloud node included)                                                                                            |
| **Credentials** | WhatsApp Business Cloud (API key):<br>• permanent System‑User token<br>• Business Account ID                                               |
| **Workflow**    | 1️⃣ Webhook‑Node (POST) – path `wa-in`, **Active**.<br>2️⃣ Logic nodes (IF/Set/Send).<br>3️⃣ Respond‑to‑Webhook node (HTTP 200, optional). |
| **Scopes**      | Token needs `whatsapp_business_messaging` and `whatsapp_business_management`.                                                              |

---

## 📈 What you save

| **Scenario**          | **Events / day**      | **Executions with Worker** |
| --------------------- | --------------------- | -------------------------- |
| 200 outbound messages | 200 echo + 600 status | **0**                      |
| 200 inbound messages  | 200                   | **200** (can’t avoid ☺)    |
| **Total**             | **1 000**             | **200 (‑80 %)**            |

---

Happy automating! 🚀

```
```
