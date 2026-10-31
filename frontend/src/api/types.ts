// WHY: backend-owned values are represented as unions so invalid API states cannot enter forms.
export const ENVIRONMENTS = ['development', 'staging', 'production'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

// WHY: the backend status enum includes unknown as the create default and valid editable state.
export const APPLICATION_STATUSES = ['healthy', 'degraded', 'down', 'unknown'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface Application {
  id: string;
  name: string;
  description: string | null;
  environment: Environment;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
}

export interface ApplicationCreate {
  name: string;
  description?: string | null;
  environment: Environment;
  status?: ApplicationStatus;
}

export interface ApplicationUpdate {
  name?: string;
  description?: string | null;
  environment?: Environment;
  status?: ApplicationStatus;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type ApplicationPage = Page<Application>;

export const LOG_LEVELS = ['debug', 'info', 'warning', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LogRecord {
  id: string;
  application_id: string;
  deployment_id: string | null;
  level: LogLevel;
  message: string;
  source: string | null;
  created_at: string;
}

export type LogPage = Page<LogRecord>;

export interface LogCreate {
  level?: LogLevel;
  message: string;
  source?: string | null;
  deployment_id?: string | null;
}

export const ALERT_SEVERITIES = ['high', 'medium'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_TYPES = [
  'deployment_failed',
  'deployment_stuck',
  'error_log_spike',
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export interface AlertRecord {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  application_id: string;
  application_name: string;
  deployment_id: string | null;
  message: string;
  since: string;
}

export interface AlertPage {
  items: AlertRecord[];
  total: number;
  limit: number;
  offset: number;
  generated_at: string;
}

export interface ApplicationSummary {
  total: number;
  by_status: Record<string, number>;
  by_environment: Record<string, number>;
}

export interface DeploymentSummary {
  total: number;
  by_status: Record<string, number>;
  last_24h: number;
}

export interface LogSummary {
  total: number;
  errors_last_24h: number;
}

export interface RecentFailedDeployment {
  id: string;
  application_id: string;
  application_name: string;
  commit_sha: string | null;
  status: string;
  finished_at: string | null;
}

export interface SummaryResponse {
  applications: ApplicationSummary;
  deployments: DeploymentSummary;
  logs: LogSummary;
  recent_failed_deployments: RecentFailedDeployment[];
  generated_at: string;
}

// WHY: deployment states mirror the backend enum and constrain lifecycle actions.
export const DEPLOYMENT_STATUSES = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'rolled_back',
] as const;
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

export interface Deployment {
  id: string;
  application_id: string;
  version: string;
  commit_sha: string | null;
  status: DeploymentStatus;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface DeploymentCreate {
  version: string;
  commit_sha?: string | null;
}

export type DeploymentPage = Page<Deployment>;
