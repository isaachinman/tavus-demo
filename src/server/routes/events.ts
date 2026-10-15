import { Hono } from 'hono'

import type { ServerEvent } from '@tavus-demo/types'
import { toMS } from '@tavus-demo/utils/data'

import { emailFeed } from '../emailFeed'

const toSSE = (event: ServerEvent) => `data: ${JSON.stringify(event)}\n\n`

// Plain ReadableStream so feed listeners can enqueue synchronously; `cancel` runs when the browser disconnects.
// The comment line every 15 s keeps proxies (Railway's edge included) from closing an idle stream.
const eventStream = () => {
  let unsubscribe = () => {}
  let keepAlive: NodeJS.Timeout | undefined
  return new ReadableStream<string>({
    cancel: () => {
      unsubscribe()
      clearInterval(keepAlive)
    },
    start: controller => {
      controller.enqueue(
        toSSE({
          status: emailFeed.status(),
          type: 'socket',
        }),
      )
      unsubscribe = emailFeed.subscribe(event => controller.enqueue(toSSE(event)))
      keepAlive = setInterval(() => controller.enqueue(': keep-alive\n\n'), toMS.seconds(15))
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
