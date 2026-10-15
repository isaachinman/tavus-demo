import * as v from 'valibot'

const taskId = v.string()

// The Tavus app messages this page reacts to; anything else on the data channel is ignored.
const appMessageSchema = v.variant('event_type', [
  v.object({
    event_type: v.literal('conversation.agent_start'),
    properties: v.object({
      task: v.optional(v.string()),
      task_id: taskId,
    }),
  }),
  v.object({
    event_type: v.literal('conversation.agent_update'),
    properties: v.object({
      task_id: taskId,
      text: v.string(),
      title: v.optional(v.string()),
    }),
  }),
  v.object({
    event_type: v.literal('conversation.agent_stop'),
    properties: v.object({
      status: v.picklist(['done', 'failed', 'timeout', 'rejected', 'cancelled']),
      summary: v.optional(v.string()),
      task_id: taskId,
    }),
  }),
  v.object({
    event_type: v.literal('conversation.utterance'),
    properties: v.object({
      role: v.string(),
      speech: v.string(),
    }),
  }),
  v.object({
    event_type: v.literal('conversation.started_speaking'),
    properties: v.object({
      role: v.string(),
    }),
  }),
])

export type AppMessage = v.InferOutput<typeof appMessageSchema>

export type TaskStatus =
  | 'running'
  | Extract<AppMessage, { event_type: 'conversation.agent_stop' }>['properties']['status']

export const parseAppMessage = (data: unknown) => {
  const result = v.safeParse(appMessageSchema, data)
  return result.success ? result.output : null
}

export type NoticeMode = 'announce' | 'silent'

// `respond` makes Ivy answer as if the user spoke; `append_llm_context` only adds context, so she stays quiet.
export const emailNotice = (mode: NoticeMode, conversationId: string, sender: string, subject: string) =>
  mode === 'announce'
    ? {
        conversation_id: conversationId,
        event_type: 'conversation.respond',
        message_type: 'conversation',
        properties: {
          text: `[SYSTEM NOTICE, not said by the user] New email from ${sender}, subject "${subject}". Tell the user in one short sentence and ask if they want it read or answered.`,
        },
      }
    : {
        conversation_id: conversationId,
        event_type: 'conversation.append_llm_context',
        message_type: 'conversation',
        properties: {
          context: `[SYSTEM NOTICE] A new email arrived from ${sender}, subject "${subject}". Do not bring it up yourself; mention it only if the user asks about new email.`,
        },
      }
