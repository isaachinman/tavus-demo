import type { SocketStatus } from '@tavus-demo/types'

import type { NoticeMode, TaskStatus } from './tavusEvents'

const byId = <T extends HTMLElement>(id: string, type: new () => T) => {
  const element = document.getElementById(id)
  if (element instanceof type) {
    return element
  }
  throw new Error(`Missing #${id}`)
}

const elements = {
  callContainer: byId('call', HTMLDivElement),
  callState: byId('call-state', HTMLSpanElement),
  endButton: byId('end', HTMLButtonElement),
  log: byId('log', HTMLOListElement),
  palEmail: byId('pal-email', HTMLElement),
  silentMode: byId('mode-silent', HTMLInputElement),
  socketState: byId('socket-state', HTMLSpanElement),
  startButton: byId('start', HTMLButtonElement),
  tasks: byId('tasks', HTMLOListElement),
  testForm: byId('test-email', HTMLFormElement),
  testSubject: byId('test-subject', HTMLInputElement),
  testText: byId('test-text', HTMLTextAreaElement),
}

// Prefilled so the demo's step 3 ("reply that I'll call them tomorrow") reads naturally.
elements.testSubject.value = 'Contract renewal'
elements.testText.value = 'Hi, can we talk about the contract renewal before Friday? Let me know when suits you.\n\nSam'

export const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`

const node = (tag: string, className: string, text: string) => {
  const element = document.createElement(tag)
  element.className = className
  element.textContent = text
  return element
}

export type LogKind = 'email' | 'reply' | 'user' | 'ivy' | 'task' | 'notice' | 'latency' | 'system' | 'error'

const log = (kind: LogKind, text: string) => {
  const entry = node('li', `entry entry--${kind}`, '')
  entry.append(
    node('time', 'entry__time', new Date().toLocaleTimeString([], { hour12: false })),
    node('span', 'entry__kind', kind),
    node('span', 'entry__text', text),
  )
  elements.log.prepend(entry)
}

type Task = {
  label: string
  status: TaskStatus
  startedAt: number
  endedAt: number | null
  update: string | null
  summary: string | null
}

const tasks = new Map<string, Task>()

const renderTasks = () => {
  elements.tasks.replaceChildren(
    ...[...tasks.values()].reverse().map(task => {
      const item = node('li', `task task--${task.status}`, '')
      const header = node('div', 'task__header', '')
      header.append(
        node('span', 'task__status', task.status),
        node('span', 'task__label', task.label),
        node('span', 'task__time', seconds((task.endedAt ?? performance.now()) - task.startedAt)),
      )
      item.append(header)
      const detail = task.summary ?? task.update
      if (detail) {
        item.append(node('p', 'task__detail', detail))
      }
      return item
    }),
  )
}

setInterval(() => {
  if ([...tasks.values()].some(task => task.status === 'running')) {
    renderTasks()
  }
}, 100)

// Tavus may emit a stop for a task whose start never arrived (failed dispatch), so stop also creates the row.
const upsertTask = (taskId: string, change: Partial<Task>) => {
  tasks.set(taskId, {
    endedAt: null,
    label: 'Background task',
    startedAt: performance.now(),
    status: 'running',
    summary: null,
    update: null,
    ...tasks.get(taskId),
    ...change,
  })
  renderTasks()
  return tasks.get(taskId)
}

const socketLabels: Record<SocketStatus | 'offline', string> = {
  connecting: 'connecting',
  offline: 'server offline',
  open: 'connected',
  reconnecting: 'reconnecting',
  subscribed: 'live',
}

export const ui = {
  callContainer: elements.callContainer,
  log,
  noticeMode: (): NoticeMode => (elements.silentMode.checked ? 'silent' : 'announce'),
  onEnd: (handler: () => void) => elements.endButton.addEventListener('click', handler),
  onStart: (handler: () => void) => elements.startButton.addEventListener('click', handler),
  onTestEmail: (handler: (email: { subject: string; text: string }) => void) =>
    elements.testForm.addEventListener('submit', event => {
      event.preventDefault()
      handler({
        subject: elements.testSubject.value,
        text: elements.testText.value,
      })
    }),
  setCallState: (state: 'idle' | 'starting' | 'live') => {
    elements.callState.textContent = state
    elements.callState.dataset.state = state
    elements.startButton.hidden = state !== 'idle'
    elements.endButton.hidden = state === 'idle'
    elements.callContainer.dataset.state = state
  },
  setPalEmail: (email: string) => {
    elements.palEmail.textContent = email
  },
  setSocketStatus: (status: SocketStatus | 'offline') => {
    elements.socketState.textContent = socketLabels[status]
    elements.socketState.dataset.state = status
  },
  tasks: {
    start: (taskId: string, label: string) => upsertTask(taskId, { label }),
    stop: (taskId: string, status: TaskStatus, summary: string | null) =>
      upsertTask(taskId, {
        endedAt: performance.now(),
        status,
        summary,
      }),
    update: (taskId: string, update: string) => upsertTask(taskId, { update }),
  },
}
