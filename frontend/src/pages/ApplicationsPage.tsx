import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MicroserviceItem } from '../data/servicesData.ts';
import { ApiError } from '../api/client';
import { deleteApplication, listApplications } from '../api/applications';
import { getSummary } from '../api/summary';
import type { Application, ApplicationStatus, Environment } from '../api/types';
import type { SummaryResponse } from '../api/types';
import { ApplicationForm } from '../components/applications/ApplicationForm';

export const ApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [pagination, setPagination] = useState({ total: 0, limit: 10, offset: 0 });
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [envFilter, setEnvFilter] = useState<'all' | Environment>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all');
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Selected service for slide-over drawer
  const [selectedService, setSelectedService] = useState<MicroserviceItem | null>(null);

  // Application create and edit state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [formApplication, setFormApplication] = useState<Application | null | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const deleteCancelButton = useRef<HTMLButtonElement>(null);
  const listRequestSequence = useRef(0);

  // Action toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    const requestId = ++listRequestSequence.current;
    setLoading(true);
    setListError('');
    try {
      const result = await listApplications({
        limit: rowsPerPage,
        offset,
        ...(envFilter === 'all' ? {} : { environment: envFilter }),
        ...(statusFilter === 'all' ? {} : { status: statusFilter }),
      });
      if (requestId !== listRequestSequence.current) return;

      const lastOffset = result.total === 0
        ? 0
        : Math.floor((result.total - 1) / result.limit) * result.limit;
      if (offset > lastOffset) {
        setOffset(lastOffset);
        return;
      }
      if (result.offset !== offset) {
        setOffset(result.offset);
        return;
      }
      setApplications(result.items);
      setPagination({ total: result.total, limit: result.limit, offset: result.offset });
    } catch (error: unknown) {
      if (requestId !== listRequestSequence.current) return;
      setListError(error instanceof ApiError ? error.message : 'Unable to load applications. Please try again.');
    } finally {
      if (requestId === listRequestSequence.current) setLoading(false);
    }
  }, [envFilter, offset, rowsPerPage, statusFilter]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications, refresh]);

  useEffect(() => {
    let active = true;
    void getSummary()
      .then(result => {
        if (active) setSummary(result);
      })
      .catch(() => {
        if (active) setSummary(null);
      });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    if (!deleteTarget) return;
    deleteCancelButton.current?.focus();
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) {
        setDeleteTarget(null);
        setDeleteError('');
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = document.querySelector<HTMLElement>('[data-delete-dialog="true"]');
      const controls = dialog?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
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

  const serviceRows = useMemo(() => applications.map(application => {
    const environment: MicroserviceItem['environment'] = application.environment === 'production' ? 'Production' :
      application.environment === 'staging' ? 'Staging' : 'Dev';
    const health: MicroserviceItem['health'] = application.status === 'healthy' ? 'Healthy' :
      application.status === 'degraded' ? 'Degraded' :
        application.status === 'down' ? 'Down' : 'Unknown';
    return {
      id: application.id,
      name: application.name,
      port: '—',
      protocol: '—',
      namespace: '—',
      environment,
      health,
      healthDetail: 'Status reported by the backend',
      version: '—',
      replicasReady: 0,
      replicasTotal: 0,
      replicasStatus: 'not available',
      cpu: 'Not available',
      cpuPercent: 0,
      memory: 'Not available',
      memoryPercent: 0,
      lastDeployed: 'Not available',
      description: application.description ?? 'No description provided.',
      ingressHost: 'Not available',
      runtime: 'Not available',
      minScale: 0,
      maxScale: 0,
      gracePeriod: 'Not available',
      endpoints: [],
      dependencies: { upstream: 'Not available', downstream: [] },
      sampleLogs: [],
    };
  }), [applications]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filtered microservices
  const filteredServices = useMemo(() => {
    return serviceRows.filter(srv => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        srv.name.toLowerCase().includes(q) ||
        srv.id.toLowerCase().includes(q) ||
        srv.description.toLowerCase().includes(q);
      return matchesSearch;
    });
  }, [serviceRows, searchTerm]);

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const hasActiveFilters = searchTerm.length > 0 || envFilter !== 'all' || statusFilter !== 'all';
  const paginatedServices = filteredServices;

  const openCreateForm = () => {
    setFormApplication(null);
    setIsRegisterModalOpen(true);
  };

  const openEditForm = (application: Application) => {
    setFormApplication(application);
    setIsRegisterModalOpen(true);
  };

  const closeForm = () => {
    setIsRegisterModalOpen(false);
    setFormApplication(undefined);
  };

  const saveForm = (name: string, created: boolean) => {
    setAnnouncement(`Application ${name} ${created ? 'created' : 'updated'}.`);
    closeForm();
    setRefresh(value => value + 1);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteApplication(target.id);
      setAnnouncement(`Application ${target.name} deleted.`);
      setDeleteTarget(null);
      setRefresh(value => value + 1);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) {
        setAnnouncement(`Application ${target.name} was already removed.`);
        setDeleteTarget(null);
        setRefresh(value => value + 1);
      } else {
        setDeleteError(
          error instanceof ApiError && (error.status === 409 || error.status === 422)
            ? error.message
            : error instanceof Error ? error.message : 'Unable to delete the application. Please try again.',
        );
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col w-full pb-space-2xl pt-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-space-md rounded-xl bg-inverse-surface text-inverse-on-surface shadow-2xl flex items-center gap-2 font-body-sm text-body-sm border border-surface-container-high animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-primary-fixed text-[20px]">info</span>
          <span>{toastMessage}</span>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{announcement}</p>

      {/* Top Stat Ticker & Operational Context */}
      <div className="w-full mb-space-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-space-xxs min-w-0">
          <div className="flex items-center gap-space-sm flex-wrap">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Application Services
            </h1>
            <span className="px-space-sm py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm font-semibold">
              {pagination.total} Services
            </span>
            <div className="flex items-center gap-space-xs px-space-sm py-0.5 rounded-full bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
              <span className="material-symbols-outlined text-[13px] text-tertiary">info</span>
              <span>Live backend data</span>
            </div>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-3xl">
            Registered applications with backend status, environment, and editable metadata.
          </p>
        </div>

        {/* Live Telemetry Mini Widget */}
        {!loading && !listError && (
        <div className="flex items-center gap-space-md bg-surface-container-lowest p-space-sm rounded-xl shadow-sm self-start md:self-auto border border-surface-container-high/40">
          <div className="flex items-center gap-space-sm px-space-sm border-r border-surface-container-high">
            <div className="w-2 h-2 rounded-full bg-primary animate-ping"></div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Cluster Ingress
              </span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Not available
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-sm px-space-sm">
            <span className="material-symbols-outlined text-primary text-[20px]">hub</span>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Active Pods
              </span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Not available
              </span>
            </div>
          </div>
        </div>
        )}
      </div>

      {!loading && !listError && (
      <>
      {/* Live application and deployment summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md mb-space-lg">
        {/* Production Online */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Production applications
              </span>
              <span className="px-space-xs py-space-xxs rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">Live API</span>
            </div>
            <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
          </div>
          <div className="my-space-xs flex items-baseline gap-space-sm">
            <span className="font-metric-xl text-metric-xl text-on-surface">
              {summary?.applications.by_environment.production ?? 'Unavailable'}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">registered</span>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-primary h-full w-0 rounded-full"></div>
          </div>
        </div>

        {/* Degraded Nodes */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Degraded or down applications
              </span>
              <span className="px-space-xs py-space-xxs rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">Live API</span>
            </div>
            <span className="material-symbols-outlined text-[18px] text-error">warning</span>
          </div>
          <div className="my-space-xs flex items-baseline gap-space-sm">
            <span className="font-metric-xl text-metric-xl text-error">
              {summary
                ? (summary.applications.by_status.degraded ?? 0) + (summary.applications.by_status.down ?? 0)
                : 'Unavailable'}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-normal">current status</span>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-error h-full w-0 rounded-full"></div>
          </div>
        </div>

        {/* Total Workloads */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Registered applications
              </span>
              <span className="px-space-xs py-space-xxs rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">Live API</span>
            </div>
            <span className="material-symbols-outlined text-[18px] text-secondary">memory</span>
          </div>
          <div className="my-space-xs flex items-baseline gap-space-sm">
            <span className="font-metric-xl text-metric-xl text-on-surface">{summary?.applications.total ?? 'Unavailable'}</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">applications</span>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-secondary h-full w-0 rounded-full"></div>
          </div>
        </div>

        {/* Deploy Velocity */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Deployments in last 24h
              </span>
              <span className="px-space-xs py-space-xxs rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">Live API</span>
            </div>
            <span className="material-symbols-outlined text-[18px] text-tertiary">bolt</span>
          </div>
          <div className="my-space-xs flex items-baseline gap-space-sm">
            <span className="font-metric-xl text-metric-xl text-on-surface">{summary?.deployments.last_24h ?? 'Unavailable'}</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">backend records</span>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-tertiary h-full w-0 rounded-full"></div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Operational Filter / Action Bar */}
      <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm mb-space-md flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md border border-surface-container-high/40">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-sm flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <span className="material-symbols-outlined absolute left-space-sm top-2 text-[18px] text-on-surface-variant">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setOffset(0);
              }}
              placeholder="Filter by name, tag, port, namespace..."
              className="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm pl-9 pr-space-md py-1.5 rounded-lg focus:outline-none focus:bg-surface-container-lowest shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all"
            />
          </div>

          {/* Environment Filter */}
          <div className="relative">
            <select
              value={envFilter}
              onChange={e => {
                setEnvFilter(e.target.value as 'all' | Environment);
                setOffset(0);
              }}
              className="w-full sm:w-auto appearance-none bg-surface-container-low text-on-surface font-body-sm text-body-sm pl-space-md pr-8 py-1.5 rounded-lg focus:outline-none focus:bg-surface-container-lowest cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              <option value="all">All Environments</option>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Dev</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-2 text-[18px] text-on-surface-variant">
              expand_more
            </span>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value as 'all' | ApplicationStatus);
                setOffset(0);
              }}
              className="w-full sm:w-auto appearance-none bg-surface-container-low text-on-surface font-body-sm text-body-sm pl-space-md pr-8 py-1.5 rounded-lg focus:outline-none focus:bg-surface-container-lowest cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              <option value="all">All Statuses</option>
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="down">Down</option>
              <option value="unknown">Unknown</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-2 text-[18px] text-on-surface-variant">
              expand_more
            </span>
          </div>

          {/* State Switcher Buttons (Live, Loading, Empty preview) */}
          <div className="flex items-center bg-surface-container-low p-0.5 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setRefresh(value => value + 1)}
              className="px-space-sm py-1 rounded font-label-sm text-label-sm transition-all cursor-pointer bg-surface-container-lowest text-on-surface shadow-xs font-semibold"
            >
              Live
            </button>
            <button
              type="button"
              disabled
              className="px-space-sm py-1 rounded font-label-sm text-label-sm transition-all cursor-not-allowed text-on-surface-variant opacity-60"
            >
              Loading
            </button>
            <button
              type="button"
              disabled
              className="px-space-sm py-1 rounded font-label-sm text-label-sm transition-all cursor-not-allowed text-on-surface-variant opacity-60"
            >
              Empty
            </button>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-space-sm">
          <button
            type="button"
            aria-label="Add application"
            onClick={openCreateForm}
            className="flex items-center gap-space-xs px-space-md py-1.5 bg-primary-container text-on-primary-container font-headline-sm text-body-md rounded-lg shadow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Register Service</span>
          </button>
        </div>
      </div>

      {/* Simulated Loading State Skeleton */}
      {loading && (
        <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm mb-space-md animate-pulse border border-surface-container-high/40">
          <p role="status" className="mb-space-md font-body-sm text-body-sm">Loading applications…</p>
          <div className="h-8 bg-surface-container-high rounded w-1/4 mb-space-md"></div>
          <div className="space-y-space-sm">
            <div className="h-10 bg-surface-container-low rounded"></div>
            <div className="h-10 bg-surface-container-low rounded"></div>
            <div className="h-10 bg-surface-container-low rounded"></div>
            <div className="h-10 bg-surface-container-low rounded"></div>
          </div>
        </div>
      )}
      {!loading && listError && (
        <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm mb-space-md border border-error">
          <p role="alert" className="font-body-md text-body-md text-error">{listError}</p>
          <button type="button" onClick={() => setRefresh(value => value + 1)} className="mt-space-sm underline">
            Retry
          </button>
        </div>
      )}

      {/* Simulated Empty State or Filter Empty State */}
      {!loading && !listError && filteredServices.length === 0 && (
        <div className="bg-surface-container-lowest p-space-2xl rounded-xl shadow-sm mb-space-md text-center flex flex-col items-center justify-center border border-surface-container-high/40">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-primary mb-space-md">
            <span className="material-symbols-outlined text-[32px]">manage_search</span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-space-xxs">
            No microservices found
          </h3>
          {pagination.total === 0 && !hasActiveFilters && <p className="font-body-sm text-body-sm">No applications yet</p>}
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md mb-space-lg">
            No registered pods or containers matched your current filter parameters or cluster context.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setEnvFilter('all');
              setStatusFilter('all');
              setOffset(0);
            }}
            className="px-space-md py-space-xs bg-surface-container-high text-on-surface hover:bg-surface-container rounded-lg font-body-md text-body-md shadow-sm transition-colors cursor-pointer"
          >
            Reset All Filters
          </button>
          {pagination.total === 0 && !hasActiveFilters && (
            <button
              type="button"
              onClick={openCreateForm}
              className="mt-space-sm px-space-md py-space-xs bg-primary-container text-on-primary-container rounded-lg font-body-md text-body-md shadow-sm"
            >
              Create application
            </button>
          )}
        </div>
      )}

      {/* Live Data Table Viewport */}
      {!loading && !listError && filteredServices.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-surface-container-high/40">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="py-space-md px-space-md font-semibold">Application / Port <span className="px-space-xs py-space-xxs rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">Unavailable</span></th>
                  <th className="py-space-md px-space-md font-semibold">Namespace / Env <span className="px-space-xs py-space-xxs rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">Namespace unavailable</span></th>
                  <th className="py-space-md px-space-md font-semibold">Health</th>
                  <th className="py-space-md px-space-md font-semibold">Version Tag <span className="px-space-xs py-space-xxs rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">Unavailable</span></th>
                  <th className="py-space-md px-space-md font-semibold">Replicas <span className="px-space-xs py-space-xxs rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">Unavailable</span></th>
                  <th className="py-space-md px-space-md font-semibold min-w-[140px]">Telemetry (CPU/RAM) <span className="px-space-xs py-space-xxs rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">Unavailable</span></th>
                  <th className="py-space-md px-space-md font-semibold">Last Deployed <span className="px-space-xs py-space-xxs rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">Unavailable</span></th>
                  <th className="py-space-md px-space-md font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="font-body-sm text-body-sm text-on-surface divide-y divide-surface-container-low">
                {paginatedServices.map(srv => {
                  const isDegraded = srv.health === 'Degraded' || srv.health === 'Down';
                  const isInit = srv.health === 'Unknown';

                  return (
                    <tr
                      key={srv.id}
                      aria-label={srv.name}
                      onClick={() => setSelectedService(srv)}
                      className={`hover:bg-surface-container-low/60 transition-colors group cursor-pointer ${
                        isDegraded ? 'bg-error-container/10' : ''
                      }`}
                    >
                      {/* Service & Port */}
                      <td className="py-space-md px-space-md">
                        <div className="flex items-center gap-space-sm">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isDegraded
                                ? 'bg-error-container text-error'
                                : 'bg-surface-container-high text-primary'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {isDegraded ? 'warning' : 'apps'}
                            </span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-headline-sm text-body-md text-on-surface truncate group-hover:text-primary transition-colors">
                              {srv.name}
                            </span>
                            <span className="font-label-sm text-label-sm text-on-surface-variant font-code-inline">
                              :{srv.port} ({srv.protocol})
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Namespace / Env */}
                      <td className="py-space-md px-space-md">
                        <div className="flex flex-col">
                          <span className="font-label-md text-label-md text-on-surface font-medium">
                            {srv.namespace}
                          </span>
                          <span
                            className={`font-label-sm text-label-sm uppercase font-bold ${
                              srv.environment === 'Production'
                                ? 'text-primary'
                                : srv.environment === 'Staging'
                                ? 'text-secondary'
                                : 'text-tertiary'
                            }`}
                          >
                            {srv.environment}
                          </span>
                        </div>
                      </td>

                      {/* Health */}
                      <td className="py-space-md px-space-md">
                        {isDegraded ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
                            {srv.health}
                          </span>
                        ) : isInit ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-outline animate-pulse"></span>
                            Unknown
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                            Healthy
                          </span>
                        )}
                      </td>

                      {/* Version Tag */}
                      <td className="py-space-md px-space-md">
                        <span className="px-space-xs py-0.5 rounded bg-surface-container-high font-label-sm text-label-sm text-on-surface font-medium">
                          {srv.version}
                        </span>
                      </td>

                      {/* Replicas */}
                      <td className="py-space-md px-space-md">
                        <div
                          className={`flex items-center gap-space-xs ${
                            isDegraded ? 'text-error font-semibold' : ''
                          }`}
                        >
                          <span className="font-label-md text-label-md font-semibold">
                            {srv.replicasStatus === 'not available'
                              ? 'Not available'
                              : `${srv.replicasReady} / ${srv.replicasTotal}`}
                          </span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            {srv.replicasStatus}
                          </span>
                        </div>
                      </td>

                      {/* Telemetry (CPU/RAM) */}
                      <td className="py-space-md px-space-md">
                        <div className="flex flex-col gap-1 w-full max-w-[120px]">
                          <div
                            className={`flex justify-between font-label-sm text-label-sm ${
                              isDegraded ? 'text-error font-bold' : ''
                            }`}
                          >
                            <span>{srv.cpu}</span>
                            <span>{srv.memory}</span>
                          </div>
                          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden flex">
                            {isDegraded ? (
                              <div
                                className="bg-error h-full rounded-full"
                                style={{ width: `${srv.cpuPercent}%` }}
                              ></div>
                            ) : (
                              <>
                                <div
                                  className="bg-primary h-full"
                                  style={{ width: `${srv.cpuPercent}%` }}
                                ></div>
                                <div
                                  className="bg-secondary h-full"
                                  style={{ width: `${srv.memoryPercent}%` }}
                                ></div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Last Deployed */}
                      <td className="py-space-md px-space-md">
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          {srv.lastDeployed}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-space-md px-space-md text-right"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedService(srv)}
                            className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                            title="Inspect details"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              readiness_score
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/applications/${srv.id}`)
                            }
                            className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                            title="Open full page"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              open_in_new
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled
                            title="Container terminal access is not available through the backend."
                            className="p-1 rounded text-on-surface-variant cursor-not-allowed opacity-50"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              terminal
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Edit ${srv.name}`}
                            onClick={() => {
                              const application = applications.find(item => item.id === srv.id);
                              if (application) openEditForm(application);
                            }}
                            className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                            title="Edit application"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${srv.name}`}
                            onClick={() => {
                              const application = applications.find(item => item.id === srv.id);
                              if (application) {
                                setDeleteError('');
                                setDeleteTarget(application);
                              }
                            }}
                            className="p-1 hover:bg-error-container rounded text-error transition-colors cursor-pointer"
                            title="Delete application"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination & Meta Bar */}
          <div className="p-space-md bg-surface-container-lowest flex flex-col sm:flex-row items-center justify-between gap-space-md border-t border-surface-container-low">
            <div className="flex items-center gap-space-md font-body-sm text-body-sm text-on-surface-variant">
              <span aria-live="polite">
                Showing {pagination.total === 0 ? 0 : pagination.offset + 1}–{Math.min(pagination.offset + applications.length, pagination.total)} of {pagination.total}
              </span>
              <span>registered microservices</span>
              <label className="flex items-center gap-space-xs">
                Rows per page
                <select
                  aria-label="Applications per page"
                  value={rowsPerPage}
                  onChange={event => {
                    setRowsPerPage(Number(event.target.value));
                    setOffset(0);
                  }}
                  className="rounded border border-outline-variant bg-surface-container-low px-space-xs py-1"
                >
                  {[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-space-xs font-label-sm text-label-sm">
              <button
                type="button"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => setOffset(Math.max(0, pagination.offset - pagination.limit))}
                className="p-1.5 rounded bg-surface-container-low text-on-surface-variant hover:bg-surface-container disabled:opacity-40 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setOffset((pageNum - 1) * pagination.limit)}
                  aria-label={`Page ${pageNum}`}
                  className={`w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-colors ${
                    currentPage === pageNum
                      ? 'bg-primary text-on-primary font-semibold'
                      : 'hover:bg-surface-container-high text-on-surface'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button
                type="button"
                aria-label="Next page"
                disabled={currentPage >= totalPages}
                onClick={() => setOffset(pagination.offset + pagination.limit)}
                className="p-1.5 rounded bg-surface-container-low text-on-surface hover:bg-surface-container disabled:opacity-40 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deep Architecture Insight Visual (Under Table Bento Cards) */}
      <div className="mt-space-lg grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        {/* Visual 1: Cluster Pod Topology Distribution Chart */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div>
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-headline-sm text-headline-sm text-on-surface">
                Cluster Resource Split
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
              {pagination.total} registered applications
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
              Cluster pod and resource distribution is not exposed by the applications API.
            </p>

            <div className="flex items-center justify-center min-h-36 text-center font-body-sm text-body-sm text-on-surface-variant">
              Cluster resource metrics are unavailable from the current API.
            </div>
          </div>

          <div className="p-space-sm bg-surface-container-low rounded-lg mt-space-sm flex items-center justify-between">
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Host zone data is not available.
            </span>
            <span className="font-label-sm text-label-sm text-primary font-bold">
              Autoscaling status unavailable
            </span>
          </div>
        </div>

        {/* Visual 2: Data Center Node Map */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div>
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-headline-sm text-headline-sm text-on-surface">
                Cluster Edge Gateway
              </span>
              <span className="material-symbols-outlined text-primary text-[18px]">public</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">
              Cluster network details are not exposed by the backend.
            </p>
            <div className="w-full h-36 bg-surface-container rounded-lg flex items-center justify-center text-center px-space-md font-body-sm text-body-sm text-on-surface-variant border border-surface-container-high/40">
              No live ingress or gateway status is available.
            </div>
          </div>
          <div className="mt-space-sm flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
            <span>Latency unavailable</span>
            <span>Connection status unavailable</span>
          </div>
        </div>

        {/* Visual 3: Security & Image Provenance */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div>
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-headline-sm text-headline-sm text-on-surface">
                Security &amp; Image Provenance
              </span>
              <span className="material-symbols-outlined text-[18px] text-tertiary">shield</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">
              Image signatures and SBOM scan results are not provided by the backend.
            </p>
          </div>
          <div className="mt-space-sm">
            <button
              type="button"
              disabled
              title="Registry scanning is not available through the backend."
              className="w-full py-1.5 bg-surface-container-high text-on-surface font-body-sm text-body-sm rounded-lg flex items-center justify-center gap-1 cursor-not-allowed opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">sync</span>
              Rescan Container Registry
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over Inspection Drawer */}
      {selectedService && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-surface-container-lowest shadow-2xl z-50 flex flex-col border-l border-surface-container-high animate-in slide-in-from-right duration-200">
          <div className="p-space-lg bg-surface-container flex items-center justify-between border-b border-surface-container-high">
            <div className="flex items-center gap-space-sm">
              <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">hub</span>
              </div>
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  {selectedService.name}
                </h3>
                <span className="font-label-sm text-label-sm text-on-surface-variant font-code-inline">
                  ID: {selectedService.id}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedService(null)}
              className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="p-space-lg flex-1 overflow-y-auto space-y-space-lg font-body-sm text-body-sm">
            {/* Metadata */}
            <div className="space-y-space-xs">
              <h4 className="font-headline-sm text-body-md text-on-surface font-semibold">
                Service Metadata
              </h4>
              <div className="bg-surface-container-low p-space-sm rounded-lg grid grid-cols-2 gap-space-sm font-label-sm text-label-sm">
                <div>
                  <span className="text-on-surface-variant block">Ingress Protocol</span>
                  <span className="text-on-surface font-medium">{selectedService.protocol}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Auto-Scale Bounds</span>
                  <span className="text-on-surface font-medium">
                    Not available from the applications API
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Service Mesh Port</span>
                  <span className="text-on-surface font-code-inline">{selectedService.port}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Graceful Termination</span>
                  <span className="text-on-surface font-medium">{selectedService.gracePeriod}</span>
                </div>
              </div>
            </div>

            {/* Endpoints */}
            <div>
              <h4 className="font-headline-sm text-body-md text-on-surface font-semibold mb-space-xs">
                Exposed Endpoints
              </h4>
              <div className="space-y-space-xs font-code-inline font-label-sm text-label-sm">
                {selectedService.endpoints.map((ep, i) => (
                  <div
                    key={i}
                    className="p-space-xs bg-surface-container-low rounded flex items-center justify-between"
                  >
                    <span className="text-on-surface">
                      {ep.method} {ep.path}
                    </span>
                    <span className="text-primary font-bold">{ep.status}</span>
                  </div>
                ))}
                {selectedService.endpoints.length === 0 && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Endpoint data is not available.</p>
                )}
              </div>
            </div>

            {/* Dependency Graph */}
            <div>
              <h4 className="font-headline-sm text-body-md text-on-surface font-semibold mb-space-xs">
                Dependency Mesh Graph
              </h4>
              <div className="p-space-md bg-surface-container-low rounded-lg text-center font-body-sm text-body-sm text-on-surface-variant">
                Dependency data is not available from the applications API.
              </div>
            </div>

            {/* Live Logs preview */}
            <div>
              <h4 className="font-headline-sm text-body-md text-on-surface font-semibold mb-space-xs">
                Real-Time Standard Out
              </h4>
              <div className="bg-inverse-surface text-inverse-on-surface p-space-sm rounded font-label-sm text-label-sm overflow-x-auto space-y-1">
                {selectedService.sampleLogs.map((log, i) => (
                  <p key={i}>
                    <span className="text-primary-fixed">{log.time}</span> [{log.level}] {log.msg}
                  </p>
                ))}
                {selectedService.sampleLogs.length === 0 && (
                  <p>Container stdout and stderr are not available through the backend.</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-space-md bg-surface-container flex items-center justify-between gap-space-sm border-t border-surface-container-high">
            <button
              type="button"
              disabled
              title="Diagnostics export is not available through the backend."
              className="px-space-sm py-1.5 bg-surface-container-high text-on-surface rounded font-body-sm text-body-sm cursor-not-allowed opacity-60"
            >
              Export Diagnostics
            </button>
            <button
              onClick={() => navigate(`/applications/${selectedService.id}`)}
              className="px-space-md py-1.5 bg-primary-container text-on-primary-container rounded font-body-sm text-body-sm font-medium hover:brightness-110 transition-colors cursor-pointer"
            >
              Open Dedicated View
            </button>
          </div>
        </div>
      )}

      {/* Application Form */}
      {isRegisterModalOpen && (
        <ApplicationForm
          key={formApplication?.id ?? 'new'}
          initialApplication={formApplication ?? undefined}
          onCancel={closeForm}
          onSaved={saveForm}
        />
      )}
      {deleteTarget && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-xs z-50 flex items-center justify-center p-space-md">
          <div
            data-delete-dialog="true"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-application-title"
            className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-space-lg shadow-2xl border border-surface-container-high"
          >
            <h2 id="delete-application-title" className="font-headline-md text-headline-md text-on-surface">
              Delete application?
            </h2>
            <p className="mt-space-sm font-body-sm text-body-sm text-on-surface-variant">
              Delete <strong>{deleteTarget.name}</strong>? Its deployments and logs will also be deleted.
            </p>
            {deleteError && <p role="alert" className="mt-space-sm text-error">{deleteError}</p>}
            <div className="pt-space-sm flex justify-end gap-space-sm">
              <button
                ref={deleteCancelButton}
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError('');
                }}
                className="px-space-md py-1.5 bg-surface-container text-on-surface rounded-lg cursor-pointer hover:bg-surface-container-high disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="px-space-md py-1.5 bg-error text-on-error rounded-lg font-medium shadow-sm disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : `Confirm delete ${deleteTarget.name}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
