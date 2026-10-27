import { request } from './client';
import type {
  Application,
  ApplicationCreate,
  ApplicationPage,
  ApplicationUpdate,
} from './types';

// WHY: server-side pagination keeps the displayed result range aligned with the API total.
export function listApplications({
  limit,
  offset,
}: {
  limit: number;
  offset: number;
}): Promise<ApplicationPage> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return request<ApplicationPage>(`/applications?${query.toString()}`);
}

// WHY: the detail route is encoded so identifiers cannot alter the request path.
export function getApplication(id: string): Promise<Application> {
  return request<Application>(`/applications/${encodeURIComponent(id)}`);
}

// WHY: create sends only the fields accepted by the create schema.
export function createApplication(body: ApplicationCreate): Promise<Application> {
  return request<Application>('/applications', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// WHY: PATCH preserves omitted fields and allows explicit description clearing.
export function updateApplication(
  id: string,
  body: ApplicationUpdate,
): Promise<Application> {
  return request<Application>(`/applications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// WHY: delete expects the backend's bodyless 204 success response.
export function deleteApplication(id: string): Promise<void> {
  return request<void>(`/applications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
