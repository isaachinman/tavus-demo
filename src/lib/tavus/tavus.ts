import * as v from 'valibot'

import { config } from '@tavus-demo/config'

import {
  connectorListSchema,
  connectorPreviewSchema,
  connectorSchema,
  conversationSchema,
  palListSchema,
  palSchema,
  runtimeCheckSchema,
} from './schemas'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

type AuthConfig = { type: 'bearer'; token: string } | { type: 'api_key'; name: string; value: string }

type JsonPatchOp = {
  op: 'add' | 'replace' | 'remove'
  path: string
  value?: unknown
}

export type PalBody = {
  default_face_id: string
  disclosure_type: 'always' | 'auto' | 'off'
  greeting: string
  layers: {
    mcp: {
      connector_tools: Record<string, string[]>
      connectors: string[]
      prompt: string
      spoken_updates: 'none' | 'outcome' | 'all'
    }
  }
  pal_name: string
  pipeline_mode: 'full'
  system_prompt: string
}

export class TavusError extends Error {
  readonly status: number

  constructor(method: Method, path: string, status: number, body: string) {
    super(`Tavus ${method} ${path} failed with ${status}: ${body}`)
    this.status = status
  }
}

const request = async (method: Method, path: string, body?: unknown) => {
  const response = await fetch(`${config.tavus.baseUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.tavus.apiKey,
    },
    method,
  })
  const text = await response.text()
  // Patch PAL answers 304 when nothing changed, which fetch does not count as ok.
  if (response.ok || response.status === 304) {
    return {
      json: text.length > 0 ? JSON.parse(text) : null,
      status: response.status,
    }
  }
  throw new TavusError(method, path, response.status, text)
}

const parse = async <TSchema extends v.GenericSchema>(
  schema: TSchema,
  method: Method,
  path: string,
  body?: unknown,
): Promise<v.InferOutput<TSchema>> => v.parse(schema, (await request(method, path, body)).json)

export const tavus = {
  connectors: {
    create: (body: { name: string; server_url: string; auth_config: AuthConfig }) =>
      parse(connectorSchema, 'POST', '/v2/connectors', body),
    list: async () => (await parse(connectorListSchema, 'GET', '/v2/connectors')).data,
    preview: async (connectorId: string) =>
      (await parse(connectorPreviewSchema, 'GET', `/v2/connectors/${connectorId}/preview`)).tools,
    runtimeCheck: (connectorId: string) =>
      parse(runtimeCheckSchema, 'POST', `/v2/connectors/${connectorId}/runtime_check`),
    update: (connectorId: string, body: { auth_config: AuthConfig }) =>
      parse(connectorSchema, 'PATCH', `/v2/connectors/${connectorId}`, body),
  },
  conversations: {
    create: (body: {
      conversation_name: string
      pal_id: string
      properties: {
        max_call_duration: number
        participant_absent_timeout: number
        participant_left_timeout: number
      }
      test_mode: boolean
    }) => parse(conversationSchema, 'POST', '/v2/conversations', body),
    end: async (conversationId: string) => {
      await request('POST', `/v2/conversations/${conversationId}/end`)
    },
  },
  pals: {
    create: (body: PalBody) => parse(palSchema, 'POST', '/v2/pals', body),
    list: async () => (await parse(palListSchema, 'GET', '/v2/pals?limit=100&pal_type=user')).data,
    // Resolves to false when Tavus answers 304 (nothing changed).
    patch: async (palId: string, ops: JsonPatchOp[]) =>
      (await request('PATCH', `/v2/pals/${palId}`, ops)).status === 200,
  },
}
