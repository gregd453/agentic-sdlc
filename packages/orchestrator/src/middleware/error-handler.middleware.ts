/**
 * Error Handling Middleware
 * Session #88 Refactoring: Consolidated error response handling
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../utils/logger';
import { PLATFORM_ERROR_MESSAGES } from '../constants/platform.constants';

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, any>;
}

/**
 * HTTP error code determination
 */
function determineStatusCode(error: Error | string): number {
  const message = typeof error === 'string' ? error : error.message || '';

  if (message.includes('not found') || message.includes('not exist')) {
    return 404;
  }
  if (message.includes('already exists') || message.includes('duplicate')) {
    return 409;
  }
  if (message.includes('Invalid') || message.includes('invalid')) {
    return 400;
  }
  if (message.includes('Unauthorized') || message.includes('unauthorized')) {
    return 401;
  }
  if (message.includes('Forbidden') || message.includes('forbidden')) {
    return 403;
  }

  return 400; // Default to bad request
}

/**
 * Send standardized error response
 * @param reply FastifyReply object
 * @param error Error or error message string
 * @param context Logging context prefix
 * @param additionalData Additional data to log
 */
export async function sendErrorResponse(
  reply: FastifyReply,
  error: Error | string,
  context: string = '[API]',
  additionalData?: Record<string, any>
): Promise<void> {
  const statusCode = determineStatusCode(error);
  const errorMessage = typeof error === 'string' ? error : error.message;

  logger.error(`${context} ${statusCode} Error`, {
    error: errorMessage,
    ...additionalData
  });

  const response: ErrorResponse = {
    error: errorMessage
  };

  reply.code(statusCode).send(response);
}

/**
 * Validate required fields
 * @param data Object to validate
 * @param requiredFields Array of field names that must exist
 * @returns Array of missing field names, empty if all present
 */
export function validateRequiredFields(
  data: any,
  requiredFields: string[]
): string[] {
  return requiredFields.filter(field => !data?.[field]);
}

/**
 * Validate field type
 */
export function validateFieldType(
  value: any,
  expectedType: string
): boolean {
  if (expectedType === 'string') return typeof value === 'string';
  if (expectedType === 'number') return typeof value === 'number';
  if (expectedType === 'boolean') return typeof value === 'boolean';
  if (expectedType === 'array') return Array.isArray(value);
  if (expectedType === 'object') return typeof value === 'object';
  return false;
}

/**
 * Validate enum values
 * @param value Value to check
 * @param validValues Array of valid values
 * @returns true if value is in validValues
 */
export function validateEnumValue(
  value: any,
  validValues: readonly string[]
): boolean {
  return validValues.includes(value);
}

/**
 * Request validation wrapper
 * Validates request body and sends error response if invalid
 * @returns true if valid, false if invalid (response already sent)
 */
export async function validateRequest(
  reply: FastifyReply,
  data: any,
  requiredFields: string[],
  context: string = '[API]'
): Promise<boolean> {
  const missingFields = validateRequiredFields(data, requiredFields);

  if (missingFields.length > 0) {
    await sendErrorResponse(
      reply,
      `Missing required fields: ${missingFields.join(', ')}`,
      context,
      { missingFields }
    );
    return false;
  }

  return true;
}

/**
 * Safe database operation wrapper
 * Catches database errors and sends standardized response
 */
export async function executeDatabaseOperation<T>(
  operation: () => Promise<T>,
  reply: FastifyReply,
  context: string = '[API]',
  notFoundMessage?: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (notFoundMessage && errorMessage.includes('not found')) {
      await sendErrorResponse(reply, notFoundMessage, context);
    } else {
      await sendErrorResponse(reply, error as Error, context);
    }

    return null;
  }
}

/**
 * Response wrapper for consistent response structure
 */
export function buildSuccessResponse<T>(data: T, message?: string): any {
  return {
    success: true,
    data,
    ...(message && { message })
  };
}

/**
 * Cache key builder with namespace
 */
export function buildCacheKey(namespace: string, ...parts: string[]): string {
  return [namespace, ...parts].join(':');
}

/**
 * Handler wrapper for catching unhandled errors
 */
export function createSafeHandler(
  handler: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
  context: string = '[API]'
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await handler(req, reply);
    } catch (error) {
      if (!reply.sent) {
        await sendErrorResponse(reply, error as Error, context);
      }
    }
  };
}
