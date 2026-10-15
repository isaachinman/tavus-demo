import { config } from '@tavus-demo/config'
import { agentMail } from '@tavus-demo/lib/agentmail'
import { tavus } from '@tavus-demo/lib/tavus'
import { state } from '@tavus-demo/utils/state'

import { PAL_NAME, palBody, SCOPED_TOOLS } from './pal'
import { seedEmails, TESTER_NAME } from './seedEmails'

const CONNECTOR_NAME = 'AgentMail'
const MCP_URL = 'https://mcp.agentmail.to/mcp'

// AgentMail's MCP accepts the API key as a bearer token (verified by runtime_check and a direct tools/call).
const authConfig = {
  token: config.agentMail.apiKey,
  type: 'bearer',
} satisfies Parameters<typeof tavus.connectors.create>[0]['auth_config']

// `clientId` makes inbox creation idempotent: a repeat call returns the original inbox.
const ensureInbox = async (request: Parameters<typeof agentMail.inboxes.create>[0]) => {
  const inbox = await agentMail.inboxes.create(request)
  return {
    email: inbox.email,
    inboxId: inbox.inboxId,
  }
}

// Reuses the connector by name and refreshes its token, so a rotated API key heals on re-run.
const ensureConnector = async () => {
  const existing = (await tavus.connectors.list()).find(
    candidate => candidate.name === CONNECTOR_NAME && candidate.server_url === MCP_URL,
  )
  return existing
    ? tavus.connectors.update(existing.connector_id, { auth_config: authConfig })
    : tavus.connectors.create({
        auth_config: authConfig,
        name: CONNECTOR_NAME,
        server_url: MCP_URL,
      })
}

const checkConnector = async (connectorId: string) => {
  const check = await tavus.connectors.runtimeCheck(connectorId)
  if (check.ok) {
    console.info(`Runtime check: ok, ${check.tool_count} tools in ${check.latency_ms} ms`)
  } else {
    throw new Error(`Runtime check failed: ${check.error?.message ?? 'no error message'}`)
  }
  const tools = await tavus.connectors.preview(connectorId)
  const toolNames = tools.map(tool => tool.name)
  const missing = SCOPED_TOOLS.filter(name => !toolNames.includes(name))
  console.info('\nTools exposed by the AgentMail MCP server (* = scoped onto the PAL):')
  for (const name of toolNames) {
    console.info(`  ${SCOPED_TOOLS.includes(name) ? '*' : ' '} ${name}`)
  }
  if (missing.length > 0) {
    throw new Error(`AgentMail MCP no longer exposes: ${missing.join(', ')}`)
  }
}

type PatchOp = Parameters<typeof tavus.pals.patch>[1][number]

// Patches top-level fields and `layers.mcp` only, so layers Tavus filled in on create are kept.
const patchPal = async (existingPalId: string, { layers, ...fields }: ReturnType<typeof palBody>) => {
  const changed = await tavus.pals.patch(existingPalId, [
    ...Object.entries(fields).map(
      ([key, value]): PatchOp => ({
        op: 'add',
        path: `/${key}`,
        value,
      }),
    ),
    {
      op: 'add',
      path: '/layers/mcp',
      value: layers.mcp,
    },
  ])
  console.info(changed ? `Patched PAL ${existingPalId}` : `PAL ${existingPalId} already up to date`)
  return existingPalId
}

const ensurePal = async (args: Parameters<typeof palBody>[0]) => {
  const body = palBody(args)
  const existing = (await tavus.pals.list()).find(candidate => candidate.pal_name?.trim() === PAL_NAME)
  return existing ? patchPal(existing.pal_id, body) : (await tavus.pals.create(body)).pal_id
}

const pal = await ensureInbox({
  clientId: 'tavus-demo-ivy',
  displayName: 'Ivy',
  username: 'ivy-tavus',
})
const tester = await ensureInbox({
  clientId: 'tavus-demo-tester',
  displayName: TESTER_NAME,
})
console.info(`Inboxes: pal ${pal.email}, tester ${tester.email}`)
await seedEmails({
  pal,
  tester,
})

const connector = await ensureConnector()
console.info(`Connector: ${connector.connector_id} (${connector.auth_config.type} auth)`)
await checkConnector(connector.connector_id)

const palId = await ensurePal({
  connectorId: connector.connector_id,
  email: pal.email,
  inboxId: pal.inboxId,
})

await state.write({
  connectorId: connector.connector_id,
  inboxes: {
    pal,
    tester,
  },
  palId,
})

console.info(`
Setup complete (written to state.json)
  PAL        ${palId} "${PAL_NAME}"
  Connector  ${connector.connector_id} -> ${MCP_URL}
  PAL inbox  ${pal.email}
  Tester     ${tester.email}`)
