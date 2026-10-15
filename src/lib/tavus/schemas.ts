import * as v from 'valibot'

export const connectorSchema = v.object({
  auth_config: v.object({
    type: v.string(),
  }),
  connector_id: v.string(),
  name: v.string(),
  oauth_status: v.nullable(v.string()),
  server_url: v.string(),
})

export const connectorListSchema = v.object({
  data: v.array(connectorSchema),
})

export const runtimeCheckSchema = v.object({
  error: v.nullable(
    v.object({
      http_status: v.nullable(v.number()),
      message: v.string(),
    }),
  ),
  latency_ms: v.number(),
  ok: v.boolean(),
  tool_count: v.number(),
  tool_names: v.array(v.string()),
})

export const connectorPreviewSchema = v.object({
  tools: v.array(
    v.object({
      description: v.optional(v.string()),
      name: v.string(),
    }),
  ),
})

export const palSchema = v.object({
  pal_id: v.string(),
})

export const palListSchema = v.object({
  data: v.array(
    v.object({
      pal_id: v.string(),
      pal_name: v.nullish(v.string()),
    }),
  ),
})

export const conversationSchema = v.object({
  conversation_id: v.string(),
  conversation_url: v.string(),
  status: v.string(),
})

export type Connector = v.InferOutput<typeof connectorSchema>
