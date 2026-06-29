import express from "express";
import pino from "pino";
import { createHmac } from "crypto";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import QRCode from "qrcode";
import baileys from "@whiskeysockets/baileys";

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = baileys;

const PORT = Number(process.env.PORT ?? 8080);
const DATA_DIR = process.env.DATA_DIR ?? "/data";
const WORKER_SECRET = process.env.WORKER_SECRET;
const STAYOS_WEBHOOK_BASE = (process.env.STAYOS_WEBHOOK_BASE ?? "").replace(/\/$/, "");

if (!WORKER_SECRET) { console.error("FATAL: WORKER_SECRET required"); process.exit(1); }
if (!STAYOS_WEBHOOK_BASE) console.warn("WARN: STAYOS_WEBHOOK_BASE not set");

mkdirSync(join(DATA_DIR, "sessions"), { recursive: true });
const logger = pino({ level: "info" });
const sessions = new Map();

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (req.header("x-worker-secret") !== WORKER_SECRET) return res.status(401).json({ error: "unauthorized" });
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, sessions: sessions.size, ts: Date.now() }));

app.get("/sessions", (_req, res) => {
  res.json(Array.from(sessions.entries()).map(([id, s]) => ({
    id, status: s.status, phone: s.phone ?? null, lastQrAt: s.lastQrAt ?? null,
  })));
});

app.get("/sessions/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "not_found" });
  res.json({ id: req.params.id, status: s.status, phone: s.phone ?? null, lastQrAt: s.lastQrAt ?? null });
});

app.get("/sessions/:id/qr", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "not_found" });
  res.json({ qr: s.lastQr ?? null, status: s.status });
});

app.post("/sessions", async (req, res) => {
  const { connectionId, tenantId } = req.body ?? {};
  if (!connectionId) return res.status(400).json({ error: "connectionId required" });
  try { await startSession(connectionId, tenantId); const s = sessions.get(connectionId);
    res.json({ ok: true, status: s?.status ?? "pending" });
  } catch (e) { logger.error({ err: e }, "startSession failed"); res.status(500).json({ error: String(e?.message ?? e) }); }
});

app.post("/sessions/:id/send", async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s || !s.sock) return res.status(409).json({ error: "session not connected" });
  const { to, text } = req.body ?? {};
  if (!to || !text) return res.status(400).json({ error: "to and text required" });
  try {
    const jid = to.includes("@") ? to : `${String(to).replace(/\D/g, "")}@s.whatsapp.net`;
    const sent = await s.sock.sendMessage(jid, { text: String(text).slice(0, 4096) });
    res.json({ ok: true, providerMessageId: sent?.key?.id ?? null });
  } catch (e) { res.status(500).json({ error: String(e?.message ?? e) }); }
});

app.delete("/sessions/:id", async (req, res) => {
  const id = req.params.id; const s = sessions.get(id);
  try { await s?.sock?.logout?.(); } catch {}
  sessions.delete(id);
  try { rmSync(join(DATA_DIR, "sessions", id), { recursive: true, force: true }); } catch {}
  res.json({ ok: true });
});

// Self-test: worker → StayOS signed webhook round-trip.
app.post("/selftest", async (req, res) => {
  if (!STAYOS_WEBHOOK_BASE) return res.status(400).json({ ok: false, error: "STAYOS_WEBHOOK_BASE not set" });
  const id = (req.body?.connectionId ?? "selftest").toString();
  const body = JSON.stringify({ type: "selftest", ts: Date.now() });
  const sig = createHmac("sha256", WORKER_SECRET).update(body).digest("hex");
  const started = Date.now();
  try {
    const r = await fetch(`${STAYOS_WEBHOOK_BASE}/api/public/baileys-healthcheck/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Worker-Signature": sig }, body,
    });
    const text = await r.text();
    res.json({ ok: r.ok, status: r.status, latencyMs: Date.now() - started, response: text.slice(0, 200) });
  } catch (e) { res.status(502).json({ ok: false, error: String(e?.message ?? e) }); }
});

async function startSession(connectionId, tenantId) {
  if (sessions.get(connectionId)?.status === "connected") return;
  const dir = join(DATA_DIR, "sessions", connectionId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version, auth: state, printQRInTerminal: false,
    logger: logger.child({ session: connectionId }),
    browser: ["StayOS", "Chrome", "1.0"],
  });
  sessions.set(connectionId, { sock, status: "pending", tenantId });
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", async (u) => {
    const s = sessions.get(connectionId); if (!s) return;
    if (u.qr) {
      try {
        const dataUrl = await QRCode.toDataURL(u.qr, { margin: 1, scale: 6 });
        s.lastQr = dataUrl; s.lastQrAt = Date.now(); s.status = "pending";
        sendWebhook(connectionId, { type: "qr", qr: dataUrl });
      } catch (e) { logger.error({ e }, "qr render failed"); }
    }
    if (u.connection === "open") {
      s.status = "connected"; s.phone = sock.user?.id?.split(":")[0]?.split("@")[0] ?? null; s.lastQr = undefined;
      sendWebhook(connectionId, { type: "connected", phone: s.phone });
    }
    if (u.connection === "close") {
      const code = u.lastDisconnect?.error?.output?.statusCode;
      s.status = "disconnected";
      sendWebhook(connectionId, { type: "disconnected", reason: code ?? "closed" });
      if (code !== DisconnectReason.loggedOut) setTimeout(() => startSession(connectionId, tenantId).catch(() => {}), 3000);
      else { sessions.delete(connectionId); try { rmSync(dir, { recursive: true, force: true }); } catch {} }
    }
  });
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      if (!m.message || m.key.fromMe) continue;
      const jid = m.key.remoteJid ?? ""; if (jid.endsWith("@g.us")) continue;
      const externalId = jid.replace(/@.*/, "");
      const text = m.message.conversation ?? m.message.extendedTextMessage?.text
        ?? m.message.imageMessage?.caption ?? m.message.videoMessage?.caption ?? "";
      if (!text) continue;
      sendWebhook(connectionId, { type: "message.inbound", externalId, name: m.pushName ?? null, text, providerEventId: m.key.id ?? null });
    }
  });
}

function sendWebhook(connectionId, payload) {
  if (!STAYOS_WEBHOOK_BASE) return;
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", WORKER_SECRET).update(body).digest("hex");
  fetch(`${STAYOS_WEBHOOK_BASE}/api/public/baileys/${connectionId}`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Worker-Signature": sig }, body,
  }).catch((e) => logger.warn({ e, connectionId }, "webhook failed"));
}

app.listen(PORT, () => logger.info(`Baileys worker listening on :${PORT}`));
