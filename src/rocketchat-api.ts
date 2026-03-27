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

export async function sendMessage(
  config: RocketChatConfig,
  roomId: string,
  text: string,
  threadId?: string,
): Promise<SendMessageResult> {
  const url = `${config.serverUrl}/api/v1/chat.postMessage`;
  const body: Record<string, unknown> = {
    roomId,
    text,
  };
  if (threadId) {
    body.tmid = threadId;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": config.botAuthToken,
      "X-User-Id": config.botUserId,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RocketChat sendMessage failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as {
    success: boolean;
    message: { _id: string; rid: string; ts: { $date: number } };
  };

  return {
    messageId: data.message._id,
    roomId: data.message.rid,
    ts: data.message.ts.$date,
  };
}

export async function getRoomId(
  config: RocketChatConfig,
  roomName: string,
): Promise<string | null> {
  const url = `${config.serverUrl}/api/v1/rooms.info?roomName=${encodeURIComponent(roomName)}`;
  const res = await fetch(url, {
    headers: {
      "X-Auth-Token": config.botAuthToken,
      "X-User-Id": config.botUserId,
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { room?: { _id: string } };
  return data.room?._id ?? null;
}

export async function loginBot(
  serverUrl: string,
  username: string,
  password: string,
): Promise<{ authToken: string; userId: string }> {
  const res = await fetch(`${serverUrl}/api/v1/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`RocketChat login failed: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    data: { authToken: string; userId: string };
  };
  return data.data;
}
