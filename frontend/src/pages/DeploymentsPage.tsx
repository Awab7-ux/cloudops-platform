import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DEPLOYMENTS_LIST,
  CANARY_STEPS,
  DeploymentRecord,
} from '../data/deploymentsData.ts';

export const DeploymentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [envFilter, setEnvFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
    return DEPLOYMENTS_LIST.filter(dep => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        dep.id.toLowerCase().includes(q) ||
        dep.app.toLowerCase().includes(q) ||
        dep.commitSha.toLowerCase().includes(q) ||
        dep.commitMsg.toLowerCase().includes(q);
      const matchEnv =
        envFilter === 'all' ||
        (envFilter === 'prod' && dep.environment.includes('Production')) ||
        (envFilter === 'staging' && dep.environment.includes('Staging'));
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'success' && dep.statusType === 'success') ||
        (statusFilter === 'in-progress' && dep.statusType === 'in-progress') ||
        (statusFilter === 'failed' && dep.statusType === 'failed') ||
        (statusFilter === 'rolled-back' && dep.statusType === 'rolled-back');
      return matchSearch && matchEnv && matchStatus;
    });
  }, [searchTerm, envFilter, statusFilter]);

  const handleExportCsv = () => {
    const csvContent =
      "Deployment ID,Application,Branch,Commit,Environment,Status,Initiator,Duration\n" +
      filteredDeployments
        .map(
          d =>
            `"${d.id}","${d.app}","${d.branch}","${d.commitSha}","${d.environment}","${d.status}","${d.initiator}","${d.duration}"`
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
            Safe Mode Enabled: This cluster view operates in sandbox telemetry mode. Rollouts and rollbacks are simulated for audit demonstrations. (Demo data)
          </span>
        </div>
        <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
          <span>K8s Provider: EKS-us-east-1</span>
          <span>•</span>
          <span className="text-primary font-code-inline text-code-inline font-bold">v1.28.4</span>
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
              38 Deployments Today
            </span>
            <span className="px-space-xs py-space-xxs bg-surface-container-high text-on-surface-variant rounded font-label-sm text-label-sm">
              Cluster Fleet: Global (9 nodes)
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Audit log of continuous integration and release rollouts across all clusters. (Demo data)
          </p>
        </div>

        {/* Action Button */}
        <div className="relative group flex items-center self-start xl:self-auto">
          <button
            type="button"
            onClick={() => showToast('Production Lock Active: Direct dashboard promotion restricted to automated GitOps webhook.')}
            className="flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-surface-container-high text-on-surface font-body-sm text-body-sm shadow-sm transition-all hover:bg-surface-container-highest cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">rocket_launch</span>
            <span className="font-semibold">Trigger Rollout</span>
            <span className="px-space-xxs py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-label-sm text-[10px] uppercase tracking-wider">
              Demo Only
            </span>
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-space-sm p-space-md bg-surface-container-lowest rounded-xl shadow-sm mb-space-xl border border-surface-container-high/40">
        <div className="md:col-span-4 relative flex items-center">
          <span className="material-symbols-outlined absolute left-space-sm text-[18px] text-outline pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by Commit SHA, Tag, or dep-ID..."
            className="w-full pl-9 pr-space-sm py-2 rounded bg-surface-container-low text-on-surface placeholder:text-outline font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest shadow-sm"
          />
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
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="in-progress">In Progress</option>
            <option value="failed">Failed</option>
            <option value="rolled-back">Rolled Back</option>
          </select>
          <span className="material-symbols-outlined absolute right-2.5 text-[16px] text-outline pointer-events-none">
            expand_more
          </span>
        </div>

        <div className="md:col-span-3 relative flex items-center">
          <span className="material-symbols-outlined absolute left-space-sm text-[18px] text-outline pointer-events-none">
            calendar_today
          </span>
          <input
            type="text"
            readOnly
            value="Last 24 Hours (Rolling)"
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

      {/* SECTION 1: Rollout Pipeline Metric Stats (Labeled Demo data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-xl">
        {/* Stat 1: Success Rate */}
        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div className="flex items-center justify-between mb-space-sm">
            <div className="flex items-center gap-1.5">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Deployment Success Rate
              </span>
              <span className="px-1 py-0.2 rounded bg-surface-container font-label-sm text-[9px]">Demo data</span>
            </div>
            <span className="p-1 rounded bg-secondary-fixed text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs">
            <span className="font-metric-xl text-metric-xl text-on-surface">97.4%</span>
            <span className="inline-flex items-center font-label-sm text-label-sm text-primary font-medium">
              <span className="material-symbols-outlined text-[14px]">arrow_upward</span> +1.2%
            </span>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full mt-space-md overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: '97.4%' }}></div>
          </div>
          <div className="flex justify-between items-center mt-space-xs text-on-surface-variant font-label-sm text-label-sm">
            <span>37 of 38 Healthy</span>
            <span>SLA: 95.0%</span>
          </div>
        </div>

        {/* Stat 2: Mean Deploy Time */}
        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div className="flex items-center justify-between mb-space-sm">
            <div className="flex items-center gap-1.5">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Mean Deploy Time
              </span>
              <span className="px-1 py-0.2 rounded bg-surface-container font-label-sm text-[9px]">Demo data</span>
            </div>
            <span className="p-1 rounded bg-primary-fixed text-on-primary-fixed">
              <span className="material-symbols-outlined text-[16px]">speed</span>
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs">
            <span className="font-metric-xl text-metric-xl text-on-surface">3m 42s</span>
            <span className="inline-flex items-center font-label-sm text-label-sm text-primary font-medium">
              <span className="material-symbols-outlined text-[14px]">arrow_downward</span> -18s avg
            </span>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full mt-space-md overflow-hidden flex">
            <div className="bg-primary-container h-full" style={{ width: '45%' }} title="Build stage"></div>
            <div className="bg-secondary-container h-full" style={{ width: '25%' }} title="Scan stage"></div>
            <div className="bg-primary h-full" style={{ width: '30%' }} title="Sync & Canary"></div>
          </div>
          <div className="flex justify-between items-center mt-space-xs text-on-surface-variant font-label-sm text-label-sm">
            <span>Fastest: 1m 58s</span>
            <span>P95: 5m 10s</span>
          </div>
        </div>

        {/* Stat 3: Rollbacks */}
        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div className="flex items-center justify-between mb-space-sm">
            <div className="flex items-center gap-1.5">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Automated Rollbacks
              </span>
              <span className="px-1 py-0.2 rounded bg-surface-container font-label-sm text-[9px]">Demo data</span>
            </div>
            <span className="p-1 rounded bg-error-container text-on-error-container">
              <span className="material-symbols-outlined text-[16px]">history_toggle_off</span>
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs">
            <span className="font-metric-xl text-metric-xl text-on-surface">1</span>
            <span className="inline-flex items-center font-label-sm text-label-sm text-error font-medium">
              2.6% rate
            </span>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full mt-space-md overflow-hidden">
            <div className="bg-error h-full rounded-full" style={{ width: '8%' }}></div>
          </div>
          <div className="flex justify-between items-center mt-space-xs text-on-surface-variant font-label-sm text-label-sm">
            <span>dep-8711a4 restored</span>
            <span className="text-error font-medium">Telemetry Breach</span>
          </div>
        </div>

        {/* Stat 4: Active Canary */}
        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div className="flex items-center justify-between mb-space-sm">
            <div className="flex items-center gap-1.5">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Active In-Flight Rollout
              </span>
              <span className="px-1 py-0.2 rounded bg-surface-container font-label-sm text-[9px]">Demo data</span>
            </div>
            <span className="p-1 rounded bg-secondary-fixed text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[16px]">sync</span>
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs">
            <span className="font-metric-xl text-metric-xl text-on-surface">1 Active</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-semibold">
              Canary 75%
            </span>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full mt-space-md overflow-hidden relative">
            <div className="bg-secondary h-full rounded-full animate-pulse" style={{ width: '75%' }}></div>
          </div>
          <div className="flex justify-between items-center mt-space-xs text-on-surface-variant font-label-sm text-label-sm">
            <span>api-router:v2.1.0</span>
            <span className="text-secondary font-medium">Stage 4 of 5</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: Active Canary Rollout Live Inspector Card */}
      <div className="mb-space-xl p-space-lg bg-surface-container-lowest rounded-xl shadow-md relative overflow-hidden border border-surface-container-high/40">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary-container"></div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md mb-space-lg">
          <div className="flex items-start gap-space-md">
            <div className="p-space-sm rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px] animate-spin">refresh</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-space-xs flex-wrap">
                <Link
                  to="/deployments/dep-9842f1"
                  className="font-headline-md text-headline-md text-on-surface hover:text-primary transition-colors"
                >
                  api-router
                </Link>
                <span className="font-code-inline text-code-inline px-space-xs py-0.5 rounded bg-surface-container text-primary font-medium">
                  v2.1.0
                </span>
                <span className="px-space-xs py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm font-semibold">
                  In-Flight Canary
                </span>
                <span className="px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm">
                  Cluster: prod-us-east-1
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Gradual traffic diversion with continuous Prometheus latency &amp; 5xx error rate health validation. (Demo data)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-space-lg self-end lg:self-auto bg-surface-container-low px-space-md py-space-sm rounded-lg">
            <div className="flex flex-col items-end">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                Traffic Weight
              </span>
              <span className="font-headline-sm text-headline-sm text-primary font-bold">
                75% Canary / 25% Baseline
              </span>
            </div>
            <div className="w-px h-8 bg-surface-container-highest"></div>
            <div className="flex flex-col items-end">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                Probe Assertions
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                12 / 12 Passing
              </span>
            </div>
            <div className="w-px h-8 bg-surface-container-highest"></div>
            <div className="flex flex-col items-end">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                Time Remaining
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-code-inline">
                ~04:15
              </span>
            </div>
          </div>
        </div>

        {/* Stepper Pipeline Progress Visualization */}
        <div className="mt-space-sm mb-space-md">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-space-sm">
            {CANARY_STEPS.map(step => (
              <div
                key={step.step}
                className={`flex flex-col gap-space-xxs p-space-sm rounded transition-all ${
                  step.status === 'active'
                    ? 'bg-secondary-fixed text-on-secondary-fixed shadow-sm'
                    : step.status === 'complete'
                    ? 'bg-surface-container-low'
                    : 'bg-surface-container opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-label-sm text-label-sm uppercase font-semibold ${
                    step.status === 'active' ? 'text-secondary font-bold' : step.status === 'complete' ? 'text-primary' : 'text-outline'
                  }`}>
                    {step.step}. {step.title}
                  </span>
                  <span className="material-symbols-outlined text-[16px]">
                    {step.status === 'complete'
                      ? 'check_circle'
                      : step.status === 'active'
                      ? 'autorenew'
                      : 'schedule'}
                  </span>
                </div>
                <span className="font-body-sm text-body-sm font-medium truncate">
                  {step.status === 'active' ? 'Weight Step: 75%' : step.description}
                </span>
                <span className="font-label-sm text-label-sm font-code-inline text-on-surface-variant">
                  {step.status === 'active' ? 'p99 = 18.2ms (<35ms)' : step.badge}
                </span>
              </div>
            ))}
          </div>

          <div className="w-full bg-surface-container h-2 rounded-full mt-space-md overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-500"
              style={{ width: '75%' }}
            ></div>
          </div>
        </div>

        {/* Sub-bar with Live Telemetry Stats */}
        <div className="flex flex-wrap items-center justify-between pt-space-xs text-on-surface-variant font-label-sm text-label-sm">
          <div className="flex items-center gap-space-md flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              Canary Pods: 6 Running
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-primary">query_stats</span>
              Error Rate: 0.002% (Target: &lt;0.05%)
            </span>
            <span className="flex items-center gap-1 font-code-inline">
              Git: commit #609d93a by alice.dev
            </span>
          </div>
          <div className="flex items-center gap-space-xs">
            <Link
              to="/deployments/dep-9842f1"
              className="px-space-xs py-1 rounded bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors"
            >
              View Detailed Metrics &amp; Rollback
            </Link>
            <Link
              to="/logs"
              className="px-space-xs py-1 rounded bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors"
            >
              View Live Stream Logs
            </Link>
          </div>
        </div>
      </div>

      {/* SECTION 3: Detailed Deployments Table */}
      <div className="flex flex-col bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden mb-space-xl border border-surface-container-high/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-space-lg py-space-md bg-surface-container-low gap-space-sm border-b border-surface-container-high/40">
          <div className="flex items-center gap-space-sm">
            <span className="font-headline-sm text-headline-sm text-on-surface">
              All Recorded Deployments
            </span>
            <span className="font-label-sm text-label-sm px-space-xs py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-medium">
              Showing {filteredDeployments.length} of 38 Runs (Demo data)
            </span>
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
                <th className="py-space-sm px-space-md font-semibold">Application &amp; Branch</th>
                <th className="py-space-sm px-space-md font-semibold">Commit SHA &amp; Details</th>
                <th className="py-space-sm px-space-md font-semibold">Environment</th>
                <th className="py-space-sm px-space-md font-semibold">Status</th>
                <th className="py-space-sm px-space-md font-semibold">Initiator</th>
                <th className="py-space-sm px-space-md font-semibold">Duration &amp; Age</th>
                <th className="py-space-sm px-space-md font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-on-surface font-body-sm text-body-sm divide-y divide-surface-container-low">
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
                      <div className="flex items-center gap-space-xxs text-on-surface-variant font-label-sm text-label-sm mt-0.5">
                        <span className="material-symbols-outlined text-[12px]">fork_right</span>
                        <span className="font-code-inline">{dep.branch}</span>
                      </div>
                    </div>
                  </td>

                  <td className="py-space-md px-space-md">
                    <div className="flex flex-col max-w-[220px]">
                      <div className="flex items-center gap-1 font-label-sm text-label-sm">
                        <span className="px-1 py-0.5 rounded bg-surface-container font-code-inline font-medium text-primary">
                          {dep.commitSha}
                        </span>
                        <span className="text-on-surface-variant">{dep.commitType}</span>
                      </div>
                      <span className="text-on-surface-variant text-body-sm truncate mt-0.5" title={dep.commitMsg}>
                        {dep.commitMsg}
                      </span>
                    </div>
                  </td>

                  <td className="py-space-md px-space-md">
                    <span className="inline-flex items-center px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm">
                      {dep.environment}
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
                      <div className="w-5 h-5 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-label-sm text-[10px]">
                        {dep.initiatorInitial}
                      </div>
                      <span className="font-label-md text-label-md">{dep.initiator}</span>
                    </div>
                  </td>

                  <td className="py-space-md px-space-md">
                    <div className="flex flex-col font-label-sm text-label-sm">
                      <span className="font-medium text-on-surface font-code-inline">{dep.duration}</span>
                      <span className="text-on-surface-variant">{dep.age}</span>
                    </div>
                  </td>

                  <td className="py-space-md px-space-md text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-space-xs">
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
        </div>
      </div>

      {/* SECTION 4: Audit & Safety Assurance Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col justify-between border border-surface-container-high/40">
          <div className="flex items-center gap-space-xs mb-space-xs text-primary font-headline-sm text-headline-sm">
            <span className="material-symbols-outlined text-[20px]">encrypted</span>
            <span>WORM Immutable Audit Log</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">
            All deployment transactions and automated canary thresholds are cryptographically signed to ensure non-repudiation and SOX/SOC2 compliance.
          </p>
          <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
            <span>Ledger: AWS QLDB Sync</span>
            <span className="text-primary font-medium">Valid</span>
          </div>
        </div>

        <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col justify-between border border-surface-container-high/40">
          <div className="flex items-center gap-space-xs mb-space-xs text-secondary font-headline-sm text-headline-sm">
            <span className="material-symbols-outlined text-[20px]">shield</span>
            <span>Zero-Downtime Rollback Gate</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">
            Automatic rollbacks initiate instantaneously when p99 latency breaches 250ms or 5xx error spikes exceed 0.05% for two consecutive 30-second cycles.
          </p>
          <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
            <span>Auto-Recovery: Active</span>
            <span className="text-secondary font-medium">Enforced</span>
          </div>
        </div>

        <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col justify-between border border-surface-container-high/40">
          <div className="flex items-center gap-space-xs mb-space-xs text-on-surface font-headline-sm text-headline-sm">
            <span className="material-symbols-outlined text-[20px]">info</span>
            <span>Sandboxed Sandbox Pipeline</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">
            Interactive buttons open safe read-only overlays. Destructive rollout actions require pipeline dual-key authorization.
          </p>
          <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
            <span>Telemetry Refresh: 10s</span>
            <span className="font-code-inline text-on-surface">demo-v1.2</span>
          </div>
        </div>
      </div>
    </div>
  );
};
