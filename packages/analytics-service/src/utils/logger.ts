import pino from 'pino'

const level = process.env.LOG_LEVEL || 'info'

// Use simple transport in Docker/production environments
// pino-pretty is optional and only used in local development
const transport =
  process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true'
    ? undefined
    : (() => {
        try {
          return {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname'
            }
          }
        } catch {
          // pino-pretty not available, use default transport
          return undefined
        }
      })()

export const logger = pino({
  level,
  transport
})

export default logger
