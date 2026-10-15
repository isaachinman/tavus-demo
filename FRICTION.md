# Friction log

Each line covers what happened, where, and what would fix it. Logged while building this POC on 15 Oct 2026 against `agentmail@0.5.46` and the live Tavus API.

## Tavus

- **Event schema docs render empty.** `sections/event-schemas/conversation-append-context` (also `conversation-respond`, `conversation-utterance` and `conversation-agent-stop`) shows only a title, in HTML and in the `.md` export. The schemas exist only under `components` in `openapi.yaml`. Fix: render the OpenAPI component on each page.
- **The append-context page has the wrong event name.** The page is called "Append Conversational Context", but the real event is `conversation.append_llm_context` with `properties.context`, and the `.md` slug suggests `conversation.append_context`. I only found the right name by grepping `openapi.yaml`. Fix: title each event page with its exact `event_type`.
- **Create PAL silently rewrote `pal_name`.** `"Ivy (AgentMail demo)"` was stored as `"Ivy AgentMail demo "`: parentheses stripped, a trailing space left, a 200 response, no warning. My lookup-by-name upsert missed it and created a duplicate PAL. Fix: store names as sent, or reject them with a 400 that lists the allowed characters.
- **No idempotency key on Create PAL or Create Connector.** There is no `client_id` or `Idempotency-Key`, so a re-runnable setup script has to list everything and match by name, and the silent renaming above breaks that. Fix: accept a caller-supplied external id, as AgentMail does with `client_id`.
- **Patch PAL's OpenAPI types `value` as `string`.** Real patches need arrays (`/layers/mcp/connectors`) and objects (`/layers/mcp`), and the page's own examples use both, so a client generated from the spec would reject valid patches. Fix: type `value` as any JSON value.
- **Patch PAL answers a no-op with 304.** `fetch` treats that as not `ok`, so a naive client throws on an idempotent re-run. It is documented, but easy to miss. Fix: return 200 with `changed: false`.
- **The MCP Connectors guide never lists the auth types.** The full set (`none`, `bearer`, `api_key` with a custom header name, `basic`, `oauth2_client_credentials`, `oauth2`) is only in the Create Connector reference. My plan assumed only `none`, `bearer` and `oauth2` and included an OAuth fallback, but `api_key` with `name: "x-api-key"` matches AgentMail's documented header exactly. Fix: list the auth types on the guide.
- **`runtime_check` only proves `tools/list`.** AgentMail returns 401 to an unauthenticated `tools/list`, so the check did prove auth here. A server that lists tools publicly but gates `tools/call` would still pass the check and then fail mid-call. Fix: an optional read-only `probe_tool` call in `runtime_check`.
- **No server-side way to make the PAL speak about an app event.** `conversation.respond` is only sent over the Daily data channel, so a browser has to be in the call to forward the notice. I found no REST equivalent: the only interactions path is Magic Canvas. Fix: `POST /v2/conversations/{id}/interactions`.
- **App notices arrive as user turns.** `conversation.respond` is "treated as a completed user transcript", so a system notice shows up as user speech and needs a prompt rule ("[SYSTEM NOTICE] is not the user"). Fix: a `system`-role respond, or an `append_llm_context` flag that triggers a reply.
- **Legacy duplicate events.** Every PAL `conversation.utterance` and `started_speaking` arrives twice (`role: "pal"` and the legacy `"replica"`), so every client has to filter. Fix: let new integrations opt out of the legacy duplicates.

## AgentMail

- **The SDK socket opens before you can listen.** `await client.websockets.connect()` resolves after the socket is already open (`readyState === 1`, 3 of 3 runs on Node 24.15). The documented `socket.on("open", () => socket.sendSubscribe(...))` therefore never fires, and the client never subscribes, with no error and no events. Fix: resolve `connect()` before opening, replay `open` to late listeners, or accept the subscription in `connect()` args.
- **The WebSockets TypeScript examples don't compile against `agentmail@0.5.46`.** They test `event.type === "message_received"` and read `event.message.from_`, but the SDK has `type: "event"`, `eventType: "message.received"` and `message.from`. The "Message Properties" table also lists `from_` under TypeScript. Fix: generate the snippets from the SDK and typecheck them in CI.
- **Bearer auth on the MCP server is undocumented.** The MCP docs say to pass the API key as `x-api-key`. `Authorization: Bearer <api key>` also works (I checked with a direct `tools/call` and with Tavus `runtime_check`), but the docs don't say so. Fix: document it, because many MCP clients, Tavus's `bearer` type included, only take a static bearer token.
- **The MCP tool count is off.** The docs say "43 tools… OAuth sessions also receive 2 organization-selection tools", but an API-key session lists 45, including `list_organizations` and `select_organization`. Fix: update the docs, or hide those tools from key sessions.
- **The inbox-delete error doesn't name the blocker.** Deleting an inbox returned 409 "Cannot delete inbox with existing API keys", with only a generic fix ("remove dependent resources"). I had to find the inbox-scoped keys through `GET /v0/api-keys`. Fix: name the blocking key ids and the delete endpoint in `fix`, or support `?cascade=true`.
- **Message `timestamp` has whole-second precision** (`12:46:29.000Z`), so sub-second delivery latency can't be measured against it. Fix: millisecond timestamps.

## What worked well (for balance)

- AgentMail's `limit_exceeded` error named the limit, the plan, the exact fix and the upgrade price. It was the best error of the session.
- AgentMail's `clientId` made inbox creation idempotent, so `setup.ts` can be re-run with no bookkeeping.
- Tavus's `openapi.yaml` was complete and was the real source of truth. The `.md` page exports and `llms.txt` made agent-driven doc reading fast.
- Tavus's background-task lifecycle (exactly one `agent_stop` per `agent_start`, keyed by `task_id`) is clearly specified and easy to build a UI on.
