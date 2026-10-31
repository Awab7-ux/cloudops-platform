import { request } from './client';
import type {
  Application,
  ApplicationCreate,
  ApplicationPage,
  ApplicationStatus,
  ApplicationUpdate,
  Environment,
} from './types';
import {
  isApplication,
  isApplicationPage,
} from './validators';

// WHY: server-side pagination keeps the displayed result range aligned with the API total.
export function listApplications({
  limit,
  offset,
  environment,
  status,
}: {
  limit: number;
  offset: number;
  environment?: Environment;
  status?: ApplicationStatus;
}): Promise<ApplicationPage> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (environment) query.set('environment', environment);
  if (status) query.set('status', status);
  return request<ApplicationPage>(`/applications?${query.toString()}`, {}, isApplicationPage);
}

// WHY: the detail route is encoded so identifiers cannot alter the request path.
export function getApplication(id: string): Promise<Application> {
  return request<Application>(`/applications/${encodeURIComponent(id)}`, {}, isApplication);
}

// WHY: create sends only the fields accepted by the create schema.
export function createApplication(body: ApplicationCreate): Promise<Application> {
  return request<Application>('/applications', {
    method: 'POST',
    body: JSON.stringify(body),
  }, isApplication);
}

// WHY: PATCH preserves omitted fields and allows explicit description clearing.
export function updateApplication(
  id: string,
  body: ApplicationUpdate,
): Promise<Application> {
  return request<Application>(`/applications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }, isApplication);
}

// WHY: delete expects the backend's bodyless 204 success response.
export function deleteApplication(id: string): Promise<void> {
  return request<void>(`/applications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
