import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import { listApplications } from '../api/applications';
import {
  createDeployment,
  listDeployments,
  updateDeploymentStatus,
} from '../api/deployments';
import type { Application, ApplicationPage, Deployment, DeploymentPage } from '../api/types';
import { DeploymentsPage } from './DeploymentsPage';

vi.setConfig({ testTimeout: 15_000 });

vi.mock('../api/applications', () => ({ listApplications: vi.fn() }));
vi.mock('../api/deployments', () => ({
  allowedTransitions: (status: Deployment['status']) => ({
    pending: ['running'],
    running: ['succeeded', 'failed'],
    succeeded: ['rolled_back'],
    failed: ['rolled_back'],
    rolled_back: [],
  }[status] as import('../api/types').DeploymentStatus[]),
  createDeployment: vi.fn(),
  getDeployment: vi.fn(),
  listDeployments: vi.fn(),
  updateDeploymentStatus: vi.fn(),
}));

/**
 * Function: app
 * Purpose: Build an application API record for deployment page tests.
 *
 * Args:
 *   id: Application identifier used by the deployment fixture.
 * Returns:
 *   A complete application record matching the backend response shape.
 */
function app(id: string): Application {
  return {
    id, name: `Application ${id}`, description: null, environment: 'development',
    status: 'healthy', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  };
}

/**
 * Function: deploy
 * Purpose: Build a complete deployment API record for page tests.
 *
 * Args:
 *   status: Lifecycle status to place on the deployment.
 *   id: Deployment identifier.
 * Returns:
 *   A deployment record matching the backend response shape.
 */
function deploy(status: Deployment['status'] = 'pending', id = 'dep-1'): Deployment {
  return {
    id, application_id: 'app-1', version: 'v1.0.0', commit_sha: null, status,
    started_at: null, finished_at: null, created_at: '2026-01-01T00:00:00Z',
  };
}

/**
 * Function: deployPage
 * Purpose: Build a deployment pagination response for tests.
 *
 * Args:
 *   items: Deployment records in the current page.
 *   total: Total matching records.
 *   limit: Page size returned by the API.
 *   offset: Number of records skipped.
 * Returns:
 *   A typed backend-style deployment page.
 */
function deployPage(items: Deployment[], total = items.length, limit = 10, offset = 0): DeploymentPage {
  return { items, total, limit, offset };
}

/** Function: LocationProbe. Purpose: Expose router location and history controls in tests. */
function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location-search">{location.search}</output>
      <button type="button" onClick={() => navigate(-1)}>History back</button>
      <button type="button" onClick={() => navigate(1)}>History forward</button>
    </>
  );
}

/**
 * Function: renderRoutes
 * Purpose: Mount the deployment page with in-memory routing for interaction tests.
 *
 * Args:
 *   path: Initial location, including optional query parameters.
 * Returns:
 *   Testing Library render helpers.
 */
function renderRoutes(path = '/deployments') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/deployments" element={<DeploymentsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DeploymentsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listApplications).mockResolvedValue({
      items: [app('app-1'), app('app-2')], total: 2, limit: 200, offset: 0,
    } satisfies ApplicationPage);
    vi.mocked(listDeployments).mockResolvedValue(deployPage([deploy()]));
    vi.mocked(createDeployment).mockResolvedValue(deploy());
    vi.mocked(updateDeploymentStatus).mockImplementation(async (_id, status) => deploy(status));
  });

  it('retains the original deployment design landmarks', async () => {
    renderRoutes('/deployments?application=app-1');

    expect(await screen.findByRole('heading', { name: 'Deployment History' })).toBeInTheDocument();
    expect(await screen.findByText('Rollout telemetry unavailable')).toBeInTheDocument();
    expect(await screen.findByText('All Recorded Deployments')).toBeInTheDocument();
    expect(await screen.findByText('Deployment API capabilities')).toBeInTheDocument();
  });

  it('loads applications, updates the application query, and lists deployments', async () => {
    const user = userEvent.setup();
    renderRoutes('/deployments?application=app-1');
    expect(await screen.findByText('v1.0.0')).toBeInTheDocument();
    expect(listApplications).toHaveBeenCalledWith({ limit: 200, offset: 0 });
    expect(listDeployments).toHaveBeenCalledWith('app-1', { limit: 10, offset: 0 });
    await user.selectOptions(screen.getByLabelText('Application'), 'app-2');
    await waitFor(() => expect(listDeployments).toHaveBeenLastCalledWith('app-2', { limit: 10, offset: 0 }));
    expect(screen.getByTestId('location-search')).toHaveTextContent('application=app-2');
    await user.click(screen.getByRole('button', { name: 'History back' }));
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('application=app-1'));
    await user.click(screen.getByRole('button', { name: 'History forward' }));
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('application=app-2'));
  });

  it('escapes commas and quotes in deployment CSV fields', async () => {
    const application = { ...app('app-1'), name: 'Billing, "production" API' };
    vi.mocked(listApplications).mockResolvedValue({ items: [application], total: 1, limit: 200, offset: 0 });
    const blobs: Blob[] = [];
    const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (blob: Blob) => { blobs.push(blob); return 'blob:deployment-export'; },
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    try {
      const user = userEvent.setup();
      renderRoutes('/deployments?application=app-1');
      expect(await screen.findByText('v1.0.0')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Export Audit CSV/ }));

      expect(await blobs[0].text()).toContain('"Billing, ""production"" API"');
      expect(click).toHaveBeenCalledOnce();
    } finally {
      click.mockRestore();
      if (createDescriptor) Object.defineProperty(URL, 'createObjectURL', createDescriptor);
      else Reflect.deleteProperty(URL, 'createObjectURL');
      if (revokeDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor);
      else Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('reports clipboard permission failures instead of leaving an unhandled rejection', async () => {
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('Permission denied')) },
    });

    try {
      renderRoutes('/deployments?application=app-1');
      expect(await screen.findByText('v1.0.0')).toBeInTheDocument();
      fireEvent.click(screen.getByTitle('Copy Deployment ID'));
      expect(await screen.findByText('Clipboard access is unavailable in this browser.')).toBeInTheDocument();
    } finally {
      if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('shows an empty application state with a link to Applications', async () => {
    vi.mocked(listApplications).mockResolvedValue({ items: [], total: 0, limit: 200, offset: 0 });
    renderRoutes();
    expect(await screen.findByText(/No applications available/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Applications' }).some(link => link.getAttribute('href') === '/applications')).toBe(true);
  });

  it('retries a failed application list request', async () => {
    const user = userEvent.setup();
    vi.mocked(listApplications)
      .mockRejectedValueOnce(new ApiError('offline', 0, 'network'))
      .mockResolvedValueOnce({
        items: [app('app-1')], total: 1, limit: 200, offset: 0,
      });
    renderRoutes();

    expect(await screen.findByText('offline')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('option', { name: 'Application app-1' })).toBeInTheDocument();
    expect(listApplications).toHaveBeenCalledTimes(2);
  });

  it('shows the empty deployments state for an application with no deployments', async () => {
    vi.mocked(listApplications).mockResolvedValue({ items: [app('app-1')], total: 1, limit: 200, offset: 0 });
    vi.mocked(listDeployments).mockResolvedValue(deployPage([], 0));
    renderRoutes('/deployments?application=app-1');
    expect(await screen.findByText(/No deployments for this application/)).toBeInTheDocument();
  });

  it('shows errors and retries list requests', async () => {
    const user = userEvent.setup();
    vi.mocked(listDeployments).mockRejectedValueOnce(new ApiError('offline', 0, 'network'));
    renderRoutes('/deployments?application=app-1');
    expect(await screen.findByText('offline')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('v1.0.0')).toBeInTheDocument();
  });

  it('paginates deployments and resets offset after changing page size', async () => {
    const user = userEvent.setup();
    vi.mocked(listDeployments)
      .mockResolvedValueOnce(deployPage(Array.from({ length: 10 }, (_, i) => deploy('pending', `d${i}`)), 21))
      .mockResolvedValueOnce(deployPage([deploy('pending', 'd10')], 21, 10, 10))
      .mockResolvedValueOnce(deployPage([deploy()], 21, 25, 0));
    renderRoutes('/deployments?application=app-1');
    expect(await screen.findByText('Showing 1–10 of 21')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(listDeployments).toHaveBeenLastCalledWith('app-1', { limit: 10, offset: 10 }));
    await user.selectOptions(screen.getByLabelText('Deployments per page'), '25');
    await waitFor(() => expect(listDeployments).toHaveBeenLastCalledWith('app-1', { limit: 25, offset: 0 }));
  });

  it('creates a deployment and announces success after refreshing the list', async () => {
    const user = userEvent.setup();
    renderRoutes('/deployments?application=app-1');
    await screen.findByText('v1.0.0');
    await user.click(screen.getByRole('button', { name: 'Create deployment' }));
    await user.type(screen.getByLabelText('Version'), 'v2.0.0');
    await user.type(screen.getByLabelText('Commit SHA'), 'abcdef1');
    await user.click(screen.getByRole('button', { name: 'Save deployment' }));
    expect(createDeployment).toHaveBeenCalledWith('app-1', { version: 'v2.0.0', commit_sha: 'abcdef1' });
    expect(await screen.findByText('Deployment created.')).toBeInTheDocument();
    expect(listDeployments).toHaveBeenCalledTimes(2);
  });

  it('maps 422 field errors and prevents duplicate creates', async () => {
    const user = userEvent.setup();
    let rejectCreate: ((error: Error) => void) | undefined;
    vi.mocked(createDeployment).mockImplementation(() => new Promise((_resolve, reject) => { rejectCreate = reject; }));
    renderRoutes('/deployments?application=app-1');
    await screen.findByText('v1.0.0');
    await user.click(screen.getByRole('button', { name: 'Create deployment' }));
    await user.type(screen.getByLabelText('Version'), 'v2');
    await user.click(screen.getByRole('button', { name: 'Save deployment' }));
    await user.click(screen.getByRole('button', { name: 'Saving…' }));
    expect(createDeployment).toHaveBeenCalledTimes(1);
    rejectCreate?.(new ApiError('validation', 422, 'http', { version: 'Version invalid' }));
    expect(await screen.findByText('Version invalid')).toBeInTheDocument();
    expect(screen.getByLabelText('Version')).toHaveAttribute('aria-describedby', 'deployment-version-error');
  });

  it('explains when the selected application disappears during creation', async () => {
    const user = userEvent.setup();
    vi.mocked(createDeployment).mockRejectedValue(new ApiError('application not found', 404, 'http'));
    renderRoutes('/deployments?application=app-1');
    await screen.findByText('v1.0.0');
    await user.click(screen.getByRole('button', { name: 'Create deployment' }));
    await user.type(screen.getByLabelText('Version'), 'v2');
    await user.click(screen.getByRole('button', { name: 'Save deployment' }));
    expect(await screen.findByText('The selected application was deleted. Choose another application.')).toBeInTheDocument();
  });

  it.each([
    ['pending', ['Start']],
    ['running', ['Mark succeeded', 'Mark failed']],
    ['succeeded', ['Roll back']],
    ['failed', ['Roll back']],
    ['rolled_back', []],
  ] as const)('shows only permitted actions for %s', async (status, expected) => {
    vi.mocked(listDeployments).mockResolvedValue(deployPage([deploy(status)]));
    renderRoutes('/deployments?application=app-1');
    const row = await screen.findByRole('row', { name: /v1.0.0/ });
    const expectedLabels: readonly string[] = expected;
    for (const label of ['Start', 'Mark succeeded', 'Mark failed', 'Roll back']) {
      expect(Boolean(within(row).queryByRole('button', { name: label }))).toBe(expectedLabels.includes(label));
    }
  });

  it.each(['Roll back', 'Mark failed'] as const)('requires confirmation for %s and submits only when accepted', async label => {
    const user = userEvent.setup();
    vi.mocked(listDeployments).mockResolvedValue(deployPage([deploy(label === 'Roll back' ? 'succeeded' : 'running')]));
    renderRoutes('/deployments?application=app-1');
    await user.click(await screen.findByRole('button', { name: label }));
    const dialog = screen.getByRole('dialog', { name: label });
    expect(dialog).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(updateDeploymentStatus).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: label }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }));
    expect(updateDeploymentStatus).toHaveBeenCalledTimes(1);
  });

  it('closes the confirmation dialog on Escape without submitting', async () => {
    const user = userEvent.setup();
    vi.mocked(listDeployments).mockResolvedValue(deployPage([deploy('running')]));
    renderRoutes('/deployments?application=app-1');
    const failed = await screen.findByRole('button', { name: 'Mark failed' });
    await user.click(failed);
    const dialog = screen.getByRole('dialog', { name: 'Mark failed' });
    expect(dialog).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(updateDeploymentStatus).not.toHaveBeenCalled();
  });

  it('reports a 409 and refreshes the list after concurrent status changes', async () => {
    const user = userEvent.setup();
    vi.mocked(updateDeploymentStatus).mockRejectedValue(new ApiError('invalid status transition', 409, 'http'));
    renderRoutes('/deployments?application=app-1');
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    expect(await screen.findByText('Status changed elsewhere. The deployment list was refreshed.')).toBeInTheDocument();
    expect(listDeployments).toHaveBeenCalledTimes(2);
  });
});
