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
