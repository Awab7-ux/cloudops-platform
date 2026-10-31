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

// WHY: list responses remain scoped to an application because the API has no global list route.
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

// WHY: encoding keeps deployment identifiers from changing the detail request path.
export function getDeployment(id: string): Promise<Deployment> {
  return request<Deployment>(`/deployments/${encodeURIComponent(id)}`, {}, isDeployment);
}

// WHY: creation sends only fields accepted by the strict backend request schema.
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

// WHY: status changes use the backend's PATCH route and exact {status} payload.
export function updateDeploymentStatus(
  id: string,
  status: DeploymentStatus,
): Promise<Deployment> {
  return request<Deployment>(`/deployments/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, isDeployment);
}

// WHY: this mirrors the server state machine to prevent invalid actions before requests.
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
