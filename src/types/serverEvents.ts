export type SocketStatus = 'connecting' | 'open' | 'subscribed' | 'reconnecting'

export type EmailEvent = {
  type: 'email'
  // Which demo inbox received it: `pal` is Ivy's inbox, `tester` gets Ivy's replies.
  inbox: 'pal' | 'tester'
  messageId: string
  from: string
  subject: string | null
  preview: string | null
  receivedAt: string
}

export type ServerEvent =
  | EmailEvent
  | {
      type: 'socket'
      status: SocketStatus
    }
