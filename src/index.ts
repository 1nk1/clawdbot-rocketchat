/**
 * OpenClaw RocketChat Channel Plugin
 *
 * Inbound:  RocketChat Outgoing Webhook → POST /webhook/rocketchat
 * Outbound: RocketChat REST API (chat.postMessage)
 *
 * Setup in RocketChat:
 *  1. Admin → Users → create bot user (role: bot), get auth token + userId
 *  2. Admin → Integrations → Outgoing Webhook:
 *       Event: Message Sent
 *       URLs: https://<openclaw-host>/webhook/rocketchat
 *       Token: <webhookSecret from config>
 */

import {
  createChatChannelPlugin,
  DEFAULT_ACCOUNT_ID,
} from "openclaw/plugin-sdk/core";
import { dispatchInboundDirectDmWithRuntime } from "openclaw/plugin-sdk/channel-inbound";
import { readJsonWebhookBodyOrReject } from "openclaw/plugin-sdk/webhook-ingress";
import type { IncomingMessage, ServerResponse } from "node:http";
import { sendMessage, type RocketChatConfig } from "./rocketchat-api.js";

// ── Types ────────────────────────────────────────────────────────────────────

interface RocketChatPluginConfig {
  serverUrl?: string;
  botUsername?: string;
  botAuthToken?: string;
  botUserId?: string;
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

type ResolvedRcAccount = {
  accountId: string;
  serverUrl: string;
  botAuthToken: string;
  botUserId: string;
  botUsername: string;
  webhookSecret?: string;
  allowFrom: string[];
};

// ── Runtime storage ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _runtime: any = null;

function getRcConfig(): RocketChatPluginConfig {
  const cfg = _runtime?.config.loadConfig() as
    | Record<string, unknown>
    | undefined;
  const channels = cfg?.["channels"] as Record<string, unknown> | undefined;
  return (channels?.["rocketchat"] as RocketChatPluginConfig) ?? {};
}

// ── Channel plugin ───────────────────────────────────────────────────────────

const plugin = createChatChannelPlugin<ResolvedRcAccount>({
  base: {
    id: "rocketchat",
    meta: {
      id: "rocketchat",
      label: "RocketChat",
      selectionLabel: "RocketChat",
      docsPath: "/channels/rocketchat",
      blurb: "Self-hosted team chat via webhook",
      order: 70,
    },
    capabilities: {
      chatTypes: ["direct", "channel"],
      threads: false,
      media: false,
    },
    config: {
      listAccountIds: (_cfg) => [DEFAULT_ACCOUNT_ID],
      resolveAccount: (_cfg, _accountId) => {
        const rc = getRcConfig();
        return {
          accountId: DEFAULT_ACCOUNT_ID,
          serverUrl: rc.serverUrl ?? "",
          botAuthToken: rc.botAuthToken ?? "",
          botUserId: rc.botUserId ?? "",
          botUsername: rc.botUsername ?? "",
          webhookSecret: rc.webhookSecret,
          allowFrom: rc.allowFrom ?? [],
        };
      },
    },
  },

  // DM security: honour allowFrom list if configured
  security: {
    dm: {
      channelKey: "rocketchat",
      resolvePolicy: (account: ResolvedRcAccount) =>
        account.allowFrom.length > 0 ? "allowlist" : "open",
      resolveAllowFrom: (account: ResolvedRcAccount) => account.allowFrom,
      approveHint:
        'openclaw config set channels.rocketchat.allowFrom \'["username"]\'',
      normalizeEntry: (r: string) => r.trim().replace(/^@/, "").toLowerCase(),
    },
  },
});

// ── Plugin entry ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default {
  id: "rocketchat",
  name: "RocketChat",
  kind: "channel",
  description: "Connect Clawdbot to RocketChat via outgoing webhook",

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(api: any) {
    _runtime = api.runtime;

    // Register the channel so clawdbot recognises "rocketchat" as a known channel id
    api.registerChannel({ plugin });

    // Register the inbound webhook route
    api.registerHttpRoute({
      path: "/webhook/rocketchat",
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const rc = getRcConfig();

        const parsed = await readJsonWebhookBodyOrReject({ req, res });
        if (!parsed.ok) return;
        const body = parsed.value as RocketWebhookPayload;

        // Validate webhook secret
        if (rc.webhookSecret && body.token !== rc.webhookSecret) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid token" }));
          return;
        }

        // Skip bot's own messages and empty text
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

        const rcCfg: RocketChatConfig = {
          serverUrl: rc.serverUrl ?? "",
          botAuthToken: rc.botAuthToken ?? "",
          botUserId: rc.botUserId ?? "",
          botUsername: rc.botUsername ?? "",
          ...(rc.webhookSecret !== undefined && { webhookSecret: rc.webhookSecret }),
          ...(rc.allowFrom !== undefined && { allowFrom: rc.allowFrom }),
        };

        // Respond to RocketChat immediately — do not block on agent response
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));

        const cfg = _runtime.config.loadConfig();

        await dispatchInboundDirectDmWithRuntime({
          cfg,
          runtime: _runtime,
          channel: "rocketchat",
          channelLabel: "RocketChat",
          accountId: DEFAULT_ACCOUNT_ID,
          peer: { kind: "direct", id: body.channel_id },
          senderId: body.user_name,
          senderAddress: body.user_name,
          recipientAddress: rc.botUsername ?? "bot",
          conversationLabel: body.channel_name || body.user_name,
          rawBody: body.text,
          messageId: body.message_id,
          timestamp: Date.now(),
          deliver: async (payload) => {
            await sendMessage(
              rcCfg,
              body.channel_id,
              payload.text ?? "",
              body.tmid,
            );
          },
          onRecordError: (err) => {
            console.error("[rocketchat] session record error:", err);
          },
          onDispatchError: (err, info) => {
            console.error(`[rocketchat] dispatch ${info.kind} error:`, err);
          },
        });
      },
    });
  },
};
