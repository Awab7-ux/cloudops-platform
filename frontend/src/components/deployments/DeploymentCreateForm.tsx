import { useRef, useState } from 'react';

import { ApiError } from '../../api/client';
import { createDeployment } from '../../api/deployments';
import type { DeploymentCreate } from '../../api/types';

interface DeploymentCreateFormProps {
  applicationId: string;
  onCancel: () => void;
  onCreated: () => void;
}

type CreateField = 'version' | 'commit_sha';
type CreateErrors = Partial<Record<CreateField, string>>;

// WHY: server field paths are associated only with inputs rendered by this form.
function isCreateField(field: string): field is CreateField {
  return field === 'version' || field === 'commit_sha';
}

// WHY: the form validates schema limits locally and maps API errors without losing input.
export function DeploymentCreateForm({
  applicationId,
  onCancel,
  onCreated,
}: DeploymentCreateFormProps) {
  const [version, setVersion] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const [errors, setErrors] = useState<CreateErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // WHY: validation mirrors DeploymentCreate constraints and prevents malformed requests.
  const validate = (): CreateErrors => {
    const next: CreateErrors = {};
    const normalizedVersion = version.trim();
    const normalizedSha = commitSha.trim();
    if (!normalizedVersion) next.version = 'Version is required.';
    else if (normalizedVersion.length > 64) next.version = 'Version must be 64 characters or fewer.';
    if (normalizedSha && (normalizedSha.length < 7 || normalizedSha.length > 40 || !/^[0-9a-f]+$/i.test(normalizedSha))) {
      next.commit_sha = 'Commit SHA must be 7–40 hexadecimal characters.';
    }
    return next;
  };

  // WHY: submission is guarded against repeat clicks and sends only the schema's supported fields.
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const validation = validate();
    setErrors(validation);
    setFormError(null);
    if (Object.keys(validation).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);
    const payload: DeploymentCreate = { version: version.trim() };
    if (commitSha.trim()) payload.commit_sha = commitSha.trim().toLowerCase();
    try {
      await createDeployment(applicationId, payload);
      onCreated();
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        const mapped: CreateErrors = {};
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (isCreateField(field)) mapped[field] = message;
        }
        setErrors(mapped);
        setFormError(error.status === 404
          ? 'The selected application was deleted. Choose another application.'
          : Object.keys(mapped).length > 0
            ? null
            : error.message);
      } else {
        setFormError('Unable to create deployment. Please try again.');
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="deployment-create-title"
        onSubmit={event => void submit(event)}
        noValidate
        className="w-full max-w-xl space-y-4 rounded-xl border border-surface-container-high bg-surface-container-lowest p-6 shadow-2xl"
      >
        <h2 id="deployment-create-title" className="font-headline-md text-headline-md">Create deployment</h2>
        <div>
          <label htmlFor="deployment-version" className="mb-1 block">Version</label>
          <input
            id="deployment-version"
            value={version}
            maxLength={64}
            required
            aria-invalid={Boolean(errors.version)}
            aria-describedby={errors.version ? 'deployment-version-error' : undefined}
            onChange={event => setVersion(event.target.value)}
            className="w-full rounded-lg border border-outline-variant px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary"
          />
          {errors.version && <p id="deployment-version-error" className="text-error">{errors.version}</p>}
        </div>
        <div>
          <label htmlFor="deployment-commit-sha" className="mb-1 block">Commit SHA</label>
          <input
            id="deployment-commit-sha"
            value={commitSha}
            maxLength={40}
            aria-invalid={Boolean(errors.commit_sha)}
            aria-describedby={errors.commit_sha ? 'deployment-commit-sha-error' : undefined}
            onChange={event => setCommitSha(event.target.value)}
            className="w-full rounded-lg border border-outline-variant px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary"
          />
          {errors.commit_sha && <p id="deployment-commit-sha-error" className="text-error">{errors.commit_sha}</p>}
        </div>
        {formError && <p role="alert">{formError}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-outline-variant px-3 py-2">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded bg-primary px-3 py-2 text-on-primary disabled:opacity-60">
            {submitting ? 'Saving…' : 'Save deployment'}
          </button>
        </div>
      </form>
    </div>
  );
}
