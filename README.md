# n8n × WhatsApp Cloud API — Edge‑filtering with Cloudflare Workers  
Cut 80 % of webhook noise, keep your n8n run‑quota for **real** user messages.

---

## ✨ Why bother?

| Pain without filter | What it does to **n8n Cloud** |
|---------------------|--------------------------------|
| WhatsApp fires **_all_** events at your webhook:<br>• echo of every outbound message<br>• 3‑4 delivery/read `status` pings per msg<br>• `hub.verify_token` handshake<br>• health checks | Every hit spawns a workflow execution = a “run”.<br>Hundreds – thousands per day → $$$ + cluttered logs |

**Goal:** n8n should only process **actual user messages**.

**Fix:** Put a 20‑line **Cloudflare Worker** in front:

User ──► WhatsApp Cloud API

│ (raw flood)

▼

Cloudflare Worker

├─ handles GET handshake

├─ drops status + echo events

└─ forwards clean POST JSON

│ (filtered)

▼

n8n Webhook

▼

Your automation


Result: **> 80 % fewer executions** while everything important still arrives.

---

## 🚀 Deploy in 5 minutes

### 1 · Create the Worker


 dash.cloudflare.com → Workers & Pages → Create Service → "Start from scratch"
 name it e.g.  wa-filter

### 2 · Paste this worker.js
-->repo

### 3 · Add environment variables
Settings → Variables & Secrets

Name	Value
N8N_URL	Production webhook URL from n8n (includes UUID!)
BUSINESS_PHONE_MSISDN	Your WABA number without +, e.g. 491701234567
VERIFY_TOKEN	Same string you enter in Meta

Click Save → Deploy.

### 4 · Point Meta to the Worker

Meta → WhatsApp → Configuration → Webhooks
Callback URL  = https://wa-filter.<id>.workers.dev
Verify Token  = <VERIFY_TOKEN>

### 5 · Minimum n8n setup
Need	Details
Version	≥ 1.71 (WhatsApp Business Cloud node present)
Credentials	WhatsApp Business Cloud (API key):
 • permanent System‑User token
 • Business Account ID
#### Workflow
1️⃣ Webhook‑Node (POST) – path wa-in, Active.
2️⃣ Logic nodes (IF/Set/Send).
3️⃣ Respond‑to‑Webhook node (200, optional).

Scopes	Token needs whatsapp_business_messaging and whatsapp_business_management.

### 6 · What you save
Scenario	Events/day	Executions w/ Worker
200 outbound msgs	200 echo + 600 status	0
200 inbound msgs	200	200 (can’t avoid☺)
Total	1000	200 (‑80 %)
Keep your run‑quota for useful work, not protocol noise.

## · Happy automating! 🚀


