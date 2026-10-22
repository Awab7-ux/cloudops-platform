import React, { useState } from 'react';
import {
  activeIncidents,
  notificationChannels,
  autoRemediationPlaybooks,
  resolvedIncidents,
  IncidentItem,
} from '../data/alertsData';

export const AlertsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'playbooks' | 'channels' | 'history'>('active');
  const [incidents, setIncidents] = useState<IncidentItem[]>(activeIncidents);
  const [selectedIncident, setSelectedIncident] = useState<IncidentItem | null>(null);
  const [ackNotice, setAckNotice] = useState<string | null>(null);
  const [runningPlaybookId, setRunningPlaybookId] = useState<string | null>(null);

  const handleAcknowledge = (id: string) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, status: 'Investigating' as const } : inc))
    );
    setAckNotice(`Incident ${id} marked as Acknowledged. Responders paged.`);
    setTimeout(() => setAckNotice(null), 4000);
  };

  const handleResolve = (id: string) => {
    setIncidents((prev) => prev.filter((inc) => inc.id !== id));
    setAckNotice(`Incident ${id} marked as Resolved.`);
    setTimeout(() => setAckNotice(null), 4000);
  };

  const handleRunPlaybook = (id: string, name: string) => {
    setRunningPlaybookId(id);
    setTimeout(() => {
      setRunningPlaybookId(null);
      setAckNotice(`Playbook "${name}" executed successfully across cluster.`);
      setTimeout(() => setAckNotice(null), 4000);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Incidents &amp; Alerts</h1>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Demo data
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time anomaly detection, automated remediation workflows, and PagerDuty alert escalation matrix.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            {incidents.length} Active Incident{incidents.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Notification Toast */}
      {ackNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between shadow-xs transition-all">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
            <span className="font-medium">{ackNotice}</span>
          </div>
          <button onClick={() => setAckNotice(null)} className="text-emerald-600 hover:text-emerald-900">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Tabs */}
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
            Active Incidents ({incidents.length})
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
            Auto-Remediation Playbooks ({autoRemediationPlaybooks.length})
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
            Notification Channels ({notificationChannels.length})
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
            Resolved History ({resolvedIncidents.length})
          </button>
        </nav>
      </div>

      {/* Tab 1: Active Incidents */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {incidents.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
              <span className="material-symbols-outlined text-5xl text-emerald-500 mb-3 block">verified</span>
              <h3 className="text-base font-semibold text-slate-900">All Systems Operational</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                No firing alerts or open incidents at this time. All microservice thresholds are within nominal bounds.
              </p>
              <button
                onClick={() => setIncidents(activeIncidents)}
                className="mt-4 px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Reset Demo Incidents
              </button>
            </div>
          ) : (
            incidents.map((incident) => (
              <div
                key={incident.id}
                className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        incident.severity === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : 'bg-amber-50 text-amber-600 border border-amber-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[22px]">
                        {incident.severity === 'CRITICAL' ? 'crisis_alert' : 'warning'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-900">{incident.id}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                            incident.severity === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          {incident.severity}
                        </span>
                        <span className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-medium">
                          {incident.service}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          Demo data
                        </span>
                      </div>

                      <h3 className="text-base font-semibold text-slate-900 mt-1">{incident.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{incident.summary}</p>
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center gap-2 self-end lg:self-center">
                    <button
                      onClick={() => setSelectedIncident(incident)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Inspect Timeline
                    </button>
                    {incident.status === 'Firing' && (
                      <button
                        onClick={() => handleAcknowledge(incident.id)}
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-xs"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => handleResolve(incident.id)}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
                    >
                      Resolve Incident
                    </button>
                  </div>
                </div>

                {/* Sub-panel details */}
                <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block">Trigger Value</span>
                    <span className="font-mono font-bold text-rose-600 mt-0.5 block">{incident.triggerValue}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Threshold Target</span>
                    <span className="font-mono font-medium text-slate-700 mt-0.5 block">{incident.threshold}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Duration / Ongoing</span>
                    <span className="font-mono font-medium text-slate-700 mt-0.5 block">{incident.duration}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Assigned Responders</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {incident.responders.map((r) => (
                        <span key={r} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Playbooks */}
      {activeTab === 'playbooks' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {autoRemediationPlaybooks.map((playbook) => (
            <div key={playbook.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-semibold text-slate-400">{playbook.id}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-medium">
                    {playbook.status}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{playbook.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{playbook.description}</p>

                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Trigger Alert:</span>
                    <span className="font-mono text-slate-700 font-semibold">{playbook.trigger}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Target Namespace:</span>
                    <span className="font-mono text-slate-700">{playbook.targetNamespace}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Success Rate:</span>
                    <span className="font-semibold text-emerald-600">{playbook.successRate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Invocations:</span>
                    <span className="font-mono text-slate-700">{playbook.executionCount}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Demo data</span>
                <button
                  onClick={() => handleRunPlaybook(playbook.id, playbook.name)}
                  disabled={runningPlaybookId === playbook.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[14px] ${runningPlaybookId === playbook.id ? 'animate-spin' : ''}`}>
                    {runningPlaybookId === playbook.id ? 'refresh' : 'play_arrow'}
                  </span>
                  {runningPlaybookId === playbook.id ? 'Executing...' : 'Dry-Run Test'}
                </button>
              </div>
            </div>
          ))}
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
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">Demo data</span>
          </div>

          <div className="divide-y divide-slate-100 text-sm">
            {notificationChannels.map((ch) => (
              <div key={ch.name} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <span className="material-symbols-outlined text-[18px]">cell_tower</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{ch.name}</span>
                      <span className="text-xs px-2 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">{ch.type}</span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{ch.target}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right hidden sm:block">
                    <span className="text-slate-400 block text-[11px]">Last Ping</span>
                    <span className="text-slate-600 font-mono">{ch.lastPing}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                    {ch.status}
                  </span>
                  <button
                    onClick={() => {
                      setAckNotice(`Test ping sent to ${ch.name} (Response: 200 OK)`);
                      setTimeout(() => setAckNotice(null), 3000);
                    }}
                    className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 hover:bg-slate-100 text-slate-700"
                  >
                    Test Ping
                  </button>
                </div>
              </div>
            ))}
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
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">Demo data</span>
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
                {resolvedIncidents.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-slate-900">{item.id}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900">{item.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.resolution}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-700">
                        {item.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-700">{item.duration}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-500">{item.resolvedAt}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Resolved
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Incident Timeline Drawer/Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono font-semibold text-rose-600 uppercase">
                  {selectedIncident.id} &bull; Timeline &bull; Demo data
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{selectedIncident.title}</h3>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Event Progression</h4>
              <div className="space-y-3 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {selectedIncident.timeline.map((event, i) => (
                  <div key={i} className="relative text-xs">
                    <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white" />
                    <div className="font-mono text-slate-400 text-[11px]">{event.time}</div>
                    <div className="text-slate-800 font-medium mt-0.5">{event.event}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleResolve(selectedIncident.id);
                  setSelectedIncident(null);
                }}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
              >
                Mark as Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
