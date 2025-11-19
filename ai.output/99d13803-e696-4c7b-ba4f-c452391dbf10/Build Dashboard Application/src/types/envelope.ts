/**
 * Envelope types matching the backend API pattern
 * All API responses follow this structure as per Zyp policies
 */

export type SuccessEnvelope<T> = {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
    version?: string;
  };
};

export type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId?: string;
  };
};

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

/**
 * Type guard to check if response is successful
 */
export function isSuccess<T>(
  response: ApiEnvelope<T>
): response is SuccessEnvelope<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is error
 */
export function isError<T>(
  response: ApiEnvelope<T>
): response is ErrorEnvelope {
  return response.success === false;
}

/**
 * Extract data from successful response or throw
 */
export function unwrapResponse<T>(response: ApiEnvelope<T>): T {
  if (isSuccess(response)) {
    return response.data;
  }
  throw new Error(response.error.message);
}

/**
 * Extract data from successful response or return default
 */
export function unwrapOr<T>(response: ApiEnvelope<T>, defaultValue: T): T {
  if (isSuccess(response)) {
    return response.data;
  }
  return defaultValue;
}