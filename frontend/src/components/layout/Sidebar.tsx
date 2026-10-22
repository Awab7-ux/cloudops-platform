import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useApi } from '../../context/ApiContext.tsx';

const CLOUDOPS_LOGO = "https://lh3.googleusercontent.com/aida/AEtjO1U7e4_vnJ2MRRyDZ03tkDYL2C-GIAMTTZcrrRezZJS-wlyiGZMmtyhS-2f0qLIrAAS-BRQ-N3Gn0YOZUOne5Mxy2ZPorTwL31868euAS8yaAQNG93nlVfV3tfPfqLr-LkFZtJ-rlbD6gqaKp1Y4l2IBLcImxT-BMlQxo3zxsCdWQueIfBSxtrvbW9Ho9OoyTLomSkxqpOOlGFKgA5mktyRmL7uZh84mUGXgx3FHpuGkhVvTgLVvAgaTUiIS";

export const Sidebar: React.FC = () => {
  const { health, version, isProbing, refreshProbes } = useApi();
  const location = useLocation();

  const isConnected = health.status === 'success';
  const isError = health.status === 'error';

  return (
    <aside className="fixed left-0 top-0 h-full w-72 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex flex-col justify-between border-r border-surface-container-high/60 select-none">
      <div className="flex flex-col min-h-0">
        {/* Brand Header */}
        <div className="h-16 px-space-lg flex items-center gap-space-sm bg-surface-container-lowest shrink-0 border-b border-surface-container-high/60">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-[20px]">cloud_sync</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-headline-sm text-headline-sm text-on-surface truncate">
              CloudOps Platform
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
              Cloud Infrastructure &amp; Ops
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="px-space-md py-space-sm overflow-y-auto">
          <nav className="flex flex-col gap-space-xs">
            {/* Overview */}
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center justify-between px-space-md py-space-sm rounded-lg transition-colors ${
                  isActive || location.pathname === '/overview'
                    ? 'bg-primary-container text-on-primary-container font-headline-sm shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-[20px]">grid_view</span>
                <span className="font-body-md text-body-md">Overview</span>
              </div>
            </NavLink>

            {/* Applications */}
            <NavLink
              to="/applications"
              className={({ isActive }) =>
                `flex items-center justify-between px-space-md py-space-sm rounded-lg transition-colors ${
                  isActive && location.pathname === '/applications'
                    ? 'bg-primary-container text-on-primary-container font-headline-sm shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-[20px]">layers</span>
                <span className="font-body-md text-body-md">Applications</span>
              </div>
            </NavLink>

            {/* Application Details sub-item */}
            <NavLink
              to="/applications/auth-service"
              className={({ isActive }) =>
                `flex items-center justify-between px-space-md py-space-xs rounded-lg transition-colors pl-space-xl text-body-sm ${
                  isActive
                    ? 'bg-primary-container/90 text-on-primary-container font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              <span className="truncate">Application Details</span>
              <span className="px-space-xs py-space-xxs rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-[10px]">
                App
              </span>
            </NavLink>

            {/* Deployments */}
            <NavLink
              to="/deployments"
              className={({ isActive }) =>
                `flex items-center justify-between px-space-md py-space-sm rounded-lg transition-colors ${
                  isActive && location.pathname === '/deployments'
                    ? 'bg-primary-container text-on-primary-container font-headline-sm shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                <span className="font-body-md text-body-md">Deployments</span>
              </div>
            </NavLink>

            {/* Deployment Details sub-item */}
            <NavLink
              to="/deployments/dep-9842f1"
              className={({ isActive }) =>
                `flex items-center justify-between px-space-md py-space-xs rounded-lg transition-colors pl-space-xl text-body-sm ${
                  isActive
                    ? 'bg-primary-container/90 text-on-primary-container font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              <span className="truncate">Deployment Details</span>
              <span className="px-space-xs py-space-xxs rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-[10px]">
                CI/CD
              </span>
            </NavLink>

            {/* Infrastructure */}
            <NavLink
              to="/infrastructure"
              className={({ isActive }) =>
                `flex items-center justify-between px-space-md py-space-sm rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-headline-sm shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-[20px]">dns</span>
                <span className="font-body-md text-body-md">Infrastructure</span>
              </div>
              <span className="px-space-xs py-space-xxs rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">
                Demo
              </span>
            </NavLink>

            {/* Monitoring & Service Health */}
            <NavLink
              to="/monitoring"
              className={({ isActive }) =>
                `flex items-center justify-between px-space-md py-space-sm rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-headline-sm shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-[20px]">monitoring</span>
                <span className="font-body-md text-body-md">Monitoring</span>
              </div>
            </NavLink>

            {/* Alerts & Incidents */}
            <NavLink
              to="/alerts"
              className={({ isActive }) =>
                `flex items-center justify-between px-space-md py-space-sm rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-headline-sm shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-[20px]">crisis_alert</span>
                <span className="font-body-md text-body-md">Alerts &amp; Incidents</span>
              </div>
              <span className="px-space-xs py-space-xxs rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                2 Active
              </span>
            </NavLink>

            {/* Logs */}
            <NavLink
              to="/logs"
              className={({ isActive }) =>
                `flex items-center justify-between px-space-md py-space-sm rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-headline-sm shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-[20px]">terminal</span>
                <span className="font-body-md text-body-md">Logs</span>
              </div>
            </NavLink>

            {/* Settings */}
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center justify-between px-space-md py-space-sm rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-headline-sm shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-[20px]">settings</span>
                <span className="font-body-md text-body-md">Settings</span>
              </div>
            </NavLink>
          </nav>
        </div>
      </div>

      {/* Bottom API Connectivity Footer */}
      <div className="p-space-md flex flex-col gap-space-xs bg-surface-container-low shrink-0 border-t border-surface-container-high/60">
        <button
          type="button"
          onClick={() => refreshProbes()}
          title="Click to re-probe backend API"
          className="flex items-center justify-between gap-space-xs px-space-sm py-space-xs rounded-full bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] hover:bg-surface-container-high transition-colors text-left"
        >
          <div className="flex items-center gap-space-xs min-w-0">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                isProbing
                  ? 'bg-tertiary animate-ping'
                  : isConnected
                  ? 'bg-primary animate-pulse'
                  : 'bg-error'
              }`}
            ></span>
            <span className="font-label-sm text-label-sm text-on-surface truncate">
              {isProbing
                ? 'Backend API: Probing...'
                : isConnected
                ? `Backend: Connected (${version.data?.version || 'v1.2.0'})`
                : 'Backend API: Offline'}
            </span>
          </div>
          <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
            {isProbing ? 'sync' : 'refresh'}
          </span>
        </button>

        <div className="flex items-center justify-between px-space-sm pt-space-xs">
          <NavLink
            to="/settings"
            className="font-body-sm text-body-sm text-primary hover:underline flex items-center gap-space-xxs"
          >
            <span className="material-symbols-outlined text-[14px]">description</span>
            API Reference Docs
          </NavLink>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            FastAPI
          </span>
        </div>
      </div>
    </aside>
  );
};
