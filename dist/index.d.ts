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
declare const _default: {
    id: string;
    name: string;
    kind: string;
    description: string;
    register(api: any): void;
};
export default _default;
//# sourceMappingURL=index.d.ts.map