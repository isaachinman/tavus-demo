import * as v from 'valibot'

const errorSchema = v.object({
  error: v.string(),
})

const request = async <TSchema extends v.GenericSchema>(schema: TSchema, path: string, body?: unknown) => {
  const response = await fetch(path, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: body === undefined ? 'GET' : 'POST',
  })
  const json: unknown = await response.json()
  if (response.ok) {
    return v.parse(schema, json)
  }
  throw new Error(v.is(errorSchema, json) ? json.error : `${path} failed with ${response.status}`)
}

export const api = {
  createConversation: () =>
    request(
      v.object({
        id: v.string(),
        url: v.string(),
      }),
      '/api/conversations',
      {},
    ),
  // sendBeacon survives page unload, so it is used for every end: button, Daily leave, tab close.
  endConversation: (conversationId: string) => navigator.sendBeacon(`/api/conversations/${conversationId}/end`),
  info: () =>
    request(
      v.object({
        palEmail: v.string(),
        testerEmail: v.string(),
      }),
      '/api/info',
    ),
  sendTestEmail: (body: { subject: string; text: string }) =>
    request(
      v.object({
        messageId: v.string(),
      }),
      '/api/test-email',
      body,
    ),
}
