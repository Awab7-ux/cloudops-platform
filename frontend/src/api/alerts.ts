import { request } from './client';
import type { AlertPage, AlertRecord, AlertSeverity, AlertType } from './types';
import { isAlertPage } from './validators';

export interface AlertQuery {
  limit: number;
  offset: number;
  severity?: AlertSeverity;
  type?: AlertType;
  application_id?: string;
}

/**
 * Function: listAlerts
 * Purpose: Retrieve a paginated, filtered alert feed from the backend.
 *
 * Args:
 *   query: Pagination and optional severity, type, and application filters.
 * Returns:
 *   A validated alerts page response.
 * Throws:
 *   ApiError when the request fails or the response violates the API contract.
 */
export function listAlerts(query: AlertQuery): Promise<AlertPage> {
  const params = new URLSearchParams({
    limit: String(query.limit),
    offset: String(query.offset),
  });
  if (query.severity) params.set('severity', query.severity);
  if (query.type) params.set('type', query.type);
  if (query.application_id) params.set('application_id', query.application_id);
  return request<AlertPage>(`/alerts?${params.toString()}`, {}, isAlertPage);
}

export type { AlertRecord };
