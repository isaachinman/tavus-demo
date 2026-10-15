import Daily, { type DailyCall } from '@daily-co/daily-js'

import type { EmailEvent, ServerEvent } from '@tavus-demo/types'

import { api } from './api'
import { type AppMessage, emailNotice, parseAppMessage } from './tavusEvents'
import { seconds, ui } from './ui'

type Session = {
  call: { daily: DailyCall; conversationId: string } | null
  // performance.now() of the last "Send test email" click, to time send -> arrival -> announcement.
  lastTestSendAt: number | null
  pendingAnnouncement: { arrivedAt: number; sentAt: number | null } | null
}

const session: Session = {
  call: null,
  lastTestSendAt: null,
  pendingAnnouncement: null,
}

// "Sam Rivera <sam@agentmail.to>" -> "Sam Rivera"
const NAMED_ADDRESS = /^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/

const senderName = (from: string) => from.match(NAMED_ADDRESS)?.[1] ?? from

const logLatency = (now: number, { arrivedAt, sentAt }: NonNullable<Session['pendingAnnouncement']>) =>
  ui.log(
    'latency',
    `Ivy started announcing ${seconds(now - arrivedAt)} after the email reached this page${
      sentAt === null ? '' : `, ${seconds(now - sentAt)} after Send`
    }`,
  )

const handleAppMessage = (message: AppMessage) => {
  switch (message.event_type) {
    case 'conversation.agent_start': {
      const label = message.properties.task ?? 'Background task'
      ui.tasks.start(message.properties.task_id, label)
      ui.log('task', `Started: ${label}`)
      break
    }
    case 'conversation.agent_update': {
      ui.tasks.update(message.properties.task_id, message.properties.text)
      ui.log('task', `Update: ${message.properties.text}`)
      break
    }
    case 'conversation.agent_stop': {
      const { status, summary, task_id } = message.properties
      const task = ui.tasks.stop(task_id, status, summary ?? null)
      const duration = task?.endedAt == null ? '' : ` in ${seconds(task.endedAt - task.startedAt)}`
      ui.log('task', `${status}${duration}${summary ? `: ${summary}` : ''}`)
      break
    }
    case 'conversation.utterance': {
      // PAL turns arrive twice: role "pal" and the legacy "replica". Log the "pal" copy only.
      if (message.properties.role === 'user' || message.properties.role === 'pal') {
        ui.log(message.properties.role === 'user' ? 'user' : 'ivy', message.properties.speech)
      }
      break
    }
    case 'conversation.started_speaking': {
      if (message.properties.role === 'pal' && session.pendingAnnouncement) {
        logLatency(performance.now(), session.pendingAnnouncement)
        session.pendingAnnouncement = null
      }
      break
    }
    default: {
      return message satisfies never
    }
  }
}

const notifyIvy = (event: EmailEvent, arrivedAt: number, sentAt: number | null) => {
  const mode = ui.noticeMode()
  const sender = senderName(event.from)
  if (session.call) {
    session.call.daily.sendAppMessage(
      emailNotice(mode, session.call.conversationId, sender, event.subject ?? '(no subject)'),
      '*',
    )
    session.pendingAnnouncement = mode === 'announce' ? { arrivedAt, sentAt } : null
    ui.log(
      'notice',
      mode === 'announce'
        ? 'Asked Ivy to announce it (conversation.respond)'
        : "Added to Ivy's context silently (conversation.append_llm_context)",
    )
  } else {
    ui.log('system', 'No call running, so Ivy was not told')
  }
}

const handleEmail = (event: EmailEvent) => {
  const now = performance.now()
  const subject = event.subject ?? '(no subject)'
  if (event.inbox === 'pal') {
    const sentAt = session.lastTestSendAt
    session.lastTestSendAt = null
    ui.log(
      'email',
      `${senderName(event.from)}: "${subject}"${sentAt === null ? '' : ` (arrived ${seconds(now - sentAt)} after Send)`}`,
    )
    notifyIvy(event, now, sentAt)
  } else {
    ui.log('reply', `Tester inbox got "${subject}" from ${senderName(event.from)}: ${event.preview ?? ''}`)
  }
}

const handleServerEvent = (event: ServerEvent) => {
  if (event.type === 'socket') {
    ui.setSocketStatus(event.status)
  } else {
    handleEmail(event)
  }
}

const endCall = async () => {
  const current = session.call
  session.call = null
  session.pendingAnnouncement = null
  if (current) {
    api.endConversation(current.conversationId)
    ui.setCallState('idle')
    ui.log('system', `Ended conversation ${current.conversationId}`)
    await current.daily.destroy()
  }
}

const startCall = async () => {
  ui.setCallState('starting')
  try {
    const { id, url } = await api.createConversation()
    const daily = Daily.createFrame(ui.callContainer, {
      iframeStyle: {
        border: '0',
        height: '100%',
        inset: '0',
        position: 'absolute',
        width: '100%',
      },
      showLeaveButton: true,
    })
    session.call = {
      conversationId: id,
      daily,
    }
    daily.on('app-message', event => {
      const message = parseAppMessage(event.data)
      if (message) {
        handleAppMessage(message)
      }
    })
    daily.on('left-meeting', endCall)
    ui.log('system', `Created conversation ${id}, joining`)
    await daily.join({ url })
    ui.setCallState('live')
  } catch (error) {
    ui.log('error', `Could not start the call: ${error instanceof Error ? error.message : String(error)}`)
    await endCall()
    ui.setCallState('idle')
  }
}

const sendTestEmail = async (email: { subject: string; text: string }) => {
  try {
    session.lastTestSendAt = performance.now()
    await api.sendTestEmail(email)
    ui.log('system', `Sent "${email.subject}" from the tester inbox`)
  } catch (error) {
    session.lastTestSendAt = null
    ui.log('error', `Could not send the test email: ${error instanceof Error ? error.message : String(error)}`)
  }
}

ui.onStart(startCall)
ui.onEnd(endCall)
ui.onTestEmail(sendTestEmail)
ui.setCallState('idle')

window.addEventListener('pagehide', () => {
  if (session.call) {
    api.endConversation(session.call.conversationId)
  }
})

const events = new EventSource('/api/events')
events.addEventListener('message', message => handleServerEvent(JSON.parse(message.data)))
events.addEventListener('error', () => ui.setSocketStatus('offline'))

const { palEmail } = await api.info()
ui.setPalEmail(palEmail)
