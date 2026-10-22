import React, { useState } from 'react';
import { useApi } from '../context/ApiContext';

export const SettingsPage: React.FC = () => {
  const {
    baseUrl,
    setBaseUrl,
    health,
    version,
    isChecking,
    refreshProbes,
    pollingInterval,
    setPollingInterval,
    chaosSpike,
    setChaosSpike,
    canaryFailure,
    setCanaryFailure,
  } = useApi();

  const [inputUrl, setInputUrl] = useState<string>(baseUrl);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [compactDensity, setCompactDensity] = useState<boolean>(false);
  const [soundAlerts, setSoundAlerts] = useState<boolean>(false);

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setBaseUrl(inputUrl);
    setSaveFeedback(`Target backend API updated to ${inputUrl}`);
    refreshProbes();
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const handleResetDefaults = () => {
    const defaultUrl = 'http://localhost:8000';
    setInputUrl(defaultUrl);
    setBaseUrl(defaultUrl);
    setChaosSpike(false);
    setCanaryFailure(false);
    setPollingInterval(10000);
    setSaveFeedback('Restored default configuration settings.');
    refreshProbes();
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Platform Configuration</h1>
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            Runtime Controls
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Configure backend API endpoints, probe health intervals, chaos fault injection, and telemetry preferences.
        </p>
      </div>

      {/* Success Notification */}
      {saveFeedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
            <span className="font-medium">{saveFeedback}</span>
          </div>
          <button onClick={() => setSaveFeedback(null)} className="text-emerald-600 hover:text-emerald-900">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* 1. Real Backend API Connection Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Backend API Endpoint Configuration</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Target URL configured via <code className="font-mono text-indigo-600">VITE_API_BASE_URL</code> (Default: <code className="font-mono">http://localhost:8000</code>).
            </p>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
            Live HTTP Target
          </span>
        </div>

        <form onSubmit={handleSaveUrl} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
                lan
              </span>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="http://localhost:8000"
                aria-label="Backend Base URL"
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
            >
              Apply &amp; Test
            </button>
            <button
              type="button"
              onClick={refreshProbes}
              disabled={isChecking}
              className="px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <span className={`material-symbols-outlined text-[18px] ${isChecking ? 'animate-spin' : ''}`}>
                sync
              </span>
              Test Connection
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Calls real endpoints <code className="font-mono">GET /health</code> and <code className="font-mono">GET /version</code>. If no backend is running at this host, the dashboard gracefully reports offline status with error feedback.
          </p>
        </form>

        {/* Live Probe Diagnostics Box */}
        <div className="mt-4 p-4 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-semibold text-slate-300">Live Probe Diagnostics</span>
            <span className="text-[10px] text-slate-500">Auto-refresh active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* GET /health */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">GET /health</span>
                <span
                  className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase ${
                    health.status === 'success'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : health.status === 'error'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : 'bg-amber-950 text-amber-400'
                  }`}
                >
                  {health.status}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Target: <span className="text-slate-300">{health.url}</span>
              </div>
              {health.responseTimeMs !== undefined && (
                <div className="text-[11px] text-slate-400">
                  Latency: <span className="text-emerald-400 font-bold">{health.responseTimeMs} ms</span>
                </div>
              )}
              {health.error && (
                <div className="text-[10px] text-rose-400 mt-1">
                  Note: Backend offline or unreachable ({health.error}). Normal when backend server is not running.
                </div>
              )}
              {health.data && (
                <pre className="text-[10px] text-emerald-300 bg-slate-900 p-2 rounded overflow-x-auto mt-1">
                  {JSON.stringify(health.data, null, 2)}
                </pre>
              )}
            </div>

            {/* GET /version */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">GET /version</span>
                <span
                  className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase ${
                    version.status === 'success'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : version.status === 'error'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : 'bg-amber-950 text-amber-400'
                  }`}
                >
                  {version.status}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Target: <span className="text-slate-300">{version.url}</span>
              </div>
              {version.responseTimeMs !== undefined && (
                <div className="text-[11px] text-slate-400">
                  Latency: <span className="text-emerald-400 font-bold">{version.responseTimeMs} ms</span>
                </div>
              )}
              {version.error && (
                <div className="text-[10px] text-rose-400 mt-1">
                  Note: Backend offline or unreachable ({version.error}).
                </div>
              )}
              {version.data && (
                <pre className="text-[10px] text-emerald-300 bg-slate-900 p-2 rounded overflow-x-auto mt-1">
                  {JSON.stringify(version.data, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Probe Polling Frequency */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Telemetry Health Polling Interval</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Frequency at which the frontend dispatches background health pings to the configured backend.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: '5 Seconds', value: 5000 },
            { label: '10 Seconds', value: 10000 },
            { label: '30 Seconds', value: 30000 },
            { label: '60 Seconds', value: 60000 },
            { label: 'Paused', value: 0 },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setPollingInterval(item.value)}
              className={`p-3 rounded-lg border text-xs font-semibold text-center transition-all ${
                pollingInterval === item.value
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Chaos Engineering & Simulation Toggles */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Demo Chaos Injection &amp; Failure Drills</h2>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">Demo data</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulate operational incidents to test SRE response, canary rollback workflows, and latency alerts.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={chaosSpike}
              onChange={(e) => setChaosSpike(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <div className="text-sm font-semibold text-slate-900">Simulate Cluster Latency Spike</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Injects an artificial 450ms p99 latency surge into metrics and telemetry graphs across the dashboard.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={canaryFailure}
              onChange={(e) => setCanaryFailure(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <div>
              <div className="text-sm font-semibold text-slate-900">Simulate Canary Rollout Breach (v2.14.0)</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Simulates 5xx error spikes on canary pods to test automatic rollback triggers and incident routing.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* 4. Display & Preference Toggles */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Display &amp; Notification Preferences</h2>
          <p className="text-xs text-slate-500 mt-0.5">Customize dashboard density and alert chime behavior.</p>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
            <div>
              <span className="text-sm font-medium text-slate-900 block">Compact Table Density</span>
              <span className="text-xs text-slate-500">Reduce vertical padding across node and service matrices</span>
            </div>
            <input
              type="checkbox"
              checked={compactDensity}
              onChange={(e) => setCompactDensity(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
            <div>
              <span className="text-sm font-medium text-slate-900 block">Critical Incident Audio Chimes</span>
              <span className="text-xs text-slate-500">Play subtle audible alert when P0 incident is triggered</span>
            </div>
            <input
              type="checkbox"
              checked={soundAlerts}
              onChange={(e) => setSoundAlerts(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>
        </div>
      </div>

      {/* 5. Reset Defaults */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleResetDefaults}
          className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
        >
          Reset All Settings to Defaults
        </button>
      </div>
    </div>
  );
};
