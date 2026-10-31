import {
  ALERT_SEVERITIES,
  ALERT_TYPES,
  APPLICATION_STATUSES,
  DEPLOYMENT_STATUSES,
  ENVIRONMENTS,
  LOG_LEVELS,
} from './types';
import type {
  AlertPage,
  AlertRecord,
  Application,
  ApplicationPage,
  Deployment,
  DeploymentPage,
  LogPage,
  LogRecord,
  SummaryResponse,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isTimestamp(value: unknown): value is string {
  return isString(value) && Number.isFinite(Date.parse(value));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value);
}

function isCountMap(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(
    entry => typeof entry === 'number' && Number.isInteger(entry) && entry >= 0,
  );
}

function isPage<T>(value: unknown, isItem: (item: unknown) => item is T): value is {
  items: T[];
  total: number;
  limit: number;
  offset: number;
} {
  return isRecord(value)
    && Array.isArray(value.items)
    && value.items.every(isItem)
    && typeof value.total === 'number'
    && Number.isInteger(value.total)
    && value.total >= 0
    && typeof value.limit === 'number'
    && Number.isInteger(value.limit)
    && value.limit >= 1
    && typeof value.offset === 'number'
    && Number.isInteger(value.offset)
    && value.offset >= 0;
}

export function isApplication(value: unknown): value is Application {
  return isRecord(value)
    && isString(value.id)
    && isString(value.name)
    && isNullableString(value.description)
    && ENVIRONMENTS.some(environment => environment === value.environment)
    && APPLICATION_STATUSES.some(status => status === value.status)
    && isTimestamp(value.created_at)
    && isTimestamp(value.updated_at);
}

export function isApplicationPage(value: unknown): value is ApplicationPage {
  return isPage(value, isApplication);
}

export function isDeployment(value: unknown): value is Deployment {
  return isRecord(value)
    && isString(value.id)
    && isString(value.application_id)
    && isString(value.version)
    && isNullableString(value.commit_sha)
    && DEPLOYMENT_STATUSES.some(status => status === value.status)
    && isNullableTimestamp(value.started_at)
    && isNullableTimestamp(value.finished_at)
    && isTimestamp(value.created_at);
}

export function isDeploymentPage(value: unknown): value is DeploymentPage {
  return isPage(value, isDeployment);
}

export function isLogRecord(value: unknown): value is LogRecord {
  return isRecord(value)
    && isString(value.id)
    && isString(value.application_id)
    && isNullableString(value.deployment_id)
    && LOG_LEVELS.some(level => level === value.level)
    && isString(value.message)
    && isNullableString(value.source)
    && isTimestamp(value.created_at);
}

export function isLogPage(value: unknown): value is LogPage {
  return isPage(value, isLogRecord);
}

export function isAlertRecord(value: unknown): value is AlertRecord {
  return isRecord(value)
    && isString(value.id)
    && ALERT_TYPES.some(type => type === value.type)
    && ALERT_SEVERITIES.some(severity => severity === value.severity)
    && isString(value.application_id)
    && isString(value.application_name)
    && isNullableString(value.deployment_id)
    && isString(value.message)
    && isTimestamp(value.since);
}

export function isAlertPage(value: unknown): value is AlertPage {
  if (!isRecord(value)) return false;
  const generatedAt = value.generated_at;
  const limit = value.limit;
  return isPage(value, isAlertRecord)
    && isTimestamp(generatedAt)
    && typeof limit === 'number'
    && limit <= 200;
}

export function isSummaryResponse(value: unknown): value is SummaryResponse {
  if (!isRecord(value)
    || !isRecord(value.applications)
    || !isRecord(value.deployments)
    || !isRecord(value.logs)) return false;

  const applications = value.applications;
  const deployments = value.deployments;
  const logs = value.logs;
  return typeof applications.total === 'number'
    && Number.isInteger(applications.total)
    && applications.total >= 0
    && isCountMap(applications.by_status)
    && isCountMap(applications.by_environment)
    && typeof deployments.total === 'number'
    && Number.isInteger(deployments.total)
    && deployments.total >= 0
    && isCountMap(deployments.by_status)
    && typeof deployments.last_24h === 'number'
    && Number.isInteger(deployments.last_24h)
    && deployments.last_24h >= 0
    && typeof logs.total === 'number'
    && Number.isInteger(logs.total)
    && logs.total >= 0
    && typeof logs.errors_last_24h === 'number'
    && Number.isInteger(logs.errors_last_24h)
    && logs.errors_last_24h >= 0
    && Array.isArray(value.recent_failed_deployments)
    && value.recent_failed_deployments.every(item => isRecord(item)
      && isString(item.id)
      && isString(item.application_id)
      && isString(item.application_name)
      && isNullableString(item.commit_sha)
      && isString(item.status)
      && isNullableTimestamp(item.finished_at))
    && isTimestamp(value.generated_at);
}
