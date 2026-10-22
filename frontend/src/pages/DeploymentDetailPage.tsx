import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CANARY_STEPS,
  BASELINE_VS_CANARY_METRICS,
  EXECUTION_EVENTS,
} from '../data/deploymentsData.ts';

export const DeploymentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRollbackExecuted, setIsRollbackExecuted] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSimulateAbort = () => {
    setIsRollbackModalOpen(false);
    setIsRollbackExecuted(true);
    showToast('Simulation Triggered: Rollout state updated to "Aborted (Rolling Back to v2.0.4)". Canary traffic rerouted to 0% (Demo data)');
  };

  return (
    <div className="flex flex-col w-full pb-16 space-y-6 pt-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-space-md rounded-xl bg-inverse-surface text-inverse-on-surface shadow-2xl flex items-center gap-2 font-body-sm text-body-sm border border-surface-container-high animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-primary-fixed text-[20px]">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumbs & Quick Nav */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
          <Link to="/" className="hover:text-primary cursor-pointer transition-colors">
            Dashboard
          </Link>
          <span className="text-outline-variant">/</span>
          <Link to="/deployments" className="hover:text-primary cursor-pointer transition-colors">
            Deployments
          </Link>
          <span className="text-outline-variant">/</span>
          <span className="font-label-sm text-label-sm text-primary px-2 py-0.5 rounded bg-surface-container-high font-bold">
            {id || 'dep-9842f1'}
          </span>
        </div>

        {/* Quick External Resource Shortcuts */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/logs"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container transition-colors font-body-sm text-body-sm border border-surface-container-high/40"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">terminal</span>
            <span>View Release Logs</span>
          </Link>
          <button
            type="button"
            onClick={() => showToast('Inspecting commit #609d93a')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container transition-colors font-body-sm text-body-sm border border-surface-container-high/40 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-tertiary">commit</span>
            <span className="font-label-sm text-label-sm">#609d93a</span>
          </button>
          <button
            type="button"
            onClick={() => showToast('Re-evaluating canary traffic shift assertions... [Demo data]')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary shadow-sm hover:bg-primary-container transition-colors font-body-sm text-body-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>Re-evaluate Rollout</span>
          </button>
        </div>
      </div>

      {/* Primary Header & Key Info Bar */}
      <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm border border-surface-container-high/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-label-sm text-label-sm tracking-wider uppercase text-on-surface-variant font-medium">
                Progressive Delivery Pipeline
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                  isRollbackExecuted
                    ? 'bg-error-container text-on-error-container'
                    : 'bg-secondary-fixed text-on-secondary-fixed'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-secondary animate-pulse"></span>
                {isRollbackExecuted ? 'Aborted / Rolling Back' : 'In Progress (Canary 75%)'}
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                Kubernetes v1.29.3
              </span>
              <span className="px-1.5 py-0.2 rounded bg-surface-container font-label-sm text-[10px]">
                Demo data
              </span>
            </div>
            <div className="flex items-baseline gap-4">
              <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">
                Deployment {id || 'dep-9842f1'}
              </h1>
              <span className="font-label-sm text-label-sm text-on-surface-variant hidden md:inline">
                session_id: canary_rollout_09bf8
              </span>
            </div>

            {/* Metadata Pills */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-6 pt-1 font-body-sm text-body-sm text-on-surface-variant">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">layers</span>
                <span>Target:</span>
                <span className="font-label-sm text-label-sm text-on-surface font-semibold bg-surface-container px-2 py-0.5 rounded">
                  api-router:v2.1.0
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-tertiary">cloud</span>
                <span>Environment:</span>
                <span className="font-label-sm text-label-sm text-on-surface font-semibold">
                  Production-East (us-east-1a)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                  account_circle
                </span>
                <span>Initiator:</span>
                <span className="text-on-surface font-medium">alice.dev</span>
                <span className="text-outline text-xs">(via git push)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                  schedule
                </span>
                <span>Started:</span>
                <span className="font-label-sm text-label-sm text-on-surface font-semibold">
                  4m 12s ago
                </span>
              </div>
            </div>
          </div>

          {/* Quick Gauge Hero */}
          <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-xl min-w-[280px]">
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-surface-container-highest"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                ></path>
                <path
                  className="text-primary transition-all duration-1000 ease-out"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray={`${isRollbackExecuted ? 0 : 75}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                ></path>
              </svg>
              <span className="absolute font-headline-sm text-headline-sm text-on-surface">
                {isRollbackExecuted ? '0%' : '75%'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-on-surface leading-snug">
                Traffic Weight
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {isRollbackExecuted ? '0 of 8 pods upgraded (Rolled Back)' : '6 of 8 pods upgraded'}
              </span>
              <span className="font-label-sm text-label-sm text-primary font-medium mt-1">
                {isRollbackExecuted ? 'Rollback Complete' : 'Target 100% in ~2m'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Simulated Sandbox Notice */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-surface-container text-on-surface shadow-sm border border-surface-container-high/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px] text-primary">science</span>
          </div>
          <div>
            <p className="font-body-sm text-body-sm font-semibold text-on-surface">
              Audit notice: Rollout actions and live metrics are sandbox simulations for UI verification. (Demo data)
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              No physical cluster state is mutated. Simulated traffic split is handled via synthetic Istio VirtualService mocks.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center px-2 py-1 rounded bg-surface-container-lowest font-label-sm text-label-sm text-on-surface-variant">
          ENV: SANDBOX_MOCK
        </span>
      </div>

      {/* Visual Timeline Pipeline Stepper */}
      <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm space-y-6 border border-surface-container-high/40">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Rollout Progression Matrix
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Automated validation stages powered by Argo Rollouts &amp; Cosign Verification (Demo data)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2.5 py-1 rounded bg-surface-container-high text-on-surface">
              <span className="material-symbols-outlined text-[14px] text-primary">timer</span>
              Total: 2m 19s
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
          {CANARY_STEPS.map(step => (
            <div
              key={step.step}
              className={`flex flex-col p-4 rounded-xl transition-all ${
                step.status === 'active'
                  ? 'bg-surface-container shadow-md relative overflow-hidden border-t-2 border-secondary'
                  : 'bg-surface-container-low'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    step.status === 'complete'
                      ? 'bg-primary text-on-primary'
                      : step.status === 'active'
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-surface-container-highest text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {step.status === 'complete'
                      ? 'check'
                      : step.status === 'active'
                      ? 'sync'
                      : 'hourglass_empty'}
                  </span>
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">
                  {step.duration}
                </span>
              </div>
              <span className="font-label-sm text-label-sm text-primary uppercase font-bold tracking-wider">
                Step {step.step}
              </span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1 leading-snug">
                {step.title}
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                {step.description}
              </p>
              <div className="mt-4 pt-3 flex items-center gap-1 text-on-surface font-label-sm text-label-sm border-t border-surface-container-high/40">
                <span className="material-symbols-outlined text-[14px] text-primary">verified</span>
                <span>{step.badge}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dual Layout: Health Comparison & Live Events */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left 7 Cols: Telemetry Baseline vs Canary */}
        <div className="xl:col-span-7 space-y-6">
          <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm space-y-4 border border-surface-container-high/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Telemetry: Baseline vs. Canary
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Telemetry comparison across 10,000 samples per service unit (Demo data)
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container text-on-surface font-label-sm text-label-sm font-semibold">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                Telemetry Stream: Live
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-body-sm text-body-sm">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant font-semibold font-label-sm text-label-sm uppercase">
                    <th className="py-3 px-4 rounded-l-lg">Metric Name</th>
                    <th className="py-3 px-4">Stable Baseline (v2.0.4)</th>
                    <th className="py-3 px-4">Canary Candidate (v2.1.0)</th>
                    <th className="py-3 px-4 rounded-r-lg">Variance / SLA Gate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {BASELINE_VS_CANARY_METRICS.map((row, idx) => (
                    <tr key={idx} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-3.5 px-4 font-medium text-on-surface">
                        {row.metric}
                      </td>
                      <td className="py-3.5 px-4 font-label-sm text-label-sm text-on-surface-variant">
                        {row.baseline}
                      </td>
                      <td className="py-3.5 px-4 font-label-sm text-label-sm text-primary font-bold">
                        {row.canary}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-primary bg-primary-fixed px-2 py-0.5 rounded font-semibold">
                          <span className="material-symbols-outlined text-[12px]">trending_down</span>
                          {row.variance}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sparkline Visualization */}
            <div className="pt-2">
              <div className="flex items-center justify-between pb-2">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
                  Latency Distribution (Last 5 Minutes)
                </span>
                <div className="flex items-center gap-4 text-xs font-medium">
                  <span className="flex items-center gap-1 text-outline">
                    <span className="h-2 w-2 rounded-full bg-outline"></span>Stable Baseline
                  </span>
                  <span className="flex items-center gap-1 text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary"></span>Canary Candidate
                  </span>
                </div>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl">
                <svg className="w-full h-24" preserveAspectRatio="none" viewBox="0 0 500 100">
                  <line className="text-surface-container-highest" stroke="currentColor" strokeDasharray="2,2" strokeWidth="1" x1="0" x2="500" y1="20" y2="20"></line>
                  <line className="text-surface-container-highest" stroke="currentColor" strokeDasharray="2,2" strokeWidth="1" x1="0" x2="500" y1="50" y2="50"></line>
                  <line className="text-surface-container-highest" stroke="currentColor" strokeDasharray="2,2" strokeWidth="1" x1="0" x2="500" y1="80" y2="80"></line>
                  <path className="text-outline" d="M0,60 Q50,55 100,58 T200,62 T300,56 T400,64 T500,58" fill="none" stroke="currentColor" strokeWidth="2"></path>
                  <path className="text-primary" d="M0,70 Q50,65 100,62 T200,54 T300,48 T400,42 T500,38" fill="none" stroke="currentColor" strokeWidth="2.5"></path>
                </svg>
              </div>
            </div>
          </div>

          {/* Rollback Policies & Emergency Abort Trigger */}
          <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm space-y-4 border border-surface-container-high/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Rollback Automation &amp; Safety Polices
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Configured in Istio Automated Traffic Guard &amp; Argo AnalysisTemplate (Demo data)
                </p>
              </div>
              <span className="px-2 py-1 rounded bg-surface-container-high font-label-sm text-label-sm text-on-surface font-semibold">
                Active Guardrail: Strict
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface-container-low flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-[18px] text-error">notification_important</span>
                    <span className="font-headline-sm text-headline-sm text-on-surface">Error Rate Trigger</span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Auto-revert rollout to v2.0.4 if 5xx HTTP response codes exceed <strong>0.05%</strong> continuously for <strong>60 seconds</strong>.
                  </p>
                </div>
                <div className="mt-4 pt-3 flex items-center justify-between border-t border-surface-container-high/40">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Current: 0.002%</span>
                  <span className="font-label-sm text-label-sm text-primary font-bold">STATUS: OK</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-low flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-[18px] text-tertiary">timer_off</span>
                    <span className="font-headline-sm text-headline-sm text-on-surface">Latency Violation</span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Halt and roll back immediately if p99 latency spikes above <strong>60ms</strong> for 3 consecutive intervals.
                  </p>
                </div>
                <div className="mt-4 pt-3 flex items-center justify-between border-t border-surface-container-high/40">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Current: 18.2ms</span>
                  <span className="font-label-sm text-label-sm text-primary font-bold">STATUS: OK</span>
                </div>
              </div>
            </div>

            {/* Simulation Warning & Abort Trigger */}
            <div className="p-4 rounded-xl bg-surface-container flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[24px] text-error">shield</span>
                <div>
                  <div className="font-headline-sm text-headline-sm text-on-surface">
                    Simulated Disaster Recovery Trigger
                  </div>
                  <div className="font-body-sm text-body-sm text-on-surface-variant">
                    Exercise immediate canary drain and replica set rollback sequence.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRollbackModalOpen(true)}
                className="px-4 py-2 rounded-lg bg-surface-container-lowest text-error hover:bg-error-container hover:text-on-error-container transition-all font-body-sm text-body-sm font-semibold shadow-sm shrink-0 cursor-pointer"
              >
                Emergency Abort &amp; Rollback [DEMO ONLY]
              </button>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Live Execution Events Log & Pods */}
        <div className="xl:col-span-5 space-y-6">
          <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm flex flex-col h-[520px] border border-surface-container-high/40">
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Deployment Execution Events
                </h2>
                <span className="h-2 w-2 rounded-full bg-primary animate-ping"></span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                Live Socket: OK
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {EXECUTION_EVENTS.map((evt, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-surface-container-low transition-colors hover:bg-surface-container flex items-start gap-3"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">
                    alt_route
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-label-sm text-on-surface font-bold">
                        {evt.type}
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {evt.timestamp}
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      {evt.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 mt-3 bg-surface-container-low rounded-lg p-3 flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Streaming via SSE channel `ch-deploy-{id || '9842f1'}`
              </span>
              <button
                type="button"
                onClick={() => showToast('Copied all deployment events to clipboard')}
                className="font-label-sm text-label-sm text-primary hover:underline font-semibold cursor-pointer"
              >
                Copy All Logs
              </button>
            </div>
          </div>

          {/* Pod Fleet Allocation */}
          <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm space-y-3 border border-surface-container-high/40">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Pod Fleet Allocation
              </h2>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                ReplicaSet: 8 total (Demo data)
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-2">
              {[1, 2, 3, 4, 5, 6].map(num => (
                <div
                  key={num}
                  className="p-3 rounded-lg bg-surface-container text-center space-y-1"
                >
                  <span className="font-label-sm text-label-sm font-bold text-secondary">
                    pod-canary-{num}
                  </span>
                  <div className="h-2 w-2 rounded-full bg-primary mx-auto"></div>
                  <span className="font-label-sm text-[10px] text-on-surface-variant block">
                    v2.1.0
                  </span>
                </div>
              ))}
              {[7, 8].map(num => (
                <div
                  key={num}
                  className="p-3 rounded-lg bg-surface-container-low text-center space-y-1"
                >
                  <span className="font-label-sm text-label-sm font-bold text-on-surface-variant">
                    pod-stable-{num}
                  </span>
                  <div className="h-2 w-2 rounded-full bg-outline mx-auto"></div>
                  <span className="font-label-sm text-[10px] text-on-surface-variant block">
                    v2.0.4
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Abort Confirmation Modal */}
      {isRollbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-xs animate-in fade-in">
          <div className="rounded-xl bg-surface-container-lowest max-w-lg w-full p-6 shadow-2xl space-y-4 border border-surface-container-high">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-error-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-error text-[24px]">crisis_alert</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">
                  Simulate Emergency Abort?
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Sandbox verification only • No actual production interruption
                </p>
              </div>
            </div>
            <p className="font-body-md text-body-md text-on-surface">
              Executing this command will trigger a simulated instant rollback to baseline version{' '}
              <strong className="font-label-sm text-label-sm">api-router:v2.0.4</strong>, drain canary pods, and record an incident post-mortem draft.
            </p>
            <div className="p-3 rounded bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant">
              Target: <span className="text-on-surface font-semibold">Production-East / {id || 'dep-9842f1'}</span><br />
              Action: <span className="text-error font-semibold font-code-inline">kubectl argo rollouts abort api-router</span>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsRollbackModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface transition-colors font-body-sm text-body-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSimulateAbort}
                className="px-4 py-2 rounded-lg bg-error text-on-error hover:opacity-90 transition-opacity font-body-sm text-body-sm font-semibold cursor-pointer"
              >
                Confirm Simulated Abort
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
