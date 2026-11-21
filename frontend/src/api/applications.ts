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

/**
 * Function: listApplications
 * Purpose: Retrieve one filtered page of applications from the API.
 *
 * Args:
 *   limit: Maximum number of records requested.
 *   offset: Number of matching records skipped.
 *   environment: Optional backend environment filter.
 *   status: Optional backend health status filter.
 * Returns:
 *   A validated application page with total and pagination metadata.
 * Throws:
 *   ApiError when the request fails or the response violates the API contract.
 */
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

/**
 * Function: getApplication
 * Purpose: Retrieve one application by encoded ID.
 * @param id Application identifier.
 * @returns A validated application response.
 * @throws ApiError when the request fails or the response is invalid.
 */
export function getApplication(id: string): Promise<Application> {
  return request<Application>(`/applications/${encodeURIComponent(id)}`, {}, isApplication);
}

/**
 * Function: createApplication
 * Purpose: Create an application through the API.
 * @param body Fields accepted by the backend application create schema.
 * @returns The created application record.
 * @throws ApiError when validation, transport, or response parsing fails.
 */
export function createApplication(body: ApplicationCreate): Promise<Application> {
  return request<Application>('/applications', {
    method: 'POST',
    body: JSON.stringify(body),
  }, isApplication);
}

/**
 * Function: updateApplication
 * Purpose: Apply a partial update to an application.
 * @param id Application identifier.
 * @param body Fields to update; an explicit null description clears it.
 * @returns The updated application record.
 * @throws ApiError when the request fails or the response is invalid.
 */
export function updateApplication(
  id: string,
  body: ApplicationUpdate,
): Promise<Application> {
  return request<Application>(`/applications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }, isApplication);
}

/**
 * Function: deleteApplication
 * Purpose: Delete an application and backend-related records.
 * @param id Application identifier.
 * @returns A promise that resolves after the backend's bodyless success response.
 * @throws ApiError when the request fails.
 */
export function deleteApplication(id: string): Promise<void> {
  return request<void>(`/applications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
