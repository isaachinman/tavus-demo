import { agentMail } from '@tavus-demo/lib/agentmail'
import type { State } from '@tavus-demo/utils/state'

// Display name Ivy speaks when she announces or summarises mail from the tester inbox.
export const TESTER_NAME = 'Sam Rivera'

const SEED_EMAILS = [
  {
    subject: 'Berlin flight moved',
    text: 'Heads up: our Berlin flight on Monday moved from 9:10 to 11:40. Hotel check-in is unchanged.\n\nSam',
  },
  {
    subject: 'Q4 planning deck',
    text: "Could you review the Q4 planning deck before Thursday's meeting? Slides 8 to 12 still need your numbers.\n\nSam",
  },
  {
    subject: 'Lunch tomorrow?',
    text: 'Fancy lunch tomorrow around 12:30? The new ramen place on Elm Street just opened.\n\nSam',
  },
]

// Gives "what's in my inbox?" something to find. Only seeds an empty inbox, so re-runs never duplicate mail.
export const seedEmails = async ({ pal, tester }: State['inboxes']) => {
  await agentMail.inboxes.update(tester.inboxId, { displayName: TESTER_NAME })
  const { count } = await agentMail.inboxes.messages.list(pal.inboxId, { limit: 1 })
  if (count === 0) {
    for (const email of SEED_EMAILS) {
      await agentMail.inboxes.messages.send(tester.inboxId, {
        ...email,
        to: [pal.email],
      })
    }
    console.info(`Seeded ${SEED_EMAILS.length} emails into ${pal.email}`)
  }
}
