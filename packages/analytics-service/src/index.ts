import { createServer } from './server'
import { logger } from './utils/logger'

// Validate PORT is set (required, no default)
const portEnv = process.env.ANALYTICS_SERVICE_PORT || process.env.PORT;
if (!portEnv) {
  console.error('❌ ERROR: ANALYTICS_SERVICE_PORT environment variable is not set');
  console.error('');
  console.error('Usage:');
  console.error('  export ANALYTICS_SERVICE_PORT=3001');
  console.error('  npm start');
  console.error('');
  console.error('Or in .env file:');
  console.error('  ANALYTICS_SERVICE_PORT=3001');
  console.error('');
  process.exit(1);
}

const port = parseInt(portEnv, 10);
if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`❌ ERROR: ANALYTICS_SERVICE_PORT must be a valid port number (1-65535), got: ${portEnv}`);
  process.exit(1);
}

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
