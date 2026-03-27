# OpenClaw RocketChat Plugin — Setup Guide

## 1. Install dependencies

```bash
cd ~/projects/clawdbot-plugin
npm install
```

## 2. Install plugin into OpenClaw

```bash
openclaw plugins install ~/projects/clawdbot-plugin
```

## 3. Create bot user in RocketChat

1. Admin → Users → New User
   - Username: `clawdbot`
   - Role: `bot`
   - Set a password
2. Admin → Users → clawdbot → Personal Access Tokens → Add
   - Copy **Auth Token** and **User ID**

## 4. Configure plugin in OpenClaw

```bash
openclaw config set rocketchat.serverUrl    https://rocketchat.qantum.one
openclaw config set rocketchat.botUsername  clawdbot
openclaw config set rocketchat.botAuthToken <auth-token-from-step-3>
openclaw config set rocketchat.botUserId    <user-id-from-step-3>
openclaw config set rocketchat.webhookSecret <random-secret>
```

## 5. Set up Outgoing Webhook in RocketChat

Admin → Integrations → New → Outgoing

| Field | Value |
|-------|-------|
| Event Trigger | Message Sent |
| Enabled | Yes |
| Channel | `#general` (or all channels) |
| URLs | `https://<openclaw-host>/webhook/rocketchat` |
| Token | same as `rocketchat.webhookSecret` |
| Script Enabled | No |

## 6. Add bot to channels

In each channel where you want the bot: Add Member → `clawdbot`

## 7. Test

Send a message mentioning the bot in any channel. It should respond via OpenClaw.
