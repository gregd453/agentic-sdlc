import { createServer } from './server'
import { logger } from './utils/logger'

const port = parseInt(process.env.PORT || '3001', 10)
const host = process.env.HOST || '0.0.0.0'

async function main() {
  try {
    const fastify = await createServer()

    await fastify.listen({ port, host })

    logger.info(`[Analytics Service] 🚀 Server listening on http://${host}:${port}`)
    logger.info(`[Analytics Service] 📚 API documentation available at http://${host}:${port}/docs`)
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}

main()
