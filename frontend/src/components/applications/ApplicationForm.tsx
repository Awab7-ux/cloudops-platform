import { useRef, useState } from 'react';

import { ApiError } from '../../api/client';
import {
  createApplication,
  updateApplication,
} from '../../api/applications';
import {
  APPLICATION_STATUSES,
  ENVIRONMENTS,
  type Application,
  type ApplicationCreate,
  type ApplicationStatus,
  type ApplicationUpdate,
  type Environment,
} from '../../api/types';

type Field = 'name' | 'description' | 'environment' | 'status';
type Values = {
  name: string;
  description: string;
  environment: Environment;
  status: ApplicationStatus;
};
type Errors = Partial<Record<Field, string>>;

interface ApplicationFormProps {
  initialApplication?: Application;
  onCancel: () => void;
  onSaved: (name: string, created: boolean) => void;
}

export function ApplicationForm({ initialApplication, onCancel, onSaved }: ApplicationFormProps) {
  const [values, setValues] = useState<Values>({
    name: initialApplication?.name ?? '',
    description: initialApplication?.description ?? '',
    environment: initialApplication?.environment ?? 'development',
    status: initialApplication?.status ?? 'unknown',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const editing = initialApplication !== undefined;

  const setField = <K extends Field>(field: K, value: Values[K]) => {
    setValues(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
    setFormError('');
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const name = values.name.trim();
    const nextErrors: Errors = {};
    if (!name) nextErrors.name = 'Name is required.';
    else if (name.length > 100) nextErrors.name = 'Name must be 100 characters or fewer.';
    if (values.description.length > 500) {
      nextErrors.description = 'Description must be 500 characters or fewer.';
    }
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      if (initialApplication) {
        const changes: ApplicationUpdate = {};
        if (name !== initialApplication.name) changes.name = name;
        if (values.description !== (initialApplication.description ?? '')) {
          changes.description = values.description === '' ? null : values.description;
        }
        if (values.environment !== initialApplication.environment) {
          changes.environment = values.environment;
        }
        if (values.status !== initialApplication.status) changes.status = values.status;
        if (Object.keys(changes).length === 0) {
          onCancel();
          return;
        }
        await updateApplication(initialApplication.id, changes);
        onSaved(name, false);
      } else {
        const body: ApplicationCreate = {
          name,
          description: values.description === '' ? null : values.description,
          environment: values.environment,
          status: values.status,
        };
        await createApplication(body);
        onSaved(name, true);
      }
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        const mapped: Errors = {};
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (field === 'name' || field === 'description' || field === 'environment' || field === 'status') {
            mapped[field] = message;
          }
        }
        if (error.status === 409 && !mapped.name) mapped.name = 'application name already exists';
        setErrors(mapped);
        setFormError(
          Object.keys(mapped).length > 0
            ? ''
            : error.status === 422 ? 'Please correct the highlighted fields.' : error.message,
        );
      } else {
        setFormError('Unable to save the application. Please try again.');
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-xs z-50 flex items-center justify-center p-space-md animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="application-form-title"
    >
      <form
        onSubmit={event => void submit(event)}
        noValidate
        className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-space-lg shadow-2xl border border-surface-container-high space-y-space-md"
      >
        <div className="flex items-center justify-between">
          <h2 id="application-form-title" className="font-headline-md text-headline-md text-on-surface">
            {editing ? 'Edit application' : 'Create application'}
          </h2>
          <button type="button" onClick={onCancel} disabled={submitting} className="text-on-surface-variant hover:text-on-surface">
            Cancel
          </button>
        </div>
        <div>
          <label htmlFor="application-name" className="block text-on-surface font-medium mb-1">Name</label>
          <input
            id="application-name"
            value={values.name}
            maxLength={100}
            aria-required="true"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
            onChange={event => setField('name', event.target.value)}
            className="w-full bg-surface-container-low text-on-surface px-space-sm py-1.5 rounded-lg focus:outline-none focus:bg-surface-container-lowest border border-surface-container-high"
          />
          {errors.name && <p id="name-error" className="text-error">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="application-description" className="block text-on-surface font-medium mb-1">Description</label>
          <textarea
            id="application-description"
            value={values.description}
            maxLength={500}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'description-error' : undefined}
            onChange={event => setField('description', event.target.value)}
            className="w-full bg-surface-container-low text-on-surface px-space-sm py-1.5 rounded-lg border border-surface-container-high"
          />
          {errors.description && <p id="description-error" className="text-error">{errors.description}</p>}
        </div>
        <div className="grid grid-cols-2 gap-space-sm">
          <div>
            <label htmlFor="application-environment" className="block text-on-surface font-medium mb-1">Environment</label>
            <select
              id="application-environment"
              value={values.environment}
              aria-invalid={Boolean(errors.environment)}
              aria-describedby={errors.environment ? 'environment-error' : undefined}
              onChange={event => {
                if (ENVIRONMENTS.some(value => value === event.target.value)) {
                  setField('environment', event.target.value as Environment);
                }
              }}
              className="w-full bg-surface-container-low text-on-surface px-space-sm py-1.5 rounded-lg border border-surface-container-high"
            >
              {ENVIRONMENTS.map(environment => <option key={environment} value={environment}>{environment}</option>)}
            </select>
            {errors.environment && <p id="environment-error" className="text-error">{errors.environment}</p>}
          </div>
          <div>
            <label htmlFor="application-status" className="block text-on-surface font-medium mb-1">Status</label>
            <select
              id="application-status"
              value={values.status}
              aria-invalid={Boolean(errors.status)}
              aria-describedby={errors.status ? 'status-error' : undefined}
              onChange={event => {
                if (APPLICATION_STATUSES.some(value => value === event.target.value)) {
                  setField('status', event.target.value as ApplicationStatus);
                }
              }}
              className="w-full bg-surface-container-low text-on-surface px-space-sm py-1.5 rounded-lg border border-surface-container-high"
            >
              {APPLICATION_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            {errors.status && <p id="status-error" className="text-error">{errors.status}</p>}
          </div>
        </div>
        {formError && <p role="alert" className="text-error">{formError}</p>}
        <div className="pt-space-sm flex justify-end gap-space-sm">
          <button type="button" onClick={onCancel} disabled={submitting} className="px-space-md py-1.5 bg-surface-container text-on-surface rounded-lg cursor-pointer hover:bg-surface-container-high">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="px-space-md py-1.5 bg-primary text-on-primary rounded-lg font-medium shadow-sm hover:brightness-110 disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save application'}
          </button>
        </div>
      </form>
    </div>
  );
}
