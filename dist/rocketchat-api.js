/**
 * RocketChat REST API client for the OpenClaw plugin.
 * Handles authentication and outbound message delivery.
 */
export async function sendMessage(config, roomId, text, threadId) {
    const url = `${config.serverUrl}/api/v1/chat.postMessage`;
    const body = {
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
    const data = (await res.json());
    return {
        messageId: data.message._id,
        roomId: data.message.rid,
        ts: data.message.ts.$date,
    };
}
export async function getRoomId(config, roomName) {
    const url = `${config.serverUrl}/api/v1/rooms.info?roomName=${encodeURIComponent(roomName)}`;
    const res = await fetch(url, {
        headers: {
            "X-Auth-Token": config.botAuthToken,
            "X-User-Id": config.botUserId,
        },
    });
    if (!res.ok)
        return null;
    const data = (await res.json());
    return data.room?._id ?? null;
}
export async function loginBot(serverUrl, username, password) {
    const res = await fetch(`${serverUrl}/api/v1/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
        throw new Error(`RocketChat login failed: ${await res.text()}`);
    }
    const data = (await res.json());
    return data.data;
}
//# sourceMappingURL=rocketchat-api.js.map