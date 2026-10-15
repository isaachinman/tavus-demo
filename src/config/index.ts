import * as v from 'valibot'

const configSchema = v.object({
  agentMail: v.object({
    apiKey: v.pipe(v.string(), v.minLength(1)),
  }),
  // When set, every route sits behind HTTP basic auth (user `ivy`). Required on any public deployment.
  demoPassword: v.optional(v.pipe(v.string(), v.minLength(12))),
  port: v.optional(v.pipe(v.string(), v.toNumber(), v.integer()), '3000'),
  tavus: v.object({
    apiKey: v.pipe(v.string(), v.minLength(1)),
    baseUrl: v.optional(v.pipe(v.string(), v.url()), 'https://tavusapi.com'),
  }),
})

export const config = v.parse(configSchema, {
  agentMail: {
    apiKey: process.env.AGENTMAIL_API_KEY,
  },
  demoPassword: process.env.DEMO_PASSWORD,
  port: process.env.PORT,
  tavus: {
    apiKey: process.env.TAVUS_API_KEY,
  },
})
