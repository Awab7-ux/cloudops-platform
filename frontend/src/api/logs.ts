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

export function listLogs(query: LogQuery): Promise<LogPage> {
  return request<LogPage>(`/logs?${queryString(query)}`, {}, isLogPage);
}

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
