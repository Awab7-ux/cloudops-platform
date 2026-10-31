import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { listApplications } from '../api/applications';
import {
  listDeployments,
  updateDeploymentStatus,
} from '../api/deployments';
import type { Application, Deployment, DeploymentStatus } from '../api/types';
import { DeploymentCreateForm } from '../components/deployments/DeploymentCreateForm';
import { DeploymentStatusActions } from '../components/deployments/DeploymentStatusActions';

function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '-';
}

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt || !finishedAt) return '-';
  const elapsedSeconds = Math.max(0, Math.floor(
    (Date.parse(finishedAt) - Date.parse(startedAt)) / 1000,
  ));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export const DeploymentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedApplicationId = searchParams.get('application') ?? '';
  const [applications, setApplications] = useState<Application[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [offset, setOffset] = useState(0);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [listError, setListError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [applicationsRefresh, setApplicationsRefresh] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [envFilter, setEnvFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | DeploymentStatus>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingApplications(true);
    void listApplications({ limit: 200, offset: 0 })
      .then(result => {
        if (!active) return;
        setApplications(result.items);
        setListError('');
        const selected = searchParams.get('application');
        if (!selected && result.items[0]) {
          setSearchParams({ application: result.items[0].id }, { replace: true });
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setApplications([]);
        setListError(error instanceof Error ? error.message : 'Unable to load applications.');
      })
      .finally(() => {
        if (active) setLoadingApplications(false);
      });
    return () => { active = false; };
  }, [applicationsRefresh, setSearchParams]);

  const loadDeployments = useCallback(async () => {
    if (!selectedApplicationId) {
      setDeployments([]);
      setTotal(0);
      setLoadingDeployments(false);
      return;
    }
    setLoadingDeployments(true);
    setListError('');
    try {
      const result = await listDeployments(selectedApplicationId, {
        limit: pageSize,
        offset,
        ...(statusFilter === 'all' ? {} : { status: statusFilter }),
      });
      setDeployments(result.items);
      setTotal(result.total);
    } catch (error: unknown) {
      setDeployments([]);
      setTotal(0);
      setListError(error instanceof Error ? error.message : 'Unable to load deployments.');
    } finally {
      setLoadingDeployments(false);
    }
  }, [offset, pageSize, selectedApplicationId, statusFilter]);

  useEffect(() => {
    void loadDeployments();
  }, [loadDeployments, refresh]);

  const liveDeployments = useMemo(() => deployments.map(deployment => {
    const application = applications.find(item => item.id === deployment.application_id);
    const statusType = deployment.status === 'succeeded'
      ? 'success'
      : deployment.status === 'failed'
        ? 'failed'
        : deployment.status === 'rolled_back'
          ? 'rolled-back'
          : 'in-progress';
    return {
      deployment,
      id: deployment.id,
      version: deployment.version,
      app: application?.name ?? deployment.application_id,
      environment: application?.environment,
      commitSha: deployment.commit_sha,
      status: deployment.status,
      statusType,
    };
  }), [applications, deployments]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    showToast(`Copied ${id} to clipboard`);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredDeployments = useMemo(() => {
    return liveDeployments.filter(dep => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        dep.id.toLowerCase().includes(q) ||
        dep.app.toLowerCase().includes(q) ||
        (dep.commitSha?.toLowerCase().includes(q) ?? false);
      const matchEnv =
        envFilter === 'all' ||
        (envFilter === 'prod' && dep.environment === 'production') ||
        (envFilter === 'staging' && dep.environment === 'staging');
      const matchStatus = statusFilter === 'all' || dep.status === statusFilter;
      return matchSearch && matchEnv && matchStatus;
    });
  }, [liveDeployments, searchTerm, envFilter, statusFilter]);

  const transition = async (deploymentId: string, status: DeploymentStatus) => {
    setMessage('');
    try {
      const updated = await updateDeploymentStatus(deploymentId, status);
      setDeployments(current => current.map(deployment =>
        deployment.id === updated.id ? updated : deployment,
      ));
      setMessage('Deployment status updated.');
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 409) {
        setMessage('Status changed elsewhere. The deployment list was refreshed.');
        setRefresh(value => value + 1);
      } else {
        setMessage(error instanceof Error ? error.message : 'Unable to update deployment status.');
      }
    }
  };

  const handleExportCsv = () => {
    const csvContent =
      "Deployment ID,Application,Version,Commit SHA,Environment,Status,Created At,Started At,Finished At\n" +
      filteredDeployments
        .map(
          row => {
            const deployment = row.deployment;
            return `"${row.id}","${row.app}","${row.version}","${row.commitSha ?? ''}","${row.environment ?? ''}","${row.status}","${deployment.created_at}","${deployment.started_at ?? ''}","${deployment.finished_at ?? ''}"`;
          },
        )
        .join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudops-deployments-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported deployment audit log CSV");
  };

  return (
    <div className="flex flex-col w-full pb-16 pt-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-space-md rounded-xl bg-inverse-surface text-inverse-on-surface shadow-2xl flex items-center gap-2 font-body-sm text-body-sm border border-surface-container-high animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-primary-fixed text-[20px]">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Notice Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-space-md py-space-sm bg-surface-container-high rounded-lg text-on-surface mb-space-md gap-space-xs border border-surface-container-high/60">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-[18px] text-primary">verified_user</span>
          <span className="font-label-sm text-label-sm">
            This page manages deployment records through the backend API. It does not trigger Kubernetes rollouts.
          </span>
        </div>
        <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
          <span>Cluster provider and version are unavailable through the backend.</span>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-space-md mb-space-lg">
        <div className="flex flex-col gap-space-xxs min-w-0">
          <div className="flex items-center gap-space-sm flex-wrap">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Deployment History
            </h1>
            <span className="inline-flex items-center gap-space-xxs px-space-xs py-space-xxs bg-primary-fixed text-on-primary-fixed rounded font-label-sm text-label-sm font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
              {loadingApplications || loadingDeployments
                ? 'Loading…'
                : listError ? 'Unavailable' : `${total} Deployments`}
            </span>
            <span className="px-space-xs py-space-xxs bg-surface-container-high text-on-surface-variant rounded font-label-sm text-label-sm">
              Backend deployment records
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Deployment history for the selected application, loaded from the backend.
          </p>
        </div>

        {/* Action Button */}
        <div className="relative group flex items-center self-start xl:self-auto">
          <button
            type="button"
            disabled={!selectedApplicationId}
            aria-label="Create deployment"
            onClick={() => setCreateOpen(true)}
            className="ml-space-sm flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-primary text-on-primary font-body-sm text-body-sm shadow-sm transition-all hover:bg-primary-container disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Create deployment
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-space-sm p-space-md bg-surface-container-lowest rounded-xl shadow-sm mb-space-xl border border-surface-container-high/40">
        <div className="md:col-span-3 relative flex items-center">
          <span className="material-symbols-outlined absolute left-space-sm text-[18px] text-outline pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by Version, Commit SHA, or dep-ID..."
            className="w-full pl-9 pr-space-sm py-2 rounded bg-surface-container-low text-on-surface placeholder:text-outline font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest shadow-sm"
          />
        </div>

        <div className="md:col-span-2 relative flex items-center">
          <select
            aria-label="Application"
            value={selectedApplicationId}
            disabled={loadingApplications || applications.length === 0}
            onChange={event => {
              setOffset(0);
              setSearchParams({ application: event.target.value });
            }}
            className="w-full appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50"
          >
            {applications.length === 0 && <option value="">No applications available</option>}
            {applications.map(application => (
              <option key={application.id} value={application.id}>{application.name}</option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-2.5 text-[16px] text-outline pointer-events-none">
            expand_more
          </span>
        </div>

        <div className="md:col-span-2 relative flex items-center">
          <select
            value={envFilter}
            onChange={e => setEnvFilter(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">All Environments</option>
            <option value="prod">Production</option>
            <option value="staging">Staging</option>
          </select>
          <span className="material-symbols-outlined absolute right-2.5 text-[16px] text-outline pointer-events-none">
            expand_more
          </span>
        </div>

        <div className="md:col-span-2 relative flex items-center">
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value as 'all' | DeploymentStatus);
              setOffset(0);
            }}
            className="w-full appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="succeeded">Succeeded</option>
            <option value="running">Running</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="rolled_back">Rolled back</option>
          </select>
          <span className="material-symbols-outlined absolute right-2.5 text-[16px] text-outline pointer-events-none">
            expand_more
          </span>
        </div>

        <div className="md:col-span-2 relative flex items-center">
          <span className="material-symbols-outlined absolute left-space-sm text-[18px] text-outline pointer-events-none">
            calendar_today
          </span>
          <input
            type="text"
            readOnly
            value="All Dates"
            className="w-full pl-9 pr-space-sm py-2 rounded bg-surface-container-low text-on-surface font-label-md text-label-md cursor-pointer focus:outline-none"
          />
        </div>

        <div className="md:col-span-1 flex items-center">
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setEnvFilter('all');
              setStatusFilter('all');
            }}
            title="Reset Filters"
            className="w-full h-full py-2 flex items-center justify-center rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body-sm text-body-sm transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
          </button>
        </div>
      </div>
      {message && (
        <p role="status" aria-live="polite" className="mb-space-md rounded-lg bg-surface-container-lowest px-space-md py-space-sm text-on-surface">
          {message}
        </p>
      )}
      {listError && (
        <div role="alert" className="mb-space-md rounded-lg border border-error bg-surface-container-lowest px-space-md py-space-sm text-error">
          <p>{listError}</p>
          <button
            type="button"
            onClick={() => {
              setRefresh(value => value + 1);
              setApplicationsRefresh(value => value + 1);
            }}
            className="mt-space-xs underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loadingApplications && !loadingDeployments && (
      <>
      {/* Cluster rollout telemetry is not exposed by the deployment API. */}
      <div role="status" className="mb-space-xl rounded-xl bg-surface-container-lowest p-space-lg text-center shadow-sm border border-surface-container-high/40">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Rollout telemetry unavailable</h2>
        <p className="mt-space-xs font-body-sm text-body-sm text-on-surface-variant">
          This API stores deployment records and status transitions. Canary progress, cluster metrics, automated rollbacks, and release pipeline stages are not available here.
        </p>
      </div>
      {/* SECTION 3: Detailed Deployments Table */}
      <div className="flex flex-col bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden mb-space-xl border border-surface-container-high/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-space-lg py-space-md bg-surface-container-low gap-space-sm border-b border-surface-container-high/40">
          <div className="flex items-center gap-space-sm">
            <span className="font-headline-sm text-headline-sm text-on-surface">
              All Recorded Deployments
            </span>
            <span className="font-label-sm text-label-sm px-space-xs py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-medium">
              Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + deployments.length, total)} of {total}
            </span>
            <span className="px-1 py-0.5 rounded bg-surface-container font-label-sm text-[9px]">Runs</span>
          </div>
          <div className="flex items-center gap-space-xs">
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-space-xxs px-space-sm py-1.5 rounded bg-surface-container-lowest hover:bg-surface-container text-on-surface font-body-sm text-body-sm shadow-sm transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              Export Audit CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm tracking-wider uppercase">
                <th className="py-space-sm px-space-md font-semibold">Deployment ID</th>
                <th className="py-space-sm px-space-md font-semibold">Application &amp; Version</th>
                <th className="py-space-sm px-space-md font-semibold">Commit SHA</th>
                <th className="py-space-sm px-space-md font-semibold">Environment</th>
                <th className="py-space-sm px-space-md font-semibold">Status</th>
                <th className="py-space-sm px-space-md font-semibold">Initiator</th>
                <th className="py-space-sm px-space-md font-semibold">Duration &amp; Created</th>
                <th className="py-space-sm px-space-md font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-on-surface font-body-sm text-body-sm divide-y divide-surface-container-low">
              {loadingApplications && (
                <tr><td colSpan={8} className="px-space-md py-space-lg text-center">Loading applications…</td></tr>
              )}
              {!loadingApplications && applications.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-space-md py-space-lg text-center">
                    No applications available. <Link className="text-primary underline" to="/applications">Applications</Link>
                  </td>
                </tr>
              )}
              {!loadingApplications && applications.length > 0 && !selectedApplicationId && (
                <tr><td colSpan={8} className="px-space-md py-space-lg text-center">Select an application to view deployments.</td></tr>
              )}
              {loadingDeployments && (
                <tr><td colSpan={8} className="px-space-md py-space-lg text-center">Loading deployments…</td></tr>
              )}
              {!loadingDeployments && !listError && selectedApplicationId && deployments.length === 0 && (
                <tr><td colSpan={8} className="px-space-md py-space-lg text-center">No deployments for this application.</td></tr>
              )}
              {filteredDeployments.map(dep => (
                <tr
                  key={dep.id}
                  onClick={() => navigate(`/deployments/${dep.id}`)}
                  className="hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <td className="py-space-md px-space-md font-label-md text-label-md">
                    <div className="flex items-center gap-space-xs">
                      <span className={`font-code-inline font-medium ${
                        dep.statusType === 'failed' || dep.statusType === 'rolled-back' ? 'text-error' : 'text-primary'
                      }`}>
                        {dep.id}
                      </span>
                      <button
                        type="button"
                        onClick={e => handleCopy(dep.id, e)}
                        title="Copy Deployment ID"
                        className="text-outline hover:text-on-surface transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {copiedId === dep.id ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  </td>

                  <td className="py-space-md px-space-md">
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-headline-sm text-on-surface">
                        {dep.app}
                      </span>
                      <span className="font-label-sm text-label-sm text-primary">{dep.version}</span>
                      <div className="flex items-center gap-space-xxs text-on-surface-variant font-label-sm text-label-sm mt-0.5">
                        <span className="material-symbols-outlined text-[12px]">fork_right</span>
                        <span className="font-code-inline">-</span>
                      </div>
                    </div>
                  </td>

                  <td className="py-space-md px-space-md">
                    <div className="flex flex-col max-w-[220px]">
                      <div className="flex items-center gap-1 font-label-sm text-label-sm">
                        <span className="px-1 py-0.5 rounded bg-surface-container font-code-inline font-medium text-primary">
                          {dep.commitSha ?? '-'}
                        </span>
                        <span className="text-on-surface-variant">-</span>
                      </div>
                      <span className="text-on-surface-variant text-body-sm truncate mt-0.5">
                        -
                      </span>
                    </div>
                  </td>

                  <td className="py-space-md px-space-md">
                    <span className="inline-flex items-center px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm">
                      {dep.environment ? `${dep.environment[0].toUpperCase()}${dep.environment.slice(1)}` : '-'}
                    </span>
                  </td>

                  <td className="py-space-md px-space-md">
                    <span
                      className={`inline-flex items-center gap-space-xxs px-space-xs py-0.5 rounded font-label-sm text-label-sm font-semibold ${
                        dep.statusType === 'in-progress'
                          ? 'bg-secondary-fixed text-on-secondary-fixed'
                          : dep.statusType === 'success'
                          ? 'bg-primary-fixed text-on-primary-fixed'
                          : 'bg-error-container text-on-error-container'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {dep.statusType === 'in-progress'
                          ? 'refresh'
                          : dep.statusType === 'success'
                          ? 'check_circle'
                          : 'cancel'}
                      </span>
                      {dep.status}
                    </span>
                  </td>

                  <td className="py-space-md px-space-md">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">Not available</span>
                    </div>
                  </td>

                  <td className="py-space-md px-space-md">
                    <div className="flex flex-col font-label-sm text-label-sm">
                      <span className="font-medium text-on-surface font-code-inline">{formatDuration(dep.deployment.started_at, dep.deployment.finished_at)}</span>
                      <span className="text-on-surface-variant">{formatTimestamp(dep.deployment.created_at)}</span>
                    </div>
                  </td>

                  <td className="py-space-md px-space-md text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-space-xs">
                      <DeploymentStatusActions
                        status={deployments.find(item => item.id === dep.id)?.status ?? 'pending'}
                        onTransition={status => transition(dep.id, status)}
                      />
                      <button
                        type="button"
                        onClick={() => navigate(`/deployments/${dep.id}`)}
                        title="View Deployment Details"
                        className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">data_object</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm border-t border-surface-container-high/40 px-space-md py-space-sm font-label-sm text-label-sm">
            <label className="flex items-center gap-space-xs">
              Deployments per page
              <select
                aria-label="Deployments per page"
                value={pageSize}
                onChange={event => {
                  setPageSize(Number(event.target.value));
                  setOffset(0);
                }}
                className="rounded border border-outline-variant bg-surface-container-low px-space-xs py-1"
              >
                {[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <div className="flex gap-space-xs">
              <button
                type="button"
                aria-label="Previous page"
                disabled={offset === 0}
                onClick={() => setOffset(value => Math.max(0, value - pageSize))}
                className="rounded bg-surface-container-low px-space-sm py-space-xs disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                aria-label="Next page"
                disabled={offset + deployments.length >= total}
                onClick={() => setOffset(value => value + pageSize)}
                className="rounded bg-surface-container-low px-space-sm py-space-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      </>
      )}
      {!loadingApplications && !loadingDeployments && (
      <>
      <div className="rounded-xl bg-surface-container-low p-space-md text-on-surface border border-surface-container-high/40">
        <h2 className="font-headline-sm text-headline-sm">Deployment API capabilities</h2>
        <p className="mt-space-xs font-body-sm text-body-sm text-on-surface-variant">
          Create and status-transition requests update backend records. The API does not expose rollout telemetry, immutable audit storage, cluster rollback gates, or deployment initiators.
        </p>
      </div>
        {createOpen && selectedApplicationId && (
          <DeploymentCreateForm
            applicationId={selectedApplicationId}
            onCancel={() => setCreateOpen(false)}
            onCreated={() => {
              setCreateOpen(false);
              setMessage('Deployment created.');
              setOffset(0);
              setRefresh(value => value + 1);
            }}
          />
        )}
      </>
      )}
    </div>
  );
};
