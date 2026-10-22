import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useApi } from '../../context/ApiContext.tsx';
import { GlobalSearchModal } from './GlobalSearchModal.tsx';

export const Header: React.FC = () => {
  const { health, isProbing, refreshProbes } = useApi();
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Generate breadcrumb items
  const path = location.pathname;
  let sectionName = 'Overview';
  let parentName = 'Dashboard';

  if (path.startsWith('/applications')) {
    parentName = 'Dashboard';
    sectionName = path === '/applications' ? 'Applications' : 'Application Details';
  } else if (path.startsWith('/deployments')) {
    parentName = 'Dashboard';
    sectionName = path === '/deployments' ? 'Deployments' : 'Deployment Details';
  } else if (path === '/infrastructure') {
    parentName = 'CloudOps / Infrastructure';
    sectionName = 'Production Cluster';
  } else if (path === '/monitoring') {
    parentName = 'Dashboard';
    sectionName = 'Monitoring & Service Health';
  } else if (path === '/alerts') {
    parentName = 'Dashboard';
    sectionName = 'Alerts & Incidents';
  } else if (path === '/logs') {
    parentName = 'Dashboard';
    sectionName = 'Operational Logs';
  } else if (path === '/settings') {
    parentName = 'Dashboard';
    sectionName = 'Platform Settings';
  }

  const isConnected = health.status === 'success';

  return (
    <>
      <header className="fixed top-0 left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high/60 shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-gutter select-none">
        {/* Left: Breadcrumbs & Search input */}
        <div className="flex items-center gap-space-md min-w-0">
          <div className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-primary">cloud_done</span>
            <span>{parentName}</span>
            <span>/</span>
            <span className="font-headline-sm text-headline-sm text-on-surface truncate">
              {sectionName}
            </span>
          </div>

          <div
            className="relative hidden xl:block w-72 cursor-pointer"
            onClick={() => setIsSearchOpen(true)}
          >
            <span className="material-symbols-outlined absolute left-space-sm top-2.5 text-[18px] text-on-surface-variant">
              search
            </span>
            <input
              readOnly
              className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm pl-8 pr-space-sm py-space-xs rounded-lg shadow-[0_1px_8px_rgba(0,0,0,0.04)] cursor-pointer focus:outline-none"
              placeholder="Search pods, metrics... [Ctrl+K]"
              type="text"
            />
          </div>
        </div>

        {/* Right: API probe status, Refresh button, Notifications, User profile */}
        <div className="flex items-center gap-space-md">
          {/* Live API Health Badge */}
          <Link
            to="/settings"
            title={
              isConnected
                ? `Connected to ${health.data?.service || 'FastAPI'} (RTT: ${health.rttMs}ms)`
                : health.error || 'API Offline'
            }
            className="hidden md:flex items-center gap-space-xs px-space-sm py-space-xs rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm hover:bg-surface-container transition-colors"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isProbing
                  ? 'bg-tertiary animate-ping'
                  : isConnected
                  ? 'bg-primary animate-pulse'
                  : 'bg-error'
              }`}
            ></span>
            <span>
              {isProbing
                ? 'API: Probing...'
                : isConnected
                ? `API: Healthy • ${health.rttMs || 18}ms`
                : 'API: Disconnected (Local:8000)'}
            </span>
          </Link>

          {/* Refresh Status Button */}
          <button
            type="button"
            onClick={() => refreshProbes()}
            disabled={isProbing}
            className="flex items-center gap-space-xxs px-space-sm py-space-xs rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high hover:text-on-surface font-body-sm text-body-sm shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-colors active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <span
              className={`material-symbols-outlined text-[16px] text-primary ${
                isProbing ? 'animate-spin' : ''
              }`}
            >
              refresh
            </span>
            <span className="hidden sm:inline">Refresh Status</span>
          </button>

          {/* Notifications Icon & Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-space-xs rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer"
              title="View Alerts"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-on-error font-label-sm text-[10px] font-bold">
                2
              </span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest rounded-xl shadow-2xl border border-surface-container-high z-50 p-space-sm animate-in fade-in duration-100">
                <div className="flex items-center justify-between pb-2 border-b border-surface-container-high px-2">
                  <span className="font-headline-sm text-headline-sm text-on-surface">Active Alerts</span>
                  <Link
                    to="/alerts"
                    onClick={() => setShowNotifications(false)}
                    className="font-label-sm text-label-sm text-primary hover:underline"
                  >
                    View All
                  </Link>
                </div>
                <div className="divide-y divide-surface-container-low text-body-sm">
                  <div className="p-2 hover:bg-surface-container-low rounded-lg transition-colors">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-error text-on-error">CRITICAL</span>
                      <span className="font-label-sm text-[11px] text-on-surface-variant">24m ago</span>
                    </div>
                    <p className="font-headline-sm text-body-sm text-on-surface">Worker Queue Redis Pool Exhaustion</p>
                    <p className="text-on-surface-variant text-[11px]">Source: celery-worker / redis-cache:6379</p>
                  </div>
                  <div className="p-2 hover:bg-surface-container-low rounded-lg transition-colors">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-surface-container-highest text-on-surface">HIGH</span>
                      <span className="font-label-sm text-[11px] text-on-surface-variant">42m ago</span>
                    </div>
                    <p className="font-headline-sm text-body-sm text-on-surface">Ingress 5xx Error Rate Exceeded 0.05%</p>
                    <p className="text-on-surface-variant text-[11px]">Canary rolled back automatically</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar */}
          <div className="flex items-center gap-space-sm pl-space-xs">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
            <div className="hidden lg:flex flex-col items-start min-w-0">
              <span className="font-headline-sm text-headline-sm text-on-surface leading-tight">
                DevOps Engineer
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant leading-tight truncate max-w-[140px]">
                demo@cloudops.internal
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Global Search Dialog */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
