import { request } from './client';
import type { LogCreate, LogLevel, LogPage, LogRecord } from './types';
import { isLogPage, isLogRecord } from './validators';

export interface LogQuery {
  limit: number;
  offset: number;
  level?: LogLevel;
  application_id?: string;
  deployment_id?: string;
  since?: string;
  until?: string;
}

/**
 * Function: queryString
 * Purpose: Encode log pagination and filters as URL query parameters.
 *
 * Args:
 *   query: Pagination and optional level, application, deployment, and time filters.
 * Returns:
 *   URL-encoded query parameters without a leading question mark.
 */
function queryString(query: LogQuery): string {
  const params = new URLSearchParams({
    limit: String(query.limit),
    offset: String(query.offset),
  });
  if (query.level) params.set('level', query.level);
  if (query.application_id) params.set('application_id', query.application_id);
  if (query.deployment_id) params.set('deployment_id', query.deployment_id);
  if (query.since) params.set('since', query.since);
  if (query.until) params.set('until', query.until);
  return params.toString();
}

/**
 * Function: listLogs
 * Purpose: Retrieve a filtered, paginated global log page.
 * @param query Pagination and optional log filters.
 * @returns A validated log page.
 * @throws ApiError when the request fails or the response is invalid.
 */
export function listLogs(query: LogQuery): Promise<LogPage> {
  return request<LogPage>(`/logs?${queryString(query)}`, {}, isLogPage);
}

/**
 * Function: listApplicationLogs
 * Purpose: Retrieve logs scoped to one application.
 * @param applicationId Parent application identifier.
 * @param query Pagination and optional log filters.
 * @returns A validated log page.
 * @throws ApiError when the request fails or the response is invalid.
 */
export function listApplicationLogs(
  applicationId: string,
  query: LogQuery,
): Promise<LogPage> {
  return request<LogPage>(
    `/applications/${encodeURIComponent(applicationId)}/logs?${queryString(query)}`,
    {},
    isLogPage,
  );
}

/**
 * Function: listDeploymentLogs
 * Purpose: Retrieve logs scoped to one deployment.
 * @param deploymentId Deployment identifier.
 * @param query Pagination and optional log filters.
 * @returns A validated log page.
 * @throws ApiError when the request fails or the response is invalid.
 */
export function listDeploymentLogs(
  deploymentId: string,
  query: LogQuery,
): Promise<LogPage> {
  return request<LogPage>(
    `/deployments/${encodeURIComponent(deploymentId)}/logs?${queryString(query)}`,
    {},
    isLogPage,
  );
}

/**
 * Function: createApplicationLog
 * Purpose: Append a log record to an application.
 * @param applicationId Parent application identifier.
 * @param body Log fields accepted by the backend create schema.
 * @returns The validated created log record.
 * @throws ApiError when validation, transport, or response parsing fails.
 */
export function createApplicationLog(
  applicationId: string,
  body: LogCreate,
): Promise<LogRecord> {
  return request<LogRecord>(
    `/applications/${encodeURIComponent(applicationId)}/logs`,
    { method: 'POST', body: JSON.stringify(body) },
    isLogRecord,
  );
}
