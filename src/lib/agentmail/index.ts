import { AgentMailClient } from 'agentmail'

import { config } from '@tavus-demo/config'

export const agentMail = new AgentMailClient({ apiKey: config.agentMail.apiKey })
