import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  createApplication,
  deleteApplication,
  listApplications,
  updateApplication,
} from '../api/applications';
import { ApiError } from '../api/client';
import {
  APPLICATION_STATUSES,
  ENVIRONMENTS,
  type Application,
  type ApplicationCreate,
  type ApplicationStatus,
  type ApplicationUpdate,
  type Environment,
} from '../api/types';

const PAGE_SIZES = [10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];
const FIELD_NAMES = ['name', 'description', 'environment', 'status'] as const;

type ApplicationField = (typeof FIELD_NAMES)[number];
type FormValues = {
  name: string;
  description: string;
  environment: Environment;
  status: ApplicationStatus;
};
type FormErrors = Partial<Record<ApplicationField, string>>;

// WHY: server field paths are mapped only to labels this form actually renders.
function isApplicationField(field: string): field is ApplicationField {
  return FIELD_NAMES.some(candidate => candidate === field);
}

// WHY: browser-provided select values are checked before entering the enum-typed form state.
function isEnvironment(value: string): value is Environment {
  return ENVIRONMENTS.some(candidate => candidate === value);
}

// WHY: browser-provided select values are checked before entering the enum-typed form state.
function isApplicationStatus(value: string): value is ApplicationStatus {
  return APPLICATION_STATUSES.some(candidate => candidate === value);
}

interface ApplicationFormProps {
  initialApplication?: Application;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: FormValues) => Promise<void>;
}

// WHY: create and edit share one validated form so both workflows follow the same API rules.
function ApplicationForm({
  initialApplication,
  submitting,
  onCancel,
  onSubmit,
}: ApplicationFormProps) {
  const [values, setValues] = useState<FormValues>({
    name: initialApplication?.name ?? '',
    description: initialApplication?.description ?? '',
    environment: initialApplication?.environment ?? 'development',
    status: initialApplication?.status ?? 'unknown',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const editing = initialApplication !== undefined;

  // WHY: changing one input clears only its stale server or client validation message.
  const updateValue = <K extends ApplicationField>(field: K, value: FormValues[K]) => {
    setValues(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  // WHY: matching server limits locally prevents requests that are guaranteed to fail.
  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};
    const name = values.name.trim();
    if (!name) nextErrors.name = 'Name is required.';
    else if (name.length > 100) nextErrors.name = 'Name must be 100 characters or fewer.';
    if (values.description.length > 500) {
      nextErrors.description = 'Description must be 500 characters or fewer.';
    }
    return nextErrors;
  };

  // WHY: form submission is the single point for local validation and readable API errors.
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const validationErrors = validate();
    setErrors(validationErrors);
    setFormError(null);
    if (Object.keys(validationErrors).length > 0) return;

    submittingRef.current = true;
    try {
      await onSubmit({ ...values, name: values.name.trim() });
    } finally {
      submittingRef.current = false;
    }
  };

  // WHY: API field errors are associated only with known inputs; unknown paths stay form-level.
  const showSubmissionError = (error: unknown) => {
    if (!(error instanceof ApiError)) {
      setFormError('Unable to save the application. Please try again.');
      return;
    }

    const mapped: FormErrors = {};
    for (const [field, message] of Object.entries(error.fieldErrors)) {
      if (isApplicationField(field)) mapped[field] = message;
    }
    if (error.status === 409 && !mapped.name) {
      mapped.name = 'application name already exists';
    }
    setErrors(mapped);
    setFormError(
      Object.keys(mapped).length > 0
        ? null
        : error.status === 422
          ? 'Please correct the highlighted fields.'
          : error.message,
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="application-form-title"
    >
      <form
        className="w-full max-w-xl space-y-space-md rounded-xl border border-surface-container-high bg-surface-container-lowest p-space-lg shadow-2xl"
        onSubmit={event => {
          void handleSubmit(event).catch(showSubmissionError);
        }}
        noValidate
      >
        <div>
          <h2
            id="application-form-title"
            className="font-headline-md text-headline-md text-on-surface"
          >
            {editing ? 'Edit application' : 'Create application'}
          </h2>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Application records are stored by the CloudOps API.
          </p>
        </div>

        <div>
          <label htmlFor="application-name" className="mb-1 block font-label-sm text-label-sm">
            Name
          </label>
          <input
            id="application-name"
            value={values.name}
            aria-required="true"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
            onChange={event => updateValue('name', event.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface px-space-sm py-space-xs focus-visible:outline-2 focus-visible:outline-primary"
          />
          {errors.name && <p id="name-error" className="mt-1 text-sm text-error">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="application-description" className="mb-1 block font-label-sm text-label-sm">
            Description
          </label>
          <textarea
            id="application-description"
            value={values.description}
            maxLength={500}
            rows={3}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'description-error' : undefined}
            onChange={event => updateValue('description', event.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface px-space-sm py-space-xs focus-visible:outline-2 focus-visible:outline-primary"
          />
          {errors.description && (
            <p id="description-error" className="mt-1 text-sm text-error">
              {errors.description}
            </p>
          )}
        </div>

        <div className="grid gap-space-md sm:grid-cols-2">
          <div>
            <label htmlFor="application-environment" className="mb-1 block font-label-sm text-label-sm">
              Environment
            </label>
            <select
              id="application-environment"
              value={values.environment}
              aria-invalid={Boolean(errors.environment)}
              aria-describedby={errors.environment ? 'environment-error' : undefined}
              onChange={event => {
                if (isEnvironment(event.target.value)) {
                  updateValue('environment', event.target.value);
                }
              }}
              className="w-full rounded-lg border border-outline-variant bg-surface px-space-sm py-space-xs focus-visible:outline-2 focus-visible:outline-primary"
            >
              {ENVIRONMENTS.map(environment => (
                <option key={environment} value={environment}>{environment}</option>
              ))}
            </select>
            {errors.environment && (
              <p id="environment-error" className="mt-1 text-sm text-error">
                {errors.environment}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="application-status" className="mb-1 block font-label-sm text-label-sm">
              Status
            </label>
            <select
              id="application-status"
              value={values.status}
              aria-invalid={Boolean(errors.status)}
              aria-describedby={errors.status ? 'status-error' : undefined}
              onChange={event => {
                if (isApplicationStatus(event.target.value)) {
                  updateValue('status', event.target.value);
                }
              }}
              className="w-full rounded-lg border border-outline-variant bg-surface px-space-sm py-space-xs focus-visible:outline-2 focus-visible:outline-primary"
            >
              {APPLICATION_STATUSES.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            {errors.status && <p id="status-error" className="mt-1 text-sm text-error">{errors.status}</p>}
          </div>
        </div>

        {formError && <p role="alert" className="font-body-sm text-body-sm text-error">{formError}</p>}

        <div className="flex justify-end gap-space-sm border-t border-surface-container-high pt-space-md">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg px-space-md py-space-xs text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary-container px-space-md py-space-xs font-semibold text-on-primary-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save application'}
          </button>
        </div>
      </form>
    </div>
  );
}

// WHY: this page replaces only its former fixture list with the real Applications API.
export const ApplicationsPage: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [formApplication, setFormApplication] = useState<Application | null | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const deleteCancelButton = useRef<HTMLButtonElement>(null);

  // WHY: monotonic request IDs prevent stale page responses from overwriting newer navigation.
  const loadApplications = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setListError(null);
    try {
      const result = await listApplications({ limit: pageSize, offset });
      if (requestId !== requestSequence.current) return;
      const lastOffset = result.total === 0
        ? 0
        : Math.floor((result.total - 1) / pageSize) * pageSize;
      if (offset > lastOffset) {
        setOffset(lastOffset);
        return;
      }
      setApplications(result.items);
      setTotal(result.total);
    } catch (error: unknown) {
      if (requestId !== requestSequence.current) return;
      setListError(
        error instanceof ApiError
          ? error.message
          : 'Unable to load applications. Please try again.',
      );
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [offset, pageSize]);

  // WHY: list data must refresh whenever its server-side page changes.
  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  // WHY: keyboard users should land inside the destructive confirmation before acting.
  useEffect(() => {
    if (!deleteTarget) return;
    deleteCancelButton.current?.focus();
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) {
        setDeleteTarget(null);
        setDeleteError(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = document.querySelector<HTMLElement>('[data-delete-dialog="true"]');
      const focusable = dialog?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleDialogKeyDown);
    return () => document.removeEventListener('keydown', handleDialogKeyDown);
  }, [deleteTarget, deleting]);

  // WHY: both create and edit resolve through one save path and refresh the authoritative list.
  const saveApplication = async (values: FormValues) => {
    setSubmitting(true);
    try {
      if (formApplication) {
        const changes: ApplicationUpdate = {};
        if (values.name !== formApplication.name) changes.name = values.name;
        if (values.description !== (formApplication.description ?? '')) {
          changes.description = values.description === '' ? null : values.description;
        }
        if (values.environment !== formApplication.environment) {
          changes.environment = values.environment;
        }
        if (values.status !== formApplication.status) changes.status = values.status;
        if (Object.keys(changes).length === 0) {
          setFormApplication(undefined);
          return;
        }
        await updateApplication(formApplication.id, changes);
        setAnnouncement(`Application ${values.name} updated.`);
      } else {
        const body: ApplicationCreate = {
          name: values.name,
          description: values.description === '' ? null : values.description,
          environment: values.environment,
          status: values.status,
        };
        await createApplication(body);
        setAnnouncement(`Application ${values.name} created.`);
      }
      setFormApplication(undefined);
      await loadApplications();
    } finally {
      setSubmitting(false);
    }
  };

  // WHY: a confirmed delete treats a 404 as an already-completed removal, then revalidates the page.
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const target = deleteTarget;
    try {
      await deleteApplication(target.id);
      setAnnouncement(`Application ${target.name} deleted.`);
      setDeleteTarget(null);
      await loadApplications();
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) {
        setAnnouncement(`Application ${target.name} was already removed.`);
        setDeleteTarget(null);
        await loadApplications();
      } else {
        setDeleteError(
          error instanceof ApiError
            ? error.message
            : 'Unable to delete the application. Please try again.',
        );
      }
    } finally {
      setDeleting(false);
    }
  };

  // WHY: undefined means closed while null explicitly selects the new-application form.
  const startCreate = () => setFormApplication(null);
  const firstItem = total === 0 ? 0 : offset + 1;
  const lastItem = Math.min(total, offset + applications.length);

  return (
    <section className="flex w-full flex-col pb-space-2xl pt-4">
      <div className="mb-space-lg flex flex-col gap-space-md sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            Applications
          </h1>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Manage application records from the CloudOps API.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="self-start rounded-lg bg-primary-container px-space-md py-space-xs font-semibold text-on-primary-container focus-visible:outline-2 focus-visible:outline-primary"
        >
          Add application
        </button>
      </div>

      <p className="sr-only" aria-live="polite">{announcement}</p>

      {loading && (
        <div className="rounded-xl border border-surface-container-high bg-surface-container-lowest p-space-lg font-body-md text-body-md">
          Loading applications…
        </div>
      )}

      {!loading && listError && (
        <div className="rounded-xl border border-error bg-surface-container-lowest p-space-lg">
          <p role="alert" className="font-body-md text-body-md">{listError}</p>
          <button
            type="button"
            onClick={() => void loadApplications()}
            className="mt-space-sm rounded-lg bg-surface-container-high px-space-md py-space-xs focus-visible:outline-2 focus-visible:outline-primary"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !listError && total === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-surface-container-high/40 bg-surface-container-lowest p-space-2xl text-center shadow-sm">
          <span className="material-symbols-outlined mb-space-sm text-[32px] text-primary" aria-hidden="true">
            apps
          </span>
          <h2 className="font-headline-md text-headline-md">No applications yet</h2>
          <p className="mt-space-xs max-w-md font-body-sm text-body-sm text-on-surface-variant">
            Create an application to start managing its environment and operational status.
          </p>
          <button
            type="button"
            onClick={startCreate}
            className="mt-space-md rounded-lg bg-primary-container px-space-md py-space-xs font-semibold text-on-primary-container focus-visible:outline-2 focus-visible:outline-primary"
          >
            Create application
          </button>
        </div>
      )}

      {!loading && !listError && total > 0 && (
        <div className="overflow-hidden rounded-xl border border-surface-container-high/40 bg-surface-container-lowest shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Applications retrieved from the API</caption>
              <thead className="bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant">
                <tr>
                  <th scope="col" className="px-space-md py-space-sm font-semibold">Name</th>
                  <th scope="col" className="px-space-md py-space-sm font-semibold">Description</th>
                  <th scope="col" className="px-space-md py-space-sm font-semibold">Environment</th>
                  <th scope="col" className="px-space-md py-space-sm font-semibold">Status</th>
                  <th scope="col" className="px-space-md py-space-sm text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(application => (
                  <tr key={application.id} className="border-t border-surface-container-high/60">
                    <th scope="row" className="px-space-md py-space-sm font-body-md text-body-md font-semibold text-on-surface">
                      {application.name}
                    </th>
                    <td className="max-w-sm px-space-md py-space-sm font-body-sm text-body-sm text-on-surface-variant">
                      {application.description || '—'}
                    </td>
                    <td className="px-space-md py-space-sm font-body-sm text-body-sm capitalize">
                      {application.environment}
                    </td>
                    <td className="px-space-md py-space-sm font-body-sm text-body-sm capitalize">
                      {application.status}
                    </td>
                    <td className="px-space-md py-space-sm">
                      <div className="flex justify-end gap-space-xs">
                        <button
                          type="button"
                          aria-label={`Edit ${application.name}`}
                          onClick={() => setFormApplication(application)}
                          className="rounded px-space-sm py-space-xs text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${application.name}`}
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(application);
                          }}
                          className="rounded px-space-sm py-space-xs text-error hover:bg-error-container focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-space-md border-t border-surface-container-high/60 p-space-md sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-space-sm font-body-sm text-body-sm text-on-surface-variant">
              <span aria-live="polite">Showing {firstItem}–{lastItem} of {total}</span>
              <label htmlFor="applications-page-size">Rows per page</label>
              <select
                id="applications-page-size"
                aria-label="Applications per page"
                value={pageSize}
                onChange={event => {
                  setPageSize(Number(event.target.value));
                  setOffset(0);
                }}
                className="rounded border border-outline-variant bg-surface px-space-xs py-1 focus-visible:outline-2 focus-visible:outline-primary"
              >
                {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-space-xs">
              <button
                type="button"
                aria-label="Previous page"
                disabled={offset === 0}
                onClick={() => setOffset(current => Math.max(0, current - pageSize))}
                className="rounded bg-surface-container-low px-space-sm py-space-xs hover:bg-surface-container disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary"
              >
                Previous
              </button>
              <button
                type="button"
                aria-label="Next page"
                disabled={offset + applications.length >= total}
                onClick={() => setOffset(current => current + pageSize)}
                className="rounded bg-surface-container-low px-space-sm py-space-xs hover:bg-surface-container disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {formApplication !== undefined && (
        <ApplicationForm
          key={formApplication?.id ?? 'new'}
          initialApplication={formApplication ?? undefined}
          submitting={submitting}
          onCancel={() => setFormApplication(undefined)}
          onSubmit={saveApplication}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            data-delete-dialog="true"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-application-title"
            className="w-full max-w-md rounded-xl border border-surface-container-high bg-surface-container-lowest p-space-lg shadow-2xl"
          >
            <h2 id="delete-application-title" className="font-headline-md text-headline-md">
              Delete application?
            </h2>
            <p className="mt-space-sm font-body-sm text-body-sm text-on-surface-variant">
              Delete <strong>{deleteTarget.name}</strong>? Its deployments and logs will also be deleted.
            </p>
            {deleteError && <p role="alert" className="mt-space-sm text-sm text-error">{deleteError}</p>}
            <div className="mt-space-lg flex justify-end gap-space-sm">
              <button
                ref={deleteCancelButton}
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="rounded-lg px-space-md py-space-xs hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="rounded-lg bg-error px-space-md py-space-xs font-semibold text-on-error focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : `Confirm delete ${deleteTarget.name}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
