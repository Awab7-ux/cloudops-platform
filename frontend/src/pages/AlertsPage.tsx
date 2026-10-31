import React, { useEffect, useState } from 'react';
import { listAlerts } from '../api/alerts';
import type { AlertRecord } from '../api/types';

export const AlertsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'playbooks' | 'channels' | 'history'>('active');
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [alertsState, setAlertsState] = useState<'loading' | 'success' | 'error'>('loading');
  const [alertsError, setAlertsError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selectedIncident, setSelectedIncident] = useState<AlertRecord | null>(null);

  useEffect(() => {
    let active = true;
    setAlertsState('loading');
    setAlertsError('');
    void listAlerts({ limit: 200, offset: 0 })
      .then(result => {
        if (!active) return;
        setAlerts(result.items);
        setAlertsState('success');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAlerts([]);
        setAlertsError(error instanceof Error ? error.message : 'Unable to load alerts.');
        setAlertsState('error');
      });
    return () => { active = false; };
  }, [refresh]);

  const alertCountLabel = alertsState === 'loading'
    ? 'Loading…'
    : alertsState === 'error'
      ? 'Unavailable'
      : String(alerts.length);
  const visibleAlerts = alerts;
  const alertTitle = (alert: AlertRecord) => ({
    deployment_failed: 'Deployment failed',
    deployment_stuck: 'Deployment stuck',
    error_log_spike: 'Error log spike',
  })[alert.type];
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Incidents &amp; Alerts</h1>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {activeTab === 'active'
                ? alertsState === 'success' ? 'Live API' : alertsState === 'loading' ? 'Loading…' : 'Unavailable'
                : 'Unavailable'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Current alerts are derived from backend records. Playbooks, notification channels, and incident history are not provided by the backend.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            {alertCountLabel} Active Alert{alertCountLabel === '1' ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      {/* Alert views */}
      <div className="border-b border-slate-200 flex items-center justify-between">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'active'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">warning</span>
            Active Alerts ({alertCountLabel})
          </button>
          <button
            onClick={() => setActiveTab('playbooks')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'playbooks'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">smart_toy</span>
            Auto-Remediation Playbooks (Unavailable)
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'channels'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">notifications_active</span>
            Notification Channels (Unavailable)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            Resolved History (Unavailable)
          </button>
        </nav>
      </div>

      {/* Tab 1: Active Alerts */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {alertsState === 'loading' && (
            <div role="status" className="bg-white rounded-xl border border-slate-200 p-6 text-center shadow-xs">Loading alerts…</div>
          )}
          {alertsState === 'error' && (
            <div role="alert" className="bg-white rounded-xl border border-slate-200 p-6 text-center shadow-xs">
              <p className="text-sm text-rose-700">{alertsError}</p>
              <button
                type="button"
                onClick={() => setRefresh(value => value + 1)}
                className="mt-4 px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >Retry</button>
            </div>
          )}
          {alertsState === 'success' && visibleAlerts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
              <span className="material-symbols-outlined text-5xl text-emerald-500 mb-3 block">verified</span>
              <h3 className="text-base font-semibold text-slate-900">All Systems Operational</h3>
              <p className="text-sm text-slate-500 mt-1">No Alerts Returned</p>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                The backend returned no active alerts.
              </p>
            </div>
          ) : alertsState === 'success' ? (
            visibleAlerts.map((incident) => {
              return (
              <div
                key={incident.id}
                className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        incident.severity === 'high'
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : 'bg-amber-50 text-amber-600 border border-amber-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[22px]">
                        {incident.severity === 'high' ? 'crisis_alert' : 'warning'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-900">{incident.id}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                            incident.severity === 'high'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          {incident.severity}
                        </span>
                        <span className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-medium">
                          {incident.application_name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          Live API
                        </span>
                      </div>

                      <h3 className="text-base font-semibold text-slate-900 mt-1">{alertTitle(incident)}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{incident.message}</p>
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center gap-2 self-end lg:self-center">
                    <button
                      onClick={() => setSelectedIncident(incident)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      View Alert Details
                    </button>
                    <button
                      type="button"
                      disabled
                      aria-label="Acknowledge alert unavailable"
                      title="The backend does not support alert acknowledgement."
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
                    >
                      Acknowledge unavailable
                    </button>
                    <button
                      type="button"
                      disabled
                      aria-label="Resolve alert unavailable"
                      title="Alerts are derived from current backend state and cannot be resolved through the API."
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
                    >
                      Resolve unavailable
                    </button>
                  </div>
                </div>

                {/* Sub-panel details */}
                <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block">Alert Type</span>
                    <span className="font-mono font-medium text-slate-700 mt-0.5 block">{incident.type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Application</span>
                    <span className="font-medium text-slate-700 mt-0.5 block">{incident.application_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Since</span>
                    <time className="font-mono font-medium text-slate-700 mt-0.5 block" dateTime={incident.since}>
                      {new Date(incident.since).toLocaleString()}
                    </time>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Deployment ID</span>
                    <span className="font-mono font-medium text-slate-700 mt-0.5 block">{incident.deployment_id ?? 'Not associated'}</span>
                  </div>
                </div>
              </div>
              );
            })
          ) : null}
        </div>
      )}

      {/* Tab 2: Playbooks */}
      {activeTab === 'playbooks' && (
        <div role="status" className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-xs">
          <h3 className="text-sm font-semibold text-slate-900">Playbooks unavailable</h3>
          <p className="text-sm text-slate-500 mt-1">The backend does not provide remediation playbooks or execution controls.</p>
        </div>
      )}

      {/* Tab 3: Notification Channels */}
      {activeTab === 'channels' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Incident Escalation &amp; Dispatch Endpoints</h3>
              <p className="text-xs text-slate-500 mt-0.5">Integrations connected to alertmanager for on-call notification routing.</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">Unavailable</span>
          </div>

          <div className="p-8 text-center text-sm text-slate-500">
            Notification channels and test-ping actions are not provided by the backend.
          </div>
        </div>
      )}

      {/* Tab 4: Resolved Incidents History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Resolved Incident Ledger (Last 30 Days)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Post-mortem tracked incidents and calculated Mean Time to Recovery (MTTR).</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">Unavailable</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Incident ID</th>
                  <th className="px-4 py-3">Title &amp; Root Cause</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">MTTR</th>
                  <th className="px-4 py-3">Resolved At</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    The backend provides current derived alerts only; resolved incident history is unavailable.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Incident Timeline Drawer/Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="alert-detail-title" className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono font-semibold text-rose-600 uppercase">
                  {selectedIncident.id} &bull; Alert Details &bull; Live API
                </span>
                <h3 id="alert-detail-title" className="text-base font-bold text-slate-900 mt-1">{alertTitle(selectedIncident)}</h3>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Backend alert data</h4>
              <div className="space-y-2 text-sm">
                <p>{selectedIncident.message}</p>
                <p className="text-slate-500">Application: {selectedIncident.application_name}</p>
                <p className="text-slate-500">Severity: {selectedIncident.severity}</p>
                <p className="text-slate-500">Type: {selectedIncident.type}</p>
                <p className="text-slate-500">Deployment: {selectedIncident.deployment_id ?? 'Not associated'}</p>
                <time className="block text-slate-500" dateTime={selectedIncident.since}>
                  Since {new Date(selectedIncident.since).toLocaleString()}
                </time>
              </div>
              <p className="text-xs text-slate-500">The backend does not provide alert timeline events or responder records.</p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
