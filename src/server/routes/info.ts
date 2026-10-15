import { Hono } from 'hono'

import type { State } from '@tavus-demo/utils/state'

export const infoRoutes = ({ inboxes }: State) =>
  new Hono().get('/', c =>
    c.json({
      palEmail: inboxes.pal.email,
      testerEmail: inboxes.tester.email,
    }),
  )
