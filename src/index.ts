/**
 * OpenClaw RocketChat Channel Plugin
 *
 * Connects ClawdBot/OpenClaw to RocketChat via:
 *  - Inbound:  RocketChat Outgoing Webhook → HTTP endpoint registered here
 *  - Outbound: RocketChat REST API (chat.postMessage)
 *
 * Setup in RocketChat:
 *  1. Admin → Users → create bot user (role: bot), get auth token + userId
 *  2. Admin → Integrations → Outgoing Webhook:
 *       Event: Message Sent
 *       URLs: https://<openclaw-host>/webhook/rocketchat
 *       Token: <webhookSecret from config>
 */

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createChatChannelPlugin } from "openclaw/plugin-sdk/channel";
import { Type } from "@sinclair/typebox";
import { sendMessage, type RocketChatConfig } from "./rocketchat-api.js";
// Shape of an inbound RocketChat outgoing webhook payload
interface RocketWebhookPayload {
  token: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  text: string;
  message_id: string;
  tmid?: string; // thread parent message id
}

export default definePluginEntry({
  id: "rocketchat",

  register(api) {
    // ── Channel plugin ────────────────────────────────────────────────────────
    api.registerChannel(
      createChatChannelPlugin({
        id: "rocketchat",
        label: "RocketChat",

        // Config schema for user-facing setup
        configSchema: Type.Object({
          serverUrl: Type.String({ description: "e.g. https://rocketchat.qantum.one" }),
          botUsername: Type.String(),
          botAuthToken: Type.String(),
          botUserId: Type.String(),
          webhookSecret: Type.Optional(Type.String()),
          allowFrom: Type.Optional(Type.Array(Type.String())),
        }),

        // DM security: only allow users in allowFrom list (if configured)
        dmSecurity: {
          resolver: async (accountId, config) => {
            const cfg = config?.rocketchat as RocketChatConfig | undefined;
            const allowed = cfg?.allowFrom;
            if (!allowed || allowed.length === 0) return true; // open
            return allowed.includes(accountId);
          },
        },

        // Outbound: send a message to RocketChat
        outbound: {
          async send(message, config) {
            const cfg = config?.rocketchat as RocketChatConfig;
            if (!cfg?.serverUrl || !cfg?.botAuthToken || !cfg?.botUserId) {
              throw new Error("RocketChat plugin not configured");
            }

            const result = await sendMessage(
              cfg,
              message.roomId as string,
              message.text,
              message.threadId as string | undefined,
            );

            return {
              messageId: result.messageId,
              ts: result.ts,
            };
          },
        },
      }),
    );

    // ── Inbound webhook: receives messages from RocketChat ────────────────────
    api.registerHttpRoute({
      method: "POST",
      path: "/webhook/rocketchat",
      async handler(req, res, { ingestMessage, getConfig }) {
        const cfg = (await getConfig())?.rocketchat as RocketChatConfig | undefined;
        const body = req.body as RocketWebhookPayload;

        // Validate webhook secret if configured
        if (cfg?.webhookSecret && body.token !== cfg.webhookSecret) {
          res.status(401).json({ error: "invalid token" });
          return;
        }

        // Ignore messages sent by the bot itself
        if (body.user_name === cfg?.botUsername) {
          res.status(200).json({ success: true });
          return;
        }

        // Skip empty messages
        if (!body.text?.trim()) {
          res.status(200).json({ success: true });
          return;
        }

        // Deliver to OpenClaw inbound pipeline
        await ingestMessage({
          channelId: "rocketchat",
          accountId: body.user_name,
          roomId: body.channel_id,
          roomName: body.channel_name,
          messageId: body.message_id,
          threadId: body.tmid,
          text: body.text,
          ts: Date.now(),
        });

        res.status(200).json({ success: true });
      },
    });
  },
});
