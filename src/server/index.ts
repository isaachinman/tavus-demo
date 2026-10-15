import { serve } from '@hono/node-server'

import { config } from '@tavus-demo/config'
import { getLogger } from '@tavus-demo/utils/logger'
import { state } from '@tavus-demo/utils/state'

import { createApp } from './app'
import { emailFeed } from './emailFeed'

const appState = await state.read()

await emailFeed.start(appState.inboxes)

serve(
  {
    fetch: createApp(appState).fetch,
    port: config.port,
  },
  info =>
    getLogger('server').info('Ivy demo on http://localhost:{port} (PAL {palId})', {
      palId: appState.palId,
      port: info.port,
    }),
)
