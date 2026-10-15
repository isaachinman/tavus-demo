import { configureSync, getAnsiColorFormatter, getConsoleSink, getLogger as getLoggerBase } from '@logtape/logtape'

configureSync({
  loggers: [
    {
      category: ['ivy'],
      lowestLevel: 'info',
      sinks: ['console'],
    },
    {
      category: ['logtape', 'meta'],
      lowestLevel: 'warning',
      sinks: ['console'],
    },
  ],
  sinks: {
    console: getConsoleSink({
      formatter: getAnsiColorFormatter({ timestamp: 'time' }),
    }),
  },
})

export const getLogger = (name: 'agentmail' | 'server' | 'tavus') => getLoggerBase(['ivy', name])
