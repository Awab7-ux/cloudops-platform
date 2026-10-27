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
