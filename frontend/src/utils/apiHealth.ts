/**
 * API Health client configuration and payload validation helpers.
 */

import { resolveApiBaseUrl } from '../api/client';

export interface HealthResponse {
  status: string;
  service?: string;
  [key: string]: unknown;
}

export interface VersionResponse {
  version: string;
  build?: string;
  [key: string]: unknown;
}

/**
 * Function: getDefaultApiBaseUrl
 * Purpose: Resolve the environment/default URL without a Settings override.
 * @returns The configured build-time URL or the local default.
 */
export function getDefaultApiBaseUrl(): string {
  return resolveApiBaseUrl(undefined, { ignoreConfiguredUrl: true });
}

/**
 * Function: isValidHealthPayload
 * Purpose: Narrow an unknown body to a health response.
 * @param data Response value to inspect.
 * @returns True when the value is a non-null object with a string status.
 */
export function isValidHealthPayload(data: unknown): data is HealthResponse {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.status === 'string';
}

/**
 * Function: isValidVersionPayload
 * Purpose: Narrow an unknown body to a version response.
 * @param data Response value to inspect.
 * @returns True when the value is a non-null object with a string version.
 */
export function isValidVersionPayload(data: unknown): data is VersionResponse {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.version === 'string';
}

/**
 * Function: formatEndpointUrl
 * Purpose: Join a resolved API origin and endpoint path.
 * @param baseUrl API origin to normalize.
 * @param endpoint Endpoint path, with or without a leading slash.
 * @returns The normalized origin and endpoint joined with one slash.
 */
export function formatEndpointUrl(baseUrl: string, endpoint: string): string {
  const cleanBase = resolveApiBaseUrl(baseUrl);
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanEndpoint}`;
}
