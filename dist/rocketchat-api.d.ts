/**
 * RocketChat REST API client for the OpenClaw plugin.
 * Handles authentication and outbound message delivery.
 */
export interface RocketChatConfig {
    serverUrl: string;
    botUsername: string;
    botAuthToken: string;
    botUserId: string;
    webhookSecret?: string;
    allowFrom?: string[];
}
export interface SendMessageResult {
    messageId: string;
    roomId: string;
    ts: number;
}
export declare function sendMessage(config: RocketChatConfig, roomId: string, text: string, threadId?: string): Promise<SendMessageResult>;
export declare function getRoomId(config: RocketChatConfig, roomName: string): Promise<string | null>;
export declare function loginBot(serverUrl: string, username: string, password: string): Promise<{
    authToken: string;
    userId: string;
}>;
//# sourceMappingURL=rocketchat-api.d.ts.map