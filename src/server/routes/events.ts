import { Hono } from 'hono'

import type { ServerEvent } from '@tavus-demo/types'

import { emailFeed } from '../emailFeed'

const toSSE = (event: ServerEvent) => `data: ${JSON.stringify(event)}\n\n`

// Plain ReadableStream so feed listeners can enqueue synchronously; `cancel` runs when the browser disconnects.
const eventStream = () => {
  let unsubscribe = () => {}
  return new ReadableStream<string>({
    cancel: () => unsubscribe(),
    start: controller => {
      controller.enqueue(
        toSSE({
          status: emailFeed.status(),
          type: 'socket',
        }),
      )
      unsubscribe = emailFeed.subscribe(event => controller.enqueue(toSSE(event)))
    },
  })
}

export const eventRoutes = new Hono().get(
  '/',
  () =>
    new Response(eventStream().pipeThrough(new TextEncoderStream()), {
      headers: {
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'content-type': 'text/event-stream',
      },
    }),
)
