import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Application, ApplicationPage, SummaryResponse } from '../api/types';
import { ApiError } from '../api/client';
import {
  createApplication,
  deleteApplication,
  listApplications,
  updateApplication,
} from '../api/applications';
import { getSummary } from '../api/summary';
import { ApplicationsPage } from './ApplicationsPage';

vi.setConfig({ testTimeout: 15_000 });

vi.mock('../api/applications', () => ({
  createApplication: vi.fn(),
  deleteApplication: vi.fn(),
  getApplication: vi.fn(),
  listApplications: vi.fn(),
  updateApplication: vi.fn(),
}));
vi.mock('../api/summary', () => ({ getSummary: vi.fn() }));

const summary: SummaryResponse = {
  applications: {
    total: 1,
    by_status: { healthy: 1, degraded: 0, down: 0, unknown: 0 },
    by_environment: { production: 1, staging: 0, development: 0 },
  },
  deployments: {
    total: 0,
    by_status: { pending: 0, running: 0, succeeded: 0, failed: 0, rolled_back: 0 },
    last_24h: 0,
  },
  logs: { total: 0, errors_last_24h: 0 },
  recent_failed_deployments: [],
  generated_at: '2026-01-01T00:00:00Z',
};

// WHY: stable records make ordering, pagination, and form assertions readable.
function application(id: number, overrides: Partial<Application> = {}): Application {
  return {
    id: `app-${id}`,
    name: `Application ${id}`,
    description: `Description ${id}`,
    environment: 'development',
    status: 'healthy',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// WHY: the API mock returns the same envelope as the real paginated endpoint.
function page(items: Application[], total = items.length, limit = 10, offset = 0): ApplicationPage {
  return { items, total, limit, offset };
}

// WHY: each test starts from a predictable first page and clean mock history.
function renderApplications(initialPage = page([application(1)])) {
  vi.mocked(listApplications).mockResolvedValue(initialPage);
  return render(<MemoryRouter><ApplicationsPage /></MemoryRouter>);
}

describe('ApplicationsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listApplications).mockResolvedValue(page([application(1)]));
    vi.mocked(getSummary).mockResolvedValue(summary);
    vi.mocked(createApplication).mockResolvedValue(application(2));
    vi.mocked(updateApplication).mockResolvedValue(application(1));
    vi.mocked(deleteApplication).mockResolvedValue(undefined);
  });

  it('retains the original application design landmarks', async () => {
    renderApplications();

    expect(await screen.findByRole('heading', { name: 'Application Services' })).toBeInTheDocument();
    expect(await screen.findByText('Production applications')).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: /Application \/ Port/ })).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: /Telemetry \(CPU\/RAM\)/ })).toBeInTheDocument();
  });

  // WHY: users need visible loading and error recovery while the API is unavailable.
  it('shows loading, then an error and retries the failed request', async () => {
    const user = userEvent.setup();
    let rejectList: ((reason: Error) => void) | undefined;
    vi.mocked(listApplications).mockImplementationOnce(
      () => new Promise((_resolve, reject) => { rejectList = reject; }),
    );
    render(<MemoryRouter><ApplicationsPage /></MemoryRouter>);

    expect(screen.getByText('Loading applications…')).toBeInTheDocument();
    rejectList?.(new ApiError('offline', 0, 'network'));
    expect(await screen.findByText('offline')).toBeInTheDocument();
    vi.mocked(listApplications).mockResolvedValueOnce(page([application(1)]));
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('row', { name: /^Application 1\b/ })).toBeInTheDocument();
  });

  // WHY: a truly empty live collection needs a clear create action.
  it('shows an empty state and opens its create form', async () => {
    const user = userEvent.setup();
    renderApplications(page([], 0));

    expect(await screen.findByText('No microservices found')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create application' }));
    expect(screen.getByRole('heading', { name: 'Create application' })).toBeInTheDocument();
  });

  // WHY: pagination controls must not permit offsets outside the current result set.
  it('pages through server results and resets the offset when page size changes', async () => {
    const user = userEvent.setup();
    vi.mocked(listApplications)
      .mockResolvedValueOnce(page(Array.from({ length: 10 }, (_, i) => application(i + 1)), 21))
      .mockResolvedValueOnce(page(Array.from({ length: 10 }, (_, i) => application(i + 11)), 21, 10, 10))
      .mockResolvedValueOnce(page(Array.from({ length: 10 }, (_, i) => application(i + 1)), 21, 25, 0));
    render(<MemoryRouter><ApplicationsPage /></MemoryRouter>);

    expect(await screen.findByText('Showing 1–10 of 21')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByRole('row', { name: /^Application 11\b/ })).toBeInTheDocument();
    expect(listApplications).toHaveBeenLastCalledWith({ limit: 10, offset: 10 });
    await user.selectOptions(screen.getByLabelText('Applications per page'), '25');
    await waitFor(() => expect(listApplications).toHaveBeenLastCalledWith({ limit: 25, offset: 0 }));
  });

  it('sends environment and status filters to the backend and uses the filtered total', async () => {
    const user = userEvent.setup();
    const productionApplication = application(30, { environment: 'production' });
    const degradedApplication = application(31, { environment: 'production', status: 'degraded' });
    vi.mocked(listApplications)
      .mockResolvedValueOnce(page(Array.from({ length: 10 }, (_, i) => application(i + 1)), 21))
      .mockResolvedValueOnce(page(Array.from({ length: 10 }, (_, i) => application(i + 11)), 21, 10, 10))
      .mockResolvedValueOnce(page([productionApplication], 4, 10, 0))
      .mockResolvedValueOnce(page([degradedApplication], 1, 10, 0));
    render(<MemoryRouter><ApplicationsPage /></MemoryRouter>);

    await screen.findByRole('row', { name: /^Application 1\b/ });
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByRole('row', { name: /^Application 11\b/ });

    await user.selectOptions(screen.getAllByRole('combobox')[0], 'production');
    expect(await screen.findByRole('row', { name: /^Application 30\b/ })).toBeInTheDocument();
    expect(listApplications).toHaveBeenLastCalledWith({
      limit: 10,
      offset: 0,
      environment: 'production',
    });
    expect(screen.getByText('4 Services')).toBeInTheDocument();

    await user.selectOptions(screen.getAllByRole('combobox')[1], 'degraded');
    expect(await screen.findByRole('row', { name: /^Application 31\b/ })).toBeInTheDocument();
    expect(listApplications).toHaveBeenLastCalledWith({
      limit: 10,
      offset: 0,
      environment: 'production',
      status: 'degraded',
    });
    expect(screen.getByText('1 Services')).toBeInTheDocument();
  });

  it('ignores an outdated list response after a filter change', async () => {
    const user = userEvent.setup();
    let resolveUnfiltered: ((value: ApplicationPage) => void) | undefined;
    vi.mocked(listApplications)
      .mockImplementationOnce(() => new Promise(resolve => { resolveUnfiltered = resolve; }))
      .mockResolvedValueOnce(page([application(30, { environment: 'production' })], 1));
    render(<MemoryRouter><ApplicationsPage /></MemoryRouter>);

    await waitFor(() => expect(listApplications).toHaveBeenCalledTimes(1));
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'production');
    expect(await screen.findByRole('row', { name: /^Application 30\b/ })).toBeInTheDocument();
    resolveUnfiltered?.(page([application(1)], 20));

    expect(await screen.findByText('1 Services')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /^Application 30\b/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /^Application 1\b/ })).not.toBeInTheDocument();
  });

  // WHY: deleting the only record on a later page should never strand the user there.
  it('moves to the previous page after deleting the last page item', async () => {
    const user = userEvent.setup();
    vi.mocked(listApplications)
      .mockResolvedValueOnce(page(Array.from({ length: 10 }, (_, i) => application(i + 1)), 21))
      .mockResolvedValueOnce(page(Array.from({ length: 10 }, (_, i) => application(i + 11)), 21, 10, 10))
      .mockResolvedValueOnce(page([application(21)], 21, 10, 20))
      .mockResolvedValueOnce(page([], 20, 10, 20))
      .mockResolvedValueOnce(page(Array.from({ length: 10 }, (_, i) => application(i + 11)), 20, 10, 10));
    render(<MemoryRouter><ApplicationsPage /></MemoryRouter>);

    await screen.findByRole('row', { name: /^Application 1\b/ });
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByRole('row', { name: /^Application 11\b/ });
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByRole('row', { name: /^Application 21\b/ });
    await user.click(screen.getByRole('button', { name: 'Delete Application 21' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete Application 21' }));

    await waitFor(() => expect(listApplications).toHaveBeenLastCalledWith({ limit: 10, offset: 10 }));
    expect(await screen.findByText('Showing 11–20 of 20')).toBeInTheDocument();
  });

  // WHY: local validation avoids preventable create requests and mirrors API constraints.
  it('trims and validates required names and prevents duplicate submits while pending', async () => {
    const user = userEvent.setup();
    let resolveCreate: ((value: Application) => void) | undefined;
    vi.mocked(createApplication).mockImplementation(
      () => new Promise(resolve => { resolveCreate = resolve; }),
    );
    renderApplications(page([], 0));
    await user.click(await screen.findByRole('button', { name: 'Create application' }));
    await user.click(screen.getByRole('button', { name: 'Save application' }));

    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), '  New App  ');
    await user.click(screen.getByRole('button', { name: 'Save application' }));

    expect(createApplication).toHaveBeenCalledTimes(1);
    expect(createApplication).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New App' }),
    );
    const savingButton = screen.getByRole('button', { name: 'Saving…' });
    expect(savingButton).toBeDisabled();
    await user.click(savingButton);
    expect(createApplication).toHaveBeenCalledTimes(1);
    resolveCreate?.(application(2, { name: 'New App' }));
    expect(await screen.findByText('Application New App created.')).toBeInTheDocument();
  });

  // WHY: conflict responses should identify the duplicate field without losing form state.
  it('places a 409 conflict beside the name field', async () => {
    const user = userEvent.setup();
    vi.mocked(createApplication).mockRejectedValue(
      new ApiError('application name already exists', 409, 'http', {
        name: 'application name already exists',
      }),
    );
    renderApplications(page([], 0));
    await user.click(await screen.findByRole('button', { name: 'Create application' }));
    await user.type(screen.getByLabelText('Name'), 'Duplicate');
    await user.click(screen.getByRole('button', { name: 'Save application' }));

    expect(await screen.findByText('application name already exists')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-describedby', 'name-error');
  });

  // WHY: backend validation locations must be announced against their matching inputs.
  it('maps 422 response details to the corresponding form fields', async () => {
    const user = userEvent.setup();
    vi.mocked(createApplication).mockRejectedValue(
      new ApiError('Please correct the highlighted fields.', 422, 'http', {
        environment: 'Invalid environment value',
      }),
    );
    renderApplications(page([], 0));
    await user.click(await screen.findByRole('button', { name: 'Create application' }));
    await user.type(screen.getByLabelText('Name'), 'Valid name');
    await user.click(screen.getByRole('button', { name: 'Save application' }));

    expect(await screen.findByText('Invalid environment value')).toBeInTheDocument();
    expect(screen.getByLabelText('Environment')).toHaveAttribute(
      'aria-describedby',
      'environment-error',
    );
  });

  // WHY: local limits must match the backend after name whitespace normalization.
  it('rejects names over 100 trimmed characters and descriptions over 500 characters', async () => {
    const user = userEvent.setup();
    renderApplications(page([], 0));
    await user.click(await screen.findByRole('button', { name: 'Create application' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ` ${'N'.repeat(101)} ` } });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'D'.repeat(501) },
    });
    await user.click(screen.getByRole('button', { name: 'Save application' }));

    expect(await screen.findByText('Name must be 100 characters or fewer.')).toBeInTheDocument();
    expect(screen.getByText('Description must be 500 characters or fewer.')).toBeInTheDocument();
    expect(createApplication).not.toHaveBeenCalled();
  });

  // WHY: PATCH must preserve the server's omitted-field semantics and avoid no-op requests.
  it('sends only changed edit fields and skips unchanged submissions', async () => {
    const user = userEvent.setup();
    vi.mocked(listApplications)
      .mockResolvedValueOnce(page([application(1)]))
      .mockResolvedValueOnce(page([application(1, { name: 'Renamed' })]));
    renderApplications();
    await screen.findByRole('row', { name: /^Application 1\b/ });
    await user.click(screen.getByRole('button', { name: 'Edit Application 1' }));
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Renamed');
    await user.click(screen.getByRole('button', { name: 'Save application' }));

    await waitFor(() => expect(updateApplication).toHaveBeenCalledWith('app-1', { name: 'Renamed' }));
    await user.click(screen.getByRole('button', { name: 'Edit Renamed' }));
    await user.click(screen.getByRole('button', { name: 'Save application' }));

    expect(updateApplication).toHaveBeenCalledTimes(1);
  });

  // WHY: null and empty descriptions render identically and must not trigger a no-op PATCH.
  it('does not PATCH an unchanged application with a null description', async () => {
    const user = userEvent.setup();
    renderApplications(page([application(1, { description: null })]));
    await screen.findByRole('row', { name: /^Application 1\b/ });
    await user.click(screen.getByRole('button', { name: 'Edit Application 1' }));
    await user.click(screen.getByRole('button', { name: 'Save application' }));

    expect(updateApplication).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // WHY: removal requires deliberate confirmation and a keyboard-operable dialog.
  it('traps focus, closes on Escape, and does not delete when cancelled', async () => {
    const user = userEvent.setup();
    renderApplications();
    await screen.findByRole('row', { name: /^Application 1\b/ });
    await user.click(screen.getByRole('button', { name: 'Delete Application 1' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete application?' });

    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(within(dialog).getByText(/deployments and logs will also be deleted/i)).toBeInTheDocument();
    await user.tab();
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: 'Confirm delete Application 1' }),
    );
    await user.tab();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteApplication).not.toHaveBeenCalled();
  });

  // WHY: deletion is executed only by the explicit confirmation and a missing record is already gone.
  it('deletes only after confirmation and treats a 404 response as successful removal', async () => {
    const user = userEvent.setup();
    vi.mocked(deleteApplication).mockRejectedValue(
      new ApiError('application not found', 404, 'http'),
    );
    renderApplications();
    await screen.findByRole('row', { name: /^Application 1\b/ });
    await user.click(screen.getByRole('button', { name: 'Delete Application 1' }));

    expect(deleteApplication).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm delete Application 1' }));
    expect(deleteApplication).toHaveBeenCalledWith('app-1');
    expect(await screen.findByText(/already removed/i)).toBeInTheDocument();
  });
});

// WHY: complete create and delete paths protect the list, confirmation, and announcement contracts.
describe('application create and delete outcomes', () => {
  const CREATED_NAME = 'Created through the form';
  const CREATED_DESCRIPTION = 'A newly registered application';
  const CREATED_ENVIRONMENT: Application['environment'] = 'staging';
  const CREATED_STATUS: Application['status'] = 'degraded';
  const TARGET_APPLICATION = application(77, { name: 'Lifecycle target' });

  // WHY: each lifecycle scenario starts with clean, successful API mocks.
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listApplications).mockResolvedValue(page([application(1)]));
    vi.mocked(getSummary).mockResolvedValue(summary);
    vi.mocked(createApplication).mockResolvedValue(application(2));
    vi.mocked(updateApplication).mockResolvedValue(application(1));
    vi.mocked(deleteApplication).mockResolvedValue(undefined);
  });

  // WHY: creation must refresh visible server data and announce success accessibly.
  it('creates an application, refetches the list, and announces the result', async () => {
    const user = userEvent.setup();
    const createdApplication = application(88, {
      name: CREATED_NAME,
      description: CREATED_DESCRIPTION,
      environment: CREATED_ENVIRONMENT,
      status: CREATED_STATUS,
    });
    vi.mocked(listApplications)
      .mockResolvedValueOnce(page([], 0))
      .mockResolvedValueOnce(page([createdApplication]));
    vi.mocked(createApplication).mockResolvedValue(createdApplication);
    render(<MemoryRouter><ApplicationsPage /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Add application' }));
    await user.type(screen.getByLabelText('Name'), CREATED_NAME);
    await user.type(screen.getByLabelText('Description'), CREATED_DESCRIPTION);
    await user.selectOptions(screen.getByLabelText('Environment'), CREATED_ENVIRONMENT);
    await user.selectOptions(screen.getByLabelText('Status'), CREATED_STATUS);
    await user.click(screen.getByRole('button', { name: 'Save application' }));

    expect(await screen.findByRole('row', { name: new RegExp(`^${CREATED_NAME}\\b`) }))
      .toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(listApplications).toHaveBeenCalledTimes(2);
    expect(createApplication).toHaveBeenCalledTimes(1);
    expect(createApplication).toHaveBeenCalledWith({
      name: CREATED_NAME,
      description: CREATED_DESCRIPTION,
      environment: CREATED_ENVIRONMENT,
      status: CREATED_STATUS,
    });
    expect(await screen.findByText(`Application ${CREATED_NAME} created.`))
      .toHaveAttribute('aria-live', 'polite');
  });

  // WHY: cancelling a destructive prompt must preserve the record and issue no delete request.
  it('keeps the application when delete confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderApplications(page([TARGET_APPLICATION]));

    const row = await screen.findByRole('row', { name: /^Lifecycle target\b/ });
    await user.click(screen.getByRole('button', { name: 'Delete Lifecycle target' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Delete application?' }))
      .getByRole('button', { name: 'Cancel' }));

    expect(deleteApplication).not.toHaveBeenCalled();
    expect(screen.getByRole('row', { name: /^Lifecycle target\b/ })).toBe(row);
  });

  // WHY: accepting confirmation must make one delete request and remove the refreshed row.
  it('deletes the application after confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(listApplications)
      .mockResolvedValueOnce(page([TARGET_APPLICATION]))
      .mockResolvedValueOnce(page([], 0));
    render(<MemoryRouter><ApplicationsPage /></MemoryRouter>);

    await screen.findByRole('row', { name: /^Lifecycle target\b/ });
    await user.click(screen.getByRole('button', { name: 'Delete Lifecycle target' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete Lifecycle target' }));

    expect(deleteApplication).toHaveBeenCalledTimes(1);
    expect(deleteApplication).toHaveBeenCalledWith(TARGET_APPLICATION.id);
    expect(await screen.findByText('No applications yet')).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /^Lifecycle target\b/ })).not.toBeInTheDocument();
  });
});
