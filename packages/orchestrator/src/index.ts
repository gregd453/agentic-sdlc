import 'dotenv/config';
import { startServer } from './server';
import { connectDatabase } from './db/client';
import { logger } from './utils/logger';

async function main() {
  logger.info('Starting Agentic SDLC Orchestrator...');

  try {
    // Connect to database
    await connectDatabase();

    // Start server
    await startServer();

    logger.info('Orchestrator started successfully');
  } catch (error) {
    logger.error('Failed to start orchestrator', { error });
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', {
    promise,
    reason
  });
  // In production, you might want to send this to a monitoring service
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('=============== UNCAUGHT EXCEPTION ===============');
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  console.error('==================================================');
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });
  // In production, you might want to send this to a monitoring service
  process.exit(1);
});

// Start the application
main();