import { Hono } from 'hono'
import * as v from 'valibot'

import { tavus } from '@tavus-demo/lib/tavus'
import { toMS } from '@tavus-demo/utils/data'
import { getLogger } from '@tavus-demo/utils/logger'
import type { State } from '@tavus-demo/utils/state'

const logger = getLogger('tavus')

const createBodySchema = v.object({
  testMode: v.optional(v.boolean(), false),
})

const seconds = (ms: number) => ms / toMS.seconds(1)

// A conversation is billed from creation, so keep every timeout short.
const callProperties = {
  max_call_duration: seconds(toMS.minutes(10)),
  participant_absent_timeout: seconds(toMS.minutes(1)),
  participant_left_timeout: seconds(toMS.seconds(10)),
}

export const conversationRoutes = (appState: State) =>
  new Hono()
    .post('/', async c => {
      const { testMode } = v.parse(createBodySchema, await c.req.json())
      const conversation = await tavus.conversations.create({
        conversation_name: `Ivy inbox demo ${new Date().toISOString()}`,
        pal_id: appState.palId,
        properties: callProperties,
        test_mode: testMode,
      })
      logger.info('Created conversation {id} ({status}, test mode {testMode})', {
        id: conversation.conversation_id,
        status: conversation.status,
        testMode,
      })
      return c.json({
        id: conversation.conversation_id,
        status: conversation.status,
        url: conversation.conversation_url,
      })
    })
    .post('/:id/end', async c => {
      const id = c.req.param('id')
      await tavus.conversations.end(id)
      logger.info('Ended conversation {id}', { id })
      return c.body(null, 204)
    })
