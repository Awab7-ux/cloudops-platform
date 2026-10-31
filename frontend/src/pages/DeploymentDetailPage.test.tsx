import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import { getApplication } from '../api/applications';
import { getDeployment, updateDeploymentStatus } from '../api/deployments';
import type { Application, Deployment, DeploymentStatus } from '../api/types';
import { DeploymentDetailPage } from './DeploymentDetailPage';

vi.setConfig({ testTimeout: 15_000 });

vi.mock('../api/deployments', () => ({
  allowedTransitions: (status: DeploymentStatus) => ({
    pending: ['running'],
    running: ['succeeded', 'failed'],
    succeeded: ['rolled_back'],
    failed: ['rolled_back'],
    rolled_back: [],
  }[status] as DeploymentStatus[]),
  getDeployment: vi.fn(),
  updateDeploymentStatus: vi.fn(),
}));
vi.mock('../api/applications', () => ({ getApplication: vi.fn() }));

// WHY: complete API records keep detail-page tests aligned with the backend response model.
function deployment(status: DeploymentStatus = 'pending'): Deployment {
  return {
    id: 'dep-1',
    application_id: 'app/1',
    version: 'v1.0.0',
    commit_sha: null,
    status,
    started_at: null,
    finished_at: null,
    created_at: '2026-01-01T00:00:00Z',
  };
}

const parentApplication: Application = {
  id: 'app/1', name: 'payments', description: null, environment: 'staging', status: 'healthy',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

// WHY: mounting the real route exercises route params and generated back-link destinations.
function renderDetails(path = '/deployments/dep-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/deployments/:id" element={<DeploymentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DeploymentDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getApplication).mockResolvedValue(parentApplication);
    vi.mocked(getDeployment).mockResolvedValue(deployment());
    vi.mocked(updateDeploymentStatus).mockImplementation(async (_id, status) => deployment(status));
  });

  it('shows backend deployment details and unavailable cluster capabilities', async () => {
    renderDetails();

    expect(await screen.findByRole('heading', { name: 'Deployment dep-1' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Deployment details' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Cluster rollout data' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Deployment logs' })).toBeInTheDocument();
  });

  it('renders the live deployment fields and transition flow', async () => {
    const user = userEvent.setup();
    renderDetails('/deployments/dep-1');
    expect(await screen.findByText('v1.0.0')).toBeInTheDocument();
    expect(getDeployment).toHaveBeenCalledWith('dep-1');
    expect(screen.getByText('payments')).toBeInTheDocument();
    expect(screen.getByText('staging')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(updateDeploymentStatus).toHaveBeenCalledWith('dep-1', 'running'));
    expect(screen.getByRole('link', { name: /Back to deployments/ })).toHaveAttribute('href', '/deployments?application=app%2F1');
  });

  it('shows a not-found state for a missing deployment', async () => {
    vi.mocked(getDeployment).mockRejectedValue(new ApiError('deployment not found', 404, 'http'));
    renderDetails('/deployments/missing');
    expect(await screen.findByText('Deployment not found.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Deployment missing' })).not.toBeInTheDocument();
  });

  it('shows a loading state while the deployment request is pending', async () => {
    let resolveRequest: ((record: Deployment) => void) | undefined;
    vi.mocked(getDeployment).mockImplementation(
      () => new Promise(resolve => { resolveRequest = resolve; }),
    );
    renderDetails();
    expect(screen.getByRole('status')).toHaveTextContent('Loading deployment…');
    resolveRequest?.(deployment());
    expect(await screen.findByText('v1.0.0')).toBeInTheDocument();
  });

  it.each([
    ['HTTP 500', new ApiError('Request failed (HTTP 500).', 500, 'http')],
    ['network failure', new ApiError('Unable to reach the API. Check the connection and try again.', 0, 'network')],
  ])('shows the %s error without misreporting a missing deployment', async (_label, error) => {
    vi.mocked(getDeployment).mockRejectedValue(error);
    renderDetails();
    expect(await screen.findByRole('alert')).toHaveTextContent(error.message);
    expect(screen.queryByText('Deployment not found.')).not.toBeInTheDocument();
  });

  it('shows the new running status from the successful transition response', async () => {
    const user = userEvent.setup();
    vi.mocked(updateDeploymentStatus).mockResolvedValue(deployment('running'));
    renderDetails();
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    expect(await screen.findByText('running')).toBeInTheDocument();
  });

  it('reports a 409 and re-fetches the latest deployment', async () => {
    const user = userEvent.setup();
    vi.mocked(getDeployment)
      .mockResolvedValueOnce(deployment('pending'))
      .mockResolvedValueOnce(deployment('running'));
    vi.mocked(updateDeploymentStatus).mockRejectedValue(
      new ApiError('invalid status transition', 409, 'http'),
    );
    renderDetails();
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    expect(await screen.findByText('Status changed elsewhere. Deployment details were refreshed.')).toBeInTheDocument();
    await waitFor(() => expect(getDeployment).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('running')).toBeInTheDocument();
  });

  it.each([
    ['Roll back', 'succeeded', 'rolled_back'],
    ['Mark failed', 'running', 'failed'],
  ] as const)('requires confirmation for %s and supports cancel, Escape, and confirm', async (label, initialStatus, target) => {
    const user = userEvent.setup();
    vi.mocked(getDeployment).mockResolvedValue(deployment(initialStatus));
    renderDetails();

    await user.click(await screen.findByRole('button', { name: label }));
    const firstDialog = screen.getByRole('dialog', { name: label });
    expect(firstDialog).toHaveFocus();
    await user.click(within(firstDialog).getByRole('button', { name: 'Cancel' }));
    expect(updateDeploymentStatus).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: label }));
    expect(screen.getByRole('dialog', { name: label })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(updateDeploymentStatus).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: label }));
    await user.click(within(screen.getByRole('dialog', { name: label })).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(updateDeploymentStatus).toHaveBeenCalledWith('dep-1', target));
  });

  it('renders only the transitions allowed for the current status', async () => {
    renderDetails();
    await screen.findByText('v1.0.0');
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark succeeded' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark failed' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Roll back' })).not.toBeInTheDocument();
  });
});
