import { serveStatic } from '@hono/node-server/serve-static'
import { AgentMailError } from 'agentmail'
import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import * as v from 'valibot'

import { TavusError } from '@tavus-demo/lib/tavus'
import { getLogger } from '@tavus-demo/utils/logger'
import type { State } from '@tavus-demo/utils/state'

import { conversationRoutes } from './routes/conversations'
import { eventRoutes } from './routes/events'
import { infoRoutes } from './routes/info'
import { testEmailRoutes } from './routes/testEmail'

const errorStatuses: { status: ContentfulStatusCode; type: abstract new (...args: never[]) => Error }[] = [
  {
    status: 400,
    type: v.ValiError,
  },
  {
    status: 502,
    type: TavusError,
  },
  {
    status: 502,
    type: AgentMailError,
  },
]

const errorStatus = (error: Error) => errorStatuses.find(({ type }) => error instanceof type)?.status ?? 500

export const createApp = (appState: State) =>
  new Hono()
    .route('/api/conversations', conversationRoutes(appState))
    .route('/api/events', eventRoutes)
    .route('/api/info', infoRoutes(appState))
    .route('/api/test-email', testEmailRoutes(appState))
    .use('/*', serveStatic({ root: './public' }))
    .onError((error, c) => {
      getLogger('server').error('{method} {path} failed: {message}', {
        message: error.message,
        method: c.req.method,
        path: c.req.path,
      })
      return c.json({ error: error.message }, errorStatus(error))
    })
