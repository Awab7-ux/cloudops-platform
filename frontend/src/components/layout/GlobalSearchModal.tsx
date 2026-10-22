import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SERVICES_LIST } from '../../data/servicesData.ts';
import { DEPLOYMENTS_LIST } from '../../data/deploymentsData.ts';
import { INFRA_NODES } from '../../data/infrastructureData.ts';
import { ACTIVE_INCIDENTS } from '../../data/alertsData.ts';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
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

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  const filteredServices = SERVICES_LIST.filter(
    s => s.name.toLowerCase().includes(q) || s.namespace.toLowerCase().includes(q) || s.port.includes(q)
  );

  const filteredDeployments = DEPLOYMENTS_LIST.filter(
    d => d.id.toLowerCase().includes(q) || d.app.toLowerCase().includes(q) || d.commitSha.toLowerCase().includes(q)
  );

  const filteredNodes = INFRA_NODES.filter(
    n => n.name.toLowerCase().includes(q) || n.zone.toLowerCase().includes(q) || n.ip.includes(q)
  );

  const filteredAlerts = ACTIVE_INCIDENTS.filter(
    a => a.id.toLowerCase().includes(q) || a.title.toLowerCase().includes(q)
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
            placeholder="Search microservices, deployments, pods, nodes, or alerts..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-[11px] uppercase">
            ESC
          </kbd>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-space-sm divide-y divide-surface-container-high/40">
          {/* Microservices */}
          {filteredServices.length > 0 && (
            <div className="py-space-xs">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase px-2 mb-1 block">
                Microservices ({filteredServices.length})
              </span>
              {filteredServices.slice(0, 4).map(srv => (
                <button
                  key={srv.id}
                  onClick={() => handleSelect(`/applications/${srv.id}`)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">hub</span>
                    <span className="font-headline-sm text-body-md text-on-surface">{srv.name}</span>
                    <span className="font-code-inline text-code-inline text-on-surface-variant">:{srv.port}</span>
                  </div>
                  <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container text-on-surface">
                    {srv.environment}
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
                    <span className="font-body-sm text-on-surface">{dep.app}</span>
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{dep.status}</span>
                </button>
              ))}
            </div>
          )}

          {/* Infrastructure Nodes */}
          {filteredNodes.length > 0 && (
            <div className="py-space-xs">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase px-2 mb-1 block">
                Cluster Nodes ({filteredNodes.length})
              </span>
              {filteredNodes.slice(0, 3).map(node => (
                <button
                  key={node.name}
                  onClick={() => handleSelect('/infrastructure')}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">dns</span>
                    <span className="font-code-inline text-on-surface font-medium">{node.name}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">({node.zone})</span>
                  </div>
                  <span className="font-label-sm text-label-sm text-primary font-semibold">{node.status}</span>
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
                    <span className="font-body-sm text-on-surface truncate max-w-sm">{alert.title}</span>
                  </div>
                  <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-bold">
                    {alert.severity}
                  </span>
                </button>
              ))}
            </div>
          )}

          {filteredServices.length === 0 &&
            filteredDeployments.length === 0 &&
            filteredNodes.length === 0 &&
            filteredAlerts.length === 0 && (
              <div className="p-space-xl text-center text-on-surface-variant font-body-sm">
                No matching microservices, pods, or deployments found for &ldquo;{query}&rdquo;.
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
