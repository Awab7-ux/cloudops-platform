import { request } from './client';
import type {
  Deployment,
  DeploymentCreate,
  DeploymentPage,
  DeploymentStatus,
} from './types';
import {
  isDeployment,
  isDeploymentPage,
} from './validators';

/**
 * Function: listDeployments
 * Purpose: Retrieve a paginated deployment list for one application.
 *
 * Args:
 *   applicationId: Parent application identifier.
 *   limit: Maximum number of records requested.
 *   offset: Number of matching records skipped.
 *   status: Optional deployment state filter.
 * Returns:
 *   A validated deployment page.
 * Throws:
 *   ApiError when the request fails or the response violates the API contract.
 */
export function listDeployments(
  applicationId: string,
  { limit, offset, status }: { limit: number; offset: number; status?: DeploymentStatus },
): Promise<DeploymentPage> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) query.set('status', status);
  return request<DeploymentPage>(
    `/applications/${encodeURIComponent(applicationId)}/deployments?${query.toString()}`,
    {},
    isDeploymentPage,
  );
}

/**
 * Function: getDeployment
 * Purpose: Retrieve one deployment by encoded ID.
 * @param id Deployment identifier.
 * @returns A validated deployment record.
 * @throws ApiError when the request fails or the response is invalid.
 */
export function getDeployment(id: string): Promise<Deployment> {
  return request<Deployment>(`/deployments/${encodeURIComponent(id)}`, {}, isDeployment);
}

/**
 * Function: createDeployment
 * Purpose: Create a deployment for an application.
 * @param applicationId Parent application identifier.
 * @param payload Version and optional commit SHA accepted by the backend.
 * @returns The created deployment record.
 * @throws ApiError when validation, transport, or response parsing fails.
 */
export function createDeployment(
  applicationId: string,
  payload: DeploymentCreate,
): Promise<Deployment> {
  return request<Deployment>(
    `/applications/${encodeURIComponent(applicationId)}/deployments`,
    { method: 'POST', body: JSON.stringify(payload) },
    isDeployment,
  );
}

/**
 * Function: updateDeploymentStatus
 * Purpose: Request a deployment lifecycle transition.
 * @param id Deployment identifier.
 * @param status Requested next status.
 * @returns The updated deployment record.
 * @throws ApiError for invalid transitions, concurrency conflicts, or request failures.
 */
export function updateDeploymentStatus(
  id: string,
  status: DeploymentStatus,
): Promise<Deployment> {
  return request<Deployment>(`/deployments/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, isDeployment);
}

/**
 * Function: allowedTransitions
 * Purpose: Return lifecycle states the backend permits from the current state.
 *
 * Args:
 *   status: Current deployment status.
 * Returns:
 *   A new array of valid next statuses; terminal rolled-back state has none.
 */
export function allowedTransitions(status: DeploymentStatus): DeploymentStatus[] {
  const transitions: Record<DeploymentStatus, DeploymentStatus[]> = {
    pending: ['running'],
    running: ['succeeded', 'failed'],
    succeeded: ['rolled_back'],
    failed: ['rolled_back'],
    rolled_back: [],
  };
  return transitions[status];
}
