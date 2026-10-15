import * as v from 'valibot'

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const inboxSchema = v.object({
  email: v.string(),
  inboxId: v.string(),
})

const stateSchema = v.object({
  connectorId: v.string(),
  inboxes: v.object({
    pal: inboxSchema,
    tester: inboxSchema,
  }),
  palId: v.string(),
})

export type State = v.InferOutput<typeof stateSchema>

const statePath = join(process.cwd(), 'state.json')

export const state = {
  read: async () => v.parse(stateSchema, JSON.parse(await readFile(statePath, 'utf8'))),
  write: (value: State) => writeFile(statePath, `${JSON.stringify(value, null, 2)}\n`),
}
