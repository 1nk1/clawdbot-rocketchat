/**
 * Clawdbot RocketChat Channel Plugin
 *
 * Inbound:  RocketChat Outgoing Webhook → POST /webhook/rocketchat
 * Outbound: RocketChat Incoming Webhook URL (no auth tokens needed)
 *
 * Setup in RocketChat:
 *  1. Admin → Integrations → New Outgoing Webhook
 *       Event: Message Sent, URLs: https://<host>/webhook/rocketchat
 *       Token: <webhookSecret from config>
 *  2. Admin → Integrations → New Incoming Webhook
 *       Copy the URL → set as channels.rocketchat.incomingWebhookUrl
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { sendMessage, type RocketChatConfig } from "./rocketchat-api.js";

// ── Types ────────────────────────────────────────────────────────────────────

interface RocketChatPluginConfig {
  serverUrl?: string;
  botUsername?: string;
  botAuthToken?: string;
  botUserId?: string;
  incomingWebhookUrl?: string;
  webhookSecret?: string;
  allowFrom?: string[];
}

interface RocketWebhookPayload {
  token: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  text: string;
  message_id: string;
  tmid?: string;
}

// ── Runtime storage ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _runtime: any = null;

function getRcConfig(): RocketChatPluginConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = _runtime?.config.loadConfig() as Record<string, unknown> | undefined;
  const channels = cfg?.["channels"] as Record<string, unknown> | undefined;
  return (channels?.["rocketchat"] as RocketChatPluginConfig) ?? {};
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// ── Webhook handler ──────────────────────────────────────────────────────────

async function handleWebhook(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: RocketWebhookPayload;
  try {
    const raw = await readBody(req);
    body = JSON.parse(raw) as RocketWebhookPayload;
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "invalid json" }));
    return;
  }

  const rc = getRcConfig();

  if (rc.webhookSecret && body.token !== rc.webhookSecret) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "invalid token" }));
    return;
  }

  if (body.user_name === rc.botUsername || !body.text?.trim()) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (!_runtime) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not ready" }));
    return;
  }

  // Respond to RocketChat immediately — do not block on agent response
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ success: true }));

  const core = _runtime;
  const cfg = core.config.loadConfig();

  const rcCfg: RocketChatConfig = {
    serverUrl: rc.serverUrl ?? "",
    botAuthToken: rc.botAuthToken ?? "",
    botUserId: rc.botUserId ?? "",
    botUsername: rc.botUsername ?? "",
    ...(rc.incomingWebhookUrl !== undefined && { incomingWebhookUrl: rc.incomingWebhookUrl }),
    ...(rc.webhookSecret !== undefined && { webhookSecret: rc.webhookSecret }),
    ...(rc.allowFrom !== undefined && { allowFrom: rc.allowFrom }),
  };

  const bodyText = body.text.trim();
  const senderName = body.user_name;
  const channelId = body.channel_id;

  try {
    const envelopeBody = core.channel.reply.formatInboundEnvelope({
      channel: "RocketChat",
      from: senderName,
      body: bodyText,
      chatType: "direct",
      timestamp: Date.now(),
    });

    const ctx = core.channel.reply.finalizeInboundContext({
      Body: envelopeBody,
      RawBody: bodyText,
      CommandBody: bodyText,
      From: `rocketchat:${senderName}`,
      To: `user:${senderName}`,
      SessionKey: `rocketchat:dm:${channelId}`,
      AccountId: "default",
      ChatType: "direct",
      ConversationLabel: body.channel_name || senderName,
      SenderName: senderName,
      SenderId: senderName,
      Provider: "rocketchat",
      Surface: "rocketchat",
      MessageSid: body.message_id,
      CommandAuthorized: false,
    });

    const { dispatcher, replyOptions, markDispatchIdle } =
      core.channel.reply.createReplyDispatcherWithTyping({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        deliver: async (payload: any) => {
          await sendMessage(rcCfg, channelId, payload.text ?? "", body.tmid);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: Error, info: any) => {
          console.error(`[rocketchat] ${info.kind} error:`, err);
        },
      });

    await core.channel.reply.dispatchReplyFromConfig({
      ctx,
      cfg,
      dispatcher,
      replyOptions,
    });

    markDispatchIdle();
  } catch (err) {
    console.error("[rocketchat] dispatch error:", err);
  }
}

// ── Plugin entry ─────────────────────────────────────────────────────────────

export default {
  id: "rocketchat",
  name: "RocketChat",
  kind: "channel",
  description: "Connect Clawdbot to RocketChat via outgoing webhook",

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(api: any) {
    _runtime = api.runtime;

    api.registerHttpRoute({
      path: "/webhook/rocketchat",
      handler: handleWebhook,
    });

    console.log("[rocketchat] webhook listener ready on /webhook/rocketchat");
  },
};
