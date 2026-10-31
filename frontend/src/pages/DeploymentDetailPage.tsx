import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { getApplication } from '../api/applications';
import { getDeployment, updateDeploymentStatus } from '../api/deployments';
import type { Application, Deployment, DeploymentStatus } from '../api/types';
import { DeploymentStatusActions } from '../components/deployments/DeploymentStatusActions';

function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '-';
}

export const DeploymentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [detailState, setDetailState] = useState<'loading' | 'success' | 'error' | 'not-found'>('loading');
  const [detailError, setDetailError] = useState('');
  const [detailMessage, setDetailMessage] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setDeployment(null);
    setApplication(null);
    setDetailState('loading');
    setDetailError('');
    void getDeployment(id ?? '')
      .then(record => {
        if (!active) return;
        setDeployment(record);
        setDetailState('success');
        void getApplication(record.application_id)
          .then(parent => {
            if (active) setApplication(parent);
          })
          .catch(() => {
            if (active) setApplication(null);
          });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setDeployment(null);
        if (error instanceof ApiError && error.status === 404) {
          setDetailState('not-found');
        } else {
          setDetailError(error instanceof Error ? error.message : 'Unable to load deployment.');
          setDetailState('error');
        }
      });
    return () => { active = false; };
  }, [id, refresh]);

  const transition = async (status: DeploymentStatus) => {
    if (!id) return;
    setDetailMessage('');
    try {
      const updated = await updateDeploymentStatus(id, status);
      setDeployment(updated);
      setDetailMessage('Deployment status updated.');
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 409) {
        setDetailMessage('Status changed elsewhere. Deployment details were refreshed.');
        setRefresh(value => value + 1);
      } else if (error instanceof ApiError && error.status === 404) {
        setDetailMessage('Deployment no longer exists.');
        setRefresh(value => value + 1);
      } else {
        setDetailMessage(error instanceof Error ? error.message : 'Unable to update deployment status.');
      }
    }
  };

  const backLink = deployment
    ? `/deployments?application=${encodeURIComponent(deployment.application_id)}`
    : '/deployments';
  return (
    <div className="flex flex-col w-full pb-16 space-y-6 pt-4">
      {/* Top Breadcrumbs & Quick Nav */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
          <Link to="/" className="hover:text-primary cursor-pointer transition-colors">
            Dashboard
          </Link>
          <span className="text-outline-variant">/</span>
          <Link to={backLink} aria-label="Back to deployments" className="hover:text-primary cursor-pointer transition-colors">
            Deployments
          </Link>
          <span className="text-outline-variant">/</span>
          <span className="font-label-sm text-label-sm text-primary px-2 py-0.5 rounded bg-surface-container-high font-bold">
            {id ?? '-'}
          </span>
        </div>
        {detailState === 'loading' && (
          <p role="status" className="rounded-lg bg-surface-container-lowest p-4">Loading deployment…</p>
        )}
        {detailState === 'not-found' && (
          <p role="alert" className="rounded-lg border border-error bg-surface-container-lowest p-4">Deployment not found.</p>
        )}
        {detailState === 'error' && (
          <div role="alert" className="rounded-lg border border-error bg-surface-container-lowest p-4">
            <p>{detailError}</p>
            <button type="button" onClick={() => setRefresh(value => value + 1)} className="mt-2 underline">Retry</button>
          </div>
        )}
        {detailMessage && <p role="status" aria-live="polite" className="rounded-lg bg-surface-container-lowest p-4">{detailMessage}</p>}

        {/* Quick External Resource Shortcuts */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/logs?deployment=${encodeURIComponent(id ?? '')}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container transition-colors font-body-sm text-body-sm border border-surface-container-high/40"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">terminal</span>
            <span>View Release Logs</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface shadow-sm font-body-sm text-body-sm border border-surface-container-high/40">
            <span className="material-symbols-outlined text-[16px] text-tertiary">commit</span>
            <span className="font-label-sm text-label-sm">{deployment?.commit_sha ?? 'Commit unavailable'}</span>
          </span>
          <button
            type="button"
            disabled
            title="Rollout re-evaluation is not available through the backend."
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant font-body-sm text-body-sm cursor-not-allowed opacity-60"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>Re-evaluate unavailable</span>
          </button>
        </div>
      </div>

      {detailState === 'success' && deployment && (
        <>
          <section className="rounded-xl bg-surface-container-lowest p-6 shadow-sm border border-surface-container-high/40">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Backend deployment record</p>
                <h1 className="mt-1 font-headline-lg text-headline-lg text-on-surface">Deployment {deployment.id}</h1>
                <div className="mt-2 flex flex-wrap gap-x-2 text-on-surface-variant">
                  <span>Application:</span>
                  <span>{application?.name ?? deployment.application_id}</span>
                  <span>Version:</span>
                  <span className="font-mono">{deployment.version}</span>
                </div>
              </div>
              <div className="flex flex-col items-start lg:items-end gap-3">
                <span className="rounded-full bg-surface-container-high px-3 py-1 font-label-sm text-label-sm font-semibold text-on-surface">
                  {deployment.status}
                </span>
                <DeploymentStatusActions status={deployment.status} onTransition={transition} />
              </div>
            </div>
            <p className="mt-4 rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant">
              Status transitions update this backend record. They do not trigger a Kubernetes rollout or rollback.
            </p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="rounded-xl bg-surface-container-lowest p-5 shadow-sm border border-surface-container-high/40">
              <h2 className="font-headline-sm text-headline-sm">Deployment details</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div><dt className="text-on-surface-variant">Commit SHA</dt><dd className="break-all font-mono">{deployment.commit_sha ?? 'Not available'}</dd></div>
                <div><dt className="text-on-surface-variant">Application environment</dt><dd>{application?.environment ?? 'Not available'}</dd></div>
                <div><dt className="text-on-surface-variant">Started</dt><dd>{formatTimestamp(deployment.started_at)}</dd></div>
                <div><dt className="text-on-surface-variant">Finished</dt><dd>{formatTimestamp(deployment.finished_at)}</dd></div>
                <div><dt className="text-on-surface-variant">Created</dt><dd>{formatTimestamp(deployment.created_at)}</dd></div>
              </dl>
            </div>

            <div className="rounded-xl bg-surface-container-lowest p-5 shadow-sm border border-surface-container-high/40">
              <h2 className="font-headline-sm text-headline-sm">Cluster rollout data</h2>
              <p className="mt-3 text-sm text-on-surface-variant">
                Canary progress, pod allocation, pipeline stages, and live resource metrics are not provided by the backend.
              </p>
            </div>

            <div className="rounded-xl bg-surface-container-lowest p-5 shadow-sm border border-surface-container-high/40">
              <h2 className="font-headline-sm text-headline-sm">Deployment logs</h2>
              <p className="mt-3 text-sm text-on-surface-variant">
                The logs API can show persisted records associated with this deployment.
              </p>
              <Link
                to={`/logs?deployment=${encodeURIComponent(deployment.id)}`}
                className="mt-4 inline-flex items-center gap-2 text-primary font-semibold hover:underline"
              >
                View deployment logs
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
