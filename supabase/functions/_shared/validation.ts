/**
 * Shared validation utilities for Edge Functions
 * Prevents mass assignment and injection vulnerabilities
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Validates and sanitizes a limit parameter
 * @param limit - The limit value from query params
 * @param defaultValue - Default if not provided
 * @param max - Maximum allowed value
 * @returns Validated limit number
 */
export function validateLimit(
  limit: string | null,
  defaultValue: number = 10,
  max: number = 100
): number {
  if (!limit) return defaultValue

  const parsed = parseInt(limit, 10)

  if (isNaN(parsed)) {
    throw new ValidationError(`Invalid limit: must be a number`)
  }

  if (parsed < 1) {
    throw new ValidationError(`Invalid limit: must be at least 1`)
  }

  if (parsed > max) {
    throw new ValidationError(`Invalid limit: maximum is ${max}`)
  }

  return parsed
}

/**
 * Validates offset parameter
 */
export function validateOffset(offset: string | null): number {
  if (!offset) return 0

  const parsed = parseInt(offset, 10)

  if (isNaN(parsed) || parsed < 0) {
    throw new ValidationError(`Invalid offset: must be a non-negative number`)
  }

  return parsed
}

/**
 * Validates and filters keys against a whitelist
 */
export function validateKeys(
  keys: string | null,
  allowedKeys: string[]
): string[] {
  if (!keys) return allowedKeys

  const requestedKeys = keys.split(',').map(k => k.trim())
  const validKeys = requestedKeys.filter(k => allowedKeys.includes(k))

  if (validKeys.length === 0) {
    throw new ValidationError(`No valid keys provided. Allowed: ${allowedKeys.join(', ')}`)
  }

  return validKeys
}

/**
 * Whitelists allowed fields from request body
 * Prevents mass assignment vulnerabilities
 */
export function whitelistFields<T extends Record<string, any>>(
  body: any,
  allowedFields: (keyof T)[]
): Partial<T> {
  const result: Partial<T> = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      result[field] = body[field]
    }
  }

  return result
}

/**
 * Validates UUID format
 */
export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Validates email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Sanitizes string input (removes potential XSS/injection attempts)
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove angle brackets
}

/**
 * Validates process data before insert/update
 */
export interface ProcessInput {
  process_name?: string
  process_unique_id?: string
  pm_process_id?: number
  owner_username?: string | null
  input_processes?: string[] | null
  output_processes?: string[] | null
  canvas_position?: { x: number; y: number } | null
  metadata?: Record<string, any> | null
  regions?: string[] | null
}

export function validateProcessInput(body: any): Partial<ProcessInput> {
  const allowedFields: (keyof ProcessInput)[] = [
    'process_name',
    'process_unique_id',
    'pm_process_id',
    'owner_username',
    'input_processes',
    'output_processes',
    'canvas_position',
    'metadata',
    'regions',
  ]

  const data = whitelistFields<ProcessInput>(body, allowedFields)

  // Validate required fields for creation
  if (body.process_name && typeof body.process_name !== 'string') {
    throw new ValidationError('process_name must be a string')
  }

  if (body.pm_process_id && typeof body.pm_process_id !== 'number') {
    throw new ValidationError('pm_process_id must be a number')
  }

  // Sanitize string fields
  if (data.process_name) {
    data.process_name = sanitizeString(data.process_name, 255)
  }

  if (data.owner_username) {
    data.owner_username = sanitizeString(data.owner_username, 255)
  }

  return data
}

/**
 * Validates system input
 */
export interface SystemInput {
  system_name?: string
  system_unique_id?: string
  description?: string | null
  metadata?: Record<string, any> | null
}

export function validateSystemInput(body: any): Partial<SystemInput> {
  const allowedFields: (keyof SystemInput)[] = [
    'system_name',
    'system_unique_id',
    'description',
    'metadata',
  ]

  const data = whitelistFields<SystemInput>(body, allowedFields)

  if (data.system_name) {
    data.system_name = sanitizeString(data.system_name, 255)
  }

  if (data.description) {
    data.description = sanitizeString(data.description, 1000)
  }

  return data
}

/**
 * Validates control input
 */
export interface ControlInput {
  control_name?: string | null
  control_id?: string | null
  control_unique_id?: string
  description?: string | null
  metadata?: Record<string, any> | null
}

export function validateControlInput(body: any): Partial<ControlInput> {
  const allowedFields: (keyof ControlInput)[] = [
    'control_name',
    'control_id',
    'control_unique_id',
    'description',
    'metadata',
  ]

  const data = whitelistFields<ControlInput>(body, allowedFields)

  if (data.control_name) {
    data.control_name = sanitizeString(data.control_name, 255)
  }

  if (data.description) {
    data.description = sanitizeString(data.description, 1000)
  }

  return data
}

/**
 * Validates critical operation input
 */
export interface CriticalOperationInput {
  operation_name?: string
  description?: string | null
  system_id?: string | null
  color_code?: string | null
}

export function validateCriticalOperationInput(body: any): Partial<CriticalOperationInput> {
  const allowedFields: (keyof CriticalOperationInput)[] = [
    'operation_name',
    'description',
    'system_id',
    'color_code',
  ]

  const data = whitelistFields<CriticalOperationInput>(body, allowedFields)

  if (data.operation_name) {
    data.operation_name = sanitizeString(data.operation_name, 255)
  }

  if (data.description) {
    data.description = sanitizeString(data.description, 1000)
  }

  if (data.color_code) {
    data.color_code = sanitizeString(data.color_code, 50)
  }

  // Validate UUIDs if provided
  if (data.system_id && !validateUUID(data.system_id)) {
    throw new ValidationError('system_id must be a valid UUID')
  }

  return data
}

/**
 * Validates user profile input
 */
export interface UserProfileInput {
  full_name?: string | null
  role?: 'promaster' | 'basic' | null
}

export function validateUserProfileInput(body: any): Partial<UserProfileInput> {
  const allowedFields: (keyof UserProfileInput)[] = [
    'full_name',
    'role',
  ]

  const data = whitelistFields<UserProfileInput>(body, allowedFields)

  if (data.full_name) {
    data.full_name = sanitizeString(data.full_name, 255)
  }

  // Validate role enum
  if (data.role && !['promaster', 'basic'].includes(data.role)) {
    throw new ValidationError('role must be either "promaster" or "basic"')
  }

  return data
}
