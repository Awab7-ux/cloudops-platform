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

/** Function: isRecord. Purpose: Narrow an unknown value to a plain record. @param value Candidate value. @returns True for a non-null, non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Function: isString. Purpose: Narrow an unknown value to a string. @param value Candidate value. @returns True when value is a string. */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** Function: isTimestamp. Purpose: Check for a parseable timestamp string. @param value Candidate value. @returns True when the string parses to a finite date. */
function isTimestamp(value: unknown): value is string {
  return isString(value) && Number.isFinite(Date.parse(value));
}

/** Function: isNullableString. Purpose: Accept a string or null. @param value Candidate value. @returns True for either supported value. */
function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

/** Function: isNullableTimestamp. Purpose: Accept a timestamp string or null. @param value Candidate value. @returns True when null or a valid timestamp. */
function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value);
}

/** Function: isCountMap. Purpose: Validate a map of non-negative integer counts. @param value Candidate map. @returns True when every value is a non-negative integer. */
function isCountMap(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(
    entry => typeof entry === 'number' && Number.isInteger(entry) && entry >= 0,
  );
}

/** Function: isPage. Purpose: Validate pagination metadata and every item. @param value Candidate page. @param isItem Validator for one item. @returns True when the page envelope and all items are valid. */
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

/** Function: isApplication. Purpose: Validate an application API record. @param value Candidate response value. @returns True when every required application field matches the contract. */
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

/** Function: isApplicationPage. Purpose: Validate a paginated application response. @param value Candidate page. @returns True when the envelope and all application records are valid. */
export function isApplicationPage(value: unknown): value is ApplicationPage {
  return isPage(value, isApplication);
}

/** Function: isDeployment. Purpose: Validate a deployment API record. @param value Candidate response value. @returns True when required fields and lifecycle status match the contract. */
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

/** Function: isDeploymentPage. Purpose: Validate a paginated deployment response. @param value Candidate page. @returns True when the envelope and all deployment records are valid. */
export function isDeploymentPage(value: unknown): value is DeploymentPage {
  return isPage(value, isDeployment);
}

/** Function: isLogRecord. Purpose: Validate a log record from the backend. @param value Candidate response value. @returns True when all required log fields are valid. */
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

/** Function: isLogPage. Purpose: Validate a paginated log response. @param value Candidate page. @returns True when the envelope and all log records are valid. */
export function isLogPage(value: unknown): value is LogPage {
  return isPage(value, isLogRecord);
}

/** Function: isAlertRecord. Purpose: Validate a derived backend alert record. @param value Candidate response value. @returns True when alert type, severity, and fields match the contract. */
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

/** Function: isAlertPage. Purpose: Validate alert items, pagination, and generation time. @param value Candidate page. @returns True when items, metadata, and max limit are valid. */
export function isAlertPage(value: unknown): value is AlertPage {
  if (!isRecord(value)) return false;
  const generatedAt = value.generated_at;
  const limit = value.limit;
  return isPage(value, isAlertRecord)
    && isTimestamp(generatedAt)
    && typeof limit === 'number'
    && limit <= 200;
}

/** Function: isSummaryResponse. Purpose: Validate aggregate summary data from the API. @param value Candidate response value. @returns True when counts and recent failures match the response contract. */
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
