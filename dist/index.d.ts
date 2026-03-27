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
declare const _default: {
    id: string;
    name: string;
    kind: string;
    description: string;
    register(api: any): void;
};
export default _default;
//# sourceMappingURL=index.d.ts.map