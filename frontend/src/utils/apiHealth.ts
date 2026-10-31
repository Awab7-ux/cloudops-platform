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

export function getDefaultApiBaseUrl(): string {
  return resolveApiBaseUrl(undefined, { ignoreConfiguredUrl: true });
}

export function isValidHealthPayload(data: unknown): data is HealthResponse {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.status === 'string';
}

export function isValidVersionPayload(data: unknown): data is VersionResponse {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.version === 'string';
}

export function formatEndpointUrl(baseUrl: string, endpoint: string): string {
  const cleanBase = resolveApiBaseUrl(baseUrl);
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanEndpoint}`;
}
