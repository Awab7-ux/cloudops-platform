import React from 'react';

export const InfrastructurePage: React.FC = () => (
  <div className="space-y-6">
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Infrastructure Overview</h1>
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          Backend integration unavailable
        </span>
      </div>
      <p className="text-sm text-slate-500 mt-1">
        The frontend backend does not expose Kubernetes nodes, storage claims, or Terraform state.
      </p>
    </div>

    <div role="status" className="rounded-xl border border-slate-200 bg-white p-8 shadow-xs">
      <h2 className="text-base font-semibold text-slate-900">Cluster inventory is not available</h2>
      <p className="mt-2 text-sm text-slate-600">
        No live node, pod, availability-zone, or storage data is shown here. Review the existing cluster with kubectl and Terraform with the local Terraform state.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[
        ['Kubernetes nodes', 'Node readiness and capacity are not exposed by the backend.'],
        ['Persistent storage', 'PVC, PV, and mount state are not exposed by the backend.'],
        ['Terraform resources', 'Terraform state is local and is not exposed to the browser.'],
      ].map(([title, description]) => (
        <section key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        </section>
      ))}
    </div>
  </div>
);