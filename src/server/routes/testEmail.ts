import { Hono } from 'hono'
import * as v from 'valibot'

import { agentMail } from '@tavus-demo/lib/agentmail'
import { getLogger } from '@tavus-demo/utils/logger'
import type { State } from '@tavus-demo/utils/state'

const logger = getLogger('agentmail')

const bodySchema = v.object({
  subject: v.pipe(v.string(), v.trim(), v.minLength(1)),
  text: v.pipe(v.string(), v.trim(), v.minLength(1)),
})

export const testEmailRoutes = ({ inboxes }: State) =>
  new Hono().post('/', async c => {
    const { subject, text } = v.parse(bodySchema, await c.req.json())
    const sent = await agentMail.inboxes.messages.send(inboxes.tester.inboxId, {
      subject,
      text,
      to: [inboxes.pal.email],
    })
    logger.info('Tester sent {subject} to {to}', {
      subject,
      to: inboxes.pal.email,
    })
    return c.json({ messageId: sent.messageId })
  })
