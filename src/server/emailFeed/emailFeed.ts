import { agentMail } from '@tavus-demo/lib/agentmail'
import type { EmailEvent, ServerEvent, SocketStatus } from '@tavus-demo/types'
import { getLogger } from '@tavus-demo/utils/logger'
import type { State } from '@tavus-demo/utils/state'

import { EventEmitter } from 'node:events'

const logger = getLogger('agentmail')

const bus = new EventEmitter<{ event: [ServerEvent] }>()
const seenMessageIds = new Set<string>()
let socketStatus: SocketStatus = 'connecting'

const setStatus = (status: SocketStatus, detail?: string) => {
  socketStatus = status
  logger.info(detail ? 'Socket {status}: {detail}' : 'Socket {status}', {
    detail,
    status,
  })
  bus.emit('event', {
    status,
    type: 'socket',
  })
}

// Streams `message.received` for both demo inboxes. The SDK socket reconnects with backoff on its own;
// we re-subscribe on every `open`, since a fresh connection starts with no subscriptions.
const start = async (inboxes: State['inboxes']) => {
  const inboxNames = new Map<string, EmailEvent['inbox']>([
    [inboxes.pal.inboxId, 'pal'],
    [inboxes.tester.inboxId, 'tester'],
  ])
  const socket = await agentMail.websockets.connect({ reconnectAttempts: Number.POSITIVE_INFINITY })
  const subscribeInboxes = () => {
    setStatus('open')
    socket.sendSubscribe({
      eventTypes: ['message.received'],
      inboxIds: [...inboxNames.keys()],
      type: 'subscribe',
    })
  }

  socket.on('open', subscribeInboxes)
  socket.on('close', event => setStatus('reconnecting', `code ${event.code}`))
  socket.on('error', error => logger.error('Socket error: {message}', { message: error.message }))
  socket.on('message', event => {
    if (event.type === 'subscribed') {
      setStatus('subscribed', event.inboxIds?.join(', '))
    }
    if (event.type === 'error') {
      logger.error('Socket server error {event}', { event })
    }
    if (event.type === 'event' && event.eventType === 'message.received') {
      const { message } = event
      const inbox = inboxNames.get(message.inboxId)
      if (inbox && !seenMessageIds.has(message.messageId)) {
        seenMessageIds.add(message.messageId)
        logger.info('{inbox} inbox received {subject} from {from}, {lagMs} ms after AgentMail stamped it', {
          from: message.from,
          inbox,
          lagMs: Date.now() - message.timestamp.getTime(),
          subject: message.subject ?? '(no subject)',
        })
        bus.emit('event', {
          from: message.from,
          inbox,
          messageId: message.messageId,
          preview: message.preview ?? null,
          receivedAt: message.timestamp.toISOString(),
          subject: message.subject ?? null,
          type: 'email',
        })
      }
    }
  })

  // The first connection is already open when `connect()` resolves, so its `open` event fired before
  // any handler could be attached. Subscribe now; later reconnects go through the `open` handler.
  if (socket.readyState === socket.socket.OPEN) {
    subscribeInboxes()
  }
}

const subscribe = (listener: (event: ServerEvent) => void) => {
  bus.on('event', listener)
  return () => {
    bus.off('event', listener)
  }
}

export const emailFeed = {
  start,
  status: () => socketStatus,
  subscribe,
}
