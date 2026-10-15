# Ivy: a Tavus PAL with an AgentMail inbox

A small proof of concept. Ivy is a real-time Tavus video agent (PAL) that owns an AgentMail inbox. On a live call she:

1. reads and summarises email when asked ("what's in my inbox?"),
2. replies to or sends email, only after the user confirms out loud,
3. announces new email that arrives during the call, without being asked.

## How it works

```text
              ┌──────────── Tavus PAL "Ivy" ─────────────┐
 browser ◄────┤ video call (Daily)                        │
   ▲  │       │ layers.mcp ─► background agent ─► AgentMail MCP (mcp.agentmail.to)
   │  │       └───────────────────────────────────────────┘      bearer: AgentMail API key
   │  │ app messages: agent_start/stop, utterance (in)
   │  │                conversation.respond / append_llm_context (out)
   │  ▼
 SSE /api/events ◄── Node server ◄── AgentMail WebSocket (message.received)
```

- **Email actions (no custom tool code).** `scripts/setup.ts` registers AgentMail's hosted MCP server as a Tavus connector, using the API key as a bearer token, and attaches it to the PAL. The PAL may only call 7 tools: `list_messages`, `search_messages`, `get_message`, `list_threads`, `get_thread`, `send_message` and `reply_to_message`. Tool guidance lives in `layers.mcp.prompt`. The "confirm before sending" rule lives in the PAL's `system_prompt`.
- **Live announcements.** The server subscribes to AgentMail's WebSocket for both demo inboxes, deduplicates by `messageId` and pushes events to the page over SSE. The page forwards each new email into the call over the Daily data channel:
  - **Announce** (default) sends `conversation.respond` with a `[SYSTEM NOTICE]`, and Ivy says it out loud.
  - **Silent context** sends `conversation.append_llm_context`, so Ivy knows about the email but only mentions it if asked.
- **Secrets stay on the server.** The browser only ever sees the Daily room URL.

## Setup

Requires [mise](https://mise.jdx.dev) (Node 24.15.0 and Bun 1.3.1 from `.tool-versions`). Then:

```bash
bun install
```

Add the keys to `.env`:

```text
TAVUS_API_KEY=...       # Tavus Developer Portal → API keys
AGENTMAIL_API_KEY=...   # console.agentmail.to → Settings → API Keys
```

Create everything. The setup is idempotent and safe to re-run:

```bash
bun run setup
```

It creates two inboxes (`ivy-tavus@agentmail.to` for Ivy, plus a tester inbox shown as "Sam Rivera"), seeds three emails into an empty Ivy inbox, upserts the connector and checks it with `runtime_check`, then upserts the PAL. The ids are written to `state.json`.

Run the demo at http://localhost:3000:

```bash
bun run start
```

`bun run dev` rebuilds and restarts on change. `bun run lint` and `bun run typecheck` must pass before committing.

## Deploy

The Railway service `tavus-demo` deploys `main` automatically from GitHub. It builds the `Dockerfile`, which runs the idempotent `setup` before starting the server. Its variables are `TAVUS_API_KEY` and `AGENTMAIL_API_KEY`. Startup fails if either is missing.

## Demo script (about 3 minutes)

1. Click **Start call**. Ask: *"What's in my inbox?"* The side panel shows the background task running, then `done` with its duration. Ivy summarises the seeded mail.
2. Click **Send test email** (or email `ivy-tavus@agentmail.to` from your phone). Within a few seconds Ivy announces it. The log shows when the email arrived, and the time from email to speech.
3. Say *"Reply that I'll call them tomorrow."* Ivy reads back the recipient, subject and gist, then waits. Say *"yes"*. The reply lands in the tester inbox, and the log shows it as a `REPLY` line.

## Measured latency

- From **Send test email** to the email reaching the page: 1.5 to 1.6 s (3 runs). That covers the AgentMail send, delivery, the WebSocket event and SSE.
- From the email reaching the page to Ivy starting to speak: logged live as a `LATENCY` line during a call. It hasn't been measured yet, because that needs a billed conversation.

## Known limits

- **Confirmation is enforced by the prompt, not by code.** The background agent is told to send only when the task says the user confirmed. A hard gate would need app-side tools (Plan B in the brief) or a confirm step in front of `send_message`.
- **The connector uses the org-wide AgentMail key.** The PAL is limited to 7 tools, and the prompt pins it to one inbox, but the tools take an `inbox_id` argument. Next step: an inbox-scoped AgentMail API key for the connector, so Ivy can't reach any other inbox even if the prompt is ignored.
- **Announcements need this page in the call.** Tavus interactions travel over the Daily data channel, and I found no REST equivalent. With no browser joined, nothing is announced.
- **Notices count as user turns.** `conversation.respond` counts as user speech, so notices appear in the transcript as the user. A notice that lands while the user is talking can collide with their turn.
- **Calls are billed from creation.** Calls are capped at 10 minutes, end 60 s after creation if nobody joins, and end 10 s after you leave. The page also ends the call on **End call**, on Daily's leave button and on tab close (`sendBeacon`).
- Deduplication is in memory, the page has no auth by design, so anyone with the URL can start a billed call or send mail from the tester inbox, and AgentMail's free plan appends a "Sent via AgentMail" footer to outgoing mail.

See [FRICTION.md](FRICTION.md) for the API and docs issues hit while building this.
