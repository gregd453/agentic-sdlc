/**
 * Platform Constants
 * Session #87: Constants for platform and surface management
 */

// Platform layers
export const PLATFORM_LAYERS = {
  APPLICATION: 'APPLICATION',
  DATA: 'DATA',
  INFRASTRUCTURE: 'INFRASTRUCTURE',
  ENTERPRISE: 'ENTERPRISE'
} as const;

export const PLATFORM_LAYER_VALUES = Object.values(PLATFORM_LAYERS) as readonly string[];

// Surface types
export const SURFACE_TYPES = {
  REST: 'REST',
  WEBHOOK: 'WEBHOOK',
  CLI: 'CLI',
  DASHBOARD: 'DASHBOARD',
  MOBILE_API: 'MOBILE_API'
} as const;

export const SURFACE_TYPE_VALUES = Object.values(SURFACE_TYPES) as readonly string[];

// Error messages
export const PLATFORM_ERROR_MESSAGES = {
  INVALID_INPUT: 'Invalid platform input',
  NAME_REQUIRED: 'Platform name is required',
  NAME_EXISTS: 'A platform with this name already exists',
  PLATFORM_NOT_FOUND: 'Platform not found',
  SURFACE_NOT_FOUND: 'Surface not found',
  DUPLICATE_SURFACE: 'Surface with this type already exists for this platform',
  INVALID_LAYER: 'Invalid platform layer',
  INVALID_SURFACE_TYPE: 'Invalid surface type'
} as const;

// Logging context
export const LOG_CONTEXT_PLATFORM = '[Platform]' as const;
export const LOG_CONTEXT_SURFACE = '[Surface]' as const;

// Cache keys
export const CACHE_KEYS = {
  PLATFORMS: 'platforms:list',
  PLATFORM_BY_ID: (id: string): string => `platform:${id}`,
  SURFACES: 'surfaces:list',
  SURFACE_BY_ID: (id: string): string => `surface:${id}`
} as const;

// Platform status
export const PLATFORM_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
} as const;

// Surface status
export const SURFACE_STATUS = {
  ENABLED: 'enabled',
  DISABLED: 'disabled'
} as const;
