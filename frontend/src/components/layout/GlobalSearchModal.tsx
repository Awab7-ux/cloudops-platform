import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listApplications } from '../../api/applications';
import { listAlerts } from '../../api/alerts';
import { getSummary } from '../../api/summary';
import type { AlertRecord, Application, RecentFailedDeployment } from '../../api/types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [applications, setApplications] = useState<Application[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [recentFailedDeployments, setRecentFailedDeployments] = useState<RecentFailedDeployment[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    setLoading(true);
    void Promise.all([
      listApplications({ limit: 200, offset: 0 }).catch(() => null),
      listAlerts({ limit: 200, offset: 0 }).catch(() => null),
      getSummary().catch(() => null),
    ]).then(([applicationPage, alertPage, summary]) => {
      if (!active) return;
      setApplications(applicationPage?.items ?? []);
      setAlerts(alertPage?.items ?? []);
      setRecentFailedDeployments(summary?.recent_failed_deployments ?? []);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  const filteredApplications = applications.filter(
    application => application.name.toLowerCase().includes(q)
      || (application.description?.toLowerCase().includes(q) ?? false)
  );

  const filteredDeployments = recentFailedDeployments.filter(
    deployment => deployment.id.toLowerCase().includes(q)
      || deployment.application_name.toLowerCase().includes(q)
      || (deployment.commit_sha?.toLowerCase().includes(q) ?? false)
  );

  const filteredAlerts = alerts.filter(
    alert => alert.id.toLowerCase().includes(q)
      || alert.message.toLowerCase().includes(q)
      || alert.application_name.toLowerCase().includes(q)
  );

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-inverse-surface/40 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden border border-surface-container-high animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-space-md py-space-sm border-b border-surface-container-high bg-surface-container-low/40">
          <span className="material-symbols-outlined text-primary text-[22px] mr-2">search</span>
          <input
            autoFocus
            type="text"
            className="w-full bg-transparent text-on-surface placeholder:text-on-surface-variant font-body-md text-body-md focus:outline-none"
            placeholder="Search applications, recent failed deployments, or alerts..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-[11px] uppercase">
            ESC
          </kbd>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-space-sm divide-y divide-surface-container-high/40">
          {loading && <p role="status" className="p-space-md text-center text-on-surface-variant">Loading backend records…</p>}

          {/* Applications */}
          {filteredApplications.length > 0 && (
            <div className="py-space-xs">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase px-2 mb-1 block">
                Applications ({filteredApplications.length})
              </span>
              {filteredApplications.slice(0, 4).map(application => (
                <button
                  key={application.id}
                  onClick={() => handleSelect(`/applications/${application.id}`)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">hub</span>
                    <span className="font-headline-sm text-body-md text-on-surface">{application.name}</span>
                  </div>
                  <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container text-on-surface">
                    {application.environment}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Deployments */}
          {filteredDeployments.length > 0 && (
            <div className="py-space-xs">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase px-2 mb-1 block">
                Deployments ({filteredDeployments.length})
              </span>
              {filteredDeployments.slice(0, 3).map(dep => (
                <button
                  key={dep.id}
                  onClick={() => handleSelect(`/deployments/${dep.id}`)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-secondary">rocket_launch</span>
                    <span className="font-code-inline text-primary font-medium">{dep.id}</span>
                    <span className="font-body-sm text-on-surface">{dep.application_name}</span>
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Failed</span>
                </button>
              ))}
            </div>
          )}

          {/* Active Incidents */}
          {filteredAlerts.length > 0 && (
            <div className="py-space-xs">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase px-2 mb-1 block">
                Incidents &amp; Alerts ({filteredAlerts.length})
              </span>
              {filteredAlerts.map(alert => (
                <button
                  key={alert.id}
                  onClick={() => handleSelect('/alerts')}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-error">crisis_alert</span>
                    <span className="font-code-inline text-error font-medium">{alert.id}</span>
                    <span className="font-body-sm text-on-surface truncate max-w-sm">{alert.message}</span>
                  </div>
                  <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-bold">
                    {alert.severity}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!loading && filteredApplications.length === 0 &&
            filteredDeployments.length === 0 &&
            filteredAlerts.length === 0 && (
              <div className="p-space-xl text-center text-on-surface-variant font-body-sm">
                No matching backend applications, recent failed deployments, or alerts for &ldquo;{query}&rdquo;.
              </div>
            )}
        </div>

        {/* Modal Footer */}
        <div className="px-space-md py-space-xs bg-surface-container-low border-t border-surface-container-high flex items-center justify-between text-on-surface-variant font-label-sm text-[11px]">
          <span>Navigation: Overview, Applications, Deployments, Infrastructure, Monitoring, Logs, Settings</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
};
