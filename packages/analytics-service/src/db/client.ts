import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger'

// Singleton Prisma Client instance
let prismaClient: PrismaClient | null = null

/**
 * Get or create Prisma Client instance
 * Ensures only one instance is created across the application
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient()

    logger.info('Prisma Client initialized')
  }

  return prismaClient
}

/**
 * Disconnect Prisma Client
 * Should be called during graceful shutdown
 */
export async function disconnectPrisma(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect()
    prismaClient = null
    logger.info('Prisma Client disconnected')
  }
}

// Note: Don't export prisma at module load time - use getPrismaClient() to defer initialization
// This allows Docker environments to generate Prisma client before it's first used
