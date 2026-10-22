import React, { useState } from 'react';
import {
  infrastructureSummaryMetrics,
  multiAzBreakdown,
  nodePools,
  storageClaims,
  terraformBlueprintSnippet,
  NodeItem,
} from '../data/infrastructureData';

export const InfrastructurePage: React.FC = () => {
  const [selectedPool, setSelectedPool] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'nodes' | 'storage' | 'blueprint'>('nodes');
  const [selectedNode, setSelectedNode] = useState<NodeItem | null>(null);
  const [copiedBlueprint, setCopiedBlueprint] = useState<boolean>(false);

  const filteredNodes = nodePools.filter((node) => {
    const matchesPool = selectedPool === 'all' || node.pool === selectedPool;
    const matchesStatus = selectedStatus === 'all' || node.status === selectedStatus;
    const matchesSearch =
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.ip.includes(searchQuery) ||
      node.zone.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPool && matchesStatus && matchesSearch;
  });

  const handleCopyBlueprint = () => {
    navigator.clipboard.writeText(terraformBlueprintSnippet);
    setCopiedBlueprint(true);
    setTimeout(() => setCopiedBlueprint(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Cluster Infrastructure</h1>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Demo data
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Physical hardware nodes, multi-AZ availability zones, persistent storage volumes, and topology provisioning.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('blueprint')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">code</span>
            Terraform Spec
          </button>
          <a
            href="#node-inventory"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">dns</span>
            Inspect Fleet ({nodePools.length} Nodes)
          </a>
        </div>
      </div>

      {/* Top Infrastructure KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {infrastructureSummaryMetrics.map((metric) => (
          <div key={metric.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">{metric.label}</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">Demo data</span>
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">{metric.value}</div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <span className="material-symbols-outlined text-[20px]">{metric.icon}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>{metric.detail}</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Normal
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Availability Zone Topology Grid */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Multi-AZ Resiliency &amp; Zone Distribution</h2>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">Demo data</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Workloads scheduled across redundant AWS us-east-1 availability zones with automated failover routing.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Cross-AZ Mesh In Sync
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {multiAzBreakdown.map((az) => (
            <div
              key={az.zone}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-600 text-[20px]">public</span>
                  <span className="font-mono text-sm font-semibold text-slate-900">{az.zone}</span>
                </div>
                <span className="text-xs px-2 py-0.5 font-medium rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {az.status}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>CPU Utilization</span>
                    <span className="font-semibold text-slate-900">{az.cpuUsage}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        az.cpuUsage > 80 ? 'bg-amber-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${az.cpuUsage}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>RAM Utilization</span>
                    <span className="font-semibold text-slate-900">{az.memoryUsage}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        az.memoryUsage > 80 ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${az.memoryUsage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-slate-500">
                  <span>Physical Nodes: <strong className="text-slate-800">{az.nodesCount}</strong></span>
                  <span>Active Pods: <strong className="text-slate-800">{az.podsCount}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Tabs: Nodes Inventory, Storage Claims, Blueprint Spec */}
      <div className="space-y-4" id="node-inventory">
        <div className="flex items-center justify-between border-b border-slate-200">
          <nav className="flex space-x-6">
            <button
              onClick={() => setActiveTab('nodes')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'nodes'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">dns</span>
              Node Fleet ({nodePools.length})
            </button>
            <button
              onClick={() => setActiveTab('storage')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'storage'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">hard_drive</span>
              Persistent Volumes ({storageClaims.length})
            </button>
            <button
              onClick={() => setActiveTab('blueprint')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'blueprint'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">code</span>
              Terraform Blueprint
            </button>
          </nav>

          <span className="text-xs text-slate-500 pb-3 hidden sm:inline">
            Status: <span className="font-semibold text-emerald-600">All 3 Pools Ready</span> (Demo data)
          </span>
        </div>

        {/* Tab 1: Nodes */}
        {activeTab === 'nodes' && (
          <div className="space-y-4">
            {/* Filter controls */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Filter nodes by name, IP, zone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select
                  value={selectedPool}
                  onChange={(e) => setSelectedPool(e.target.value)}
                  aria-label="Node Pool Filter"
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">All Pools</option>
                  <option value="compute-optimized">compute-optimized</option>
                  <option value="memory-optimized">memory-optimized</option>
                  <option value="storage-optimized">storage-optimized</option>
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  aria-label="Node Status Filter"
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">All States</option>
                  <option value="Ready">Ready</option>
                  <option value="SchedulingDisabled">SchedulingDisabled</option>
                  <option value="Warning">Warning</option>
                </select>

                {(searchQuery || selectedPool !== 'all' || selectedStatus !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedPool('all');
                      setSelectedStatus('all');
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Nodes Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3">Node Name &amp; Host</th>
                      <th className="px-4 py-3">Pool &amp; Instance</th>
                      <th className="px-4 py-3">AZ Zone</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">CPU (Cores)</th>
                      <th className="px-4 py-3">Memory (GiB)</th>
                      <th className="px-4 py-3">Pods</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredNodes.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                          <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">dns</span>
                          No nodes match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredNodes.map((node) => (
                        <tr
                          key={node.id}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                          onClick={() => setSelectedNode(node)}
                        >
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-slate-900 font-mono text-xs">{node.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{node.ip}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-700">
                              {node.pool}
                            </span>
                            <div className="text-[11px] text-slate-400 mt-0.5">{node.instanceType}</div>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-slate-600">
                            {node.zone}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                node.status === 'Ready'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  node.status === 'Ready' ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}
                              ></span>
                              {node.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span>{node.cpuUsage}%</span>
                              <span className="text-[11px] text-slate-400">/{node.cores}c</span>
                            </div>
                            <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  node.cpuUsage > 80 ? 'bg-amber-500' : 'bg-indigo-600'
                                }`}
                                style={{ width: `${node.cpuUsage}%` }}
                              ></div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span>{node.memoryUsage}%</span>
                              <span className="text-[11px] text-slate-400">/{node.memoryGiB}G</span>
                            </div>
                            <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  node.memoryUsage > 80 ? 'bg-amber-500' : 'bg-blue-600'
                                }`}
                                style={{ width: `${node.memoryUsage}%` }}
                              ></div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-700 font-medium">
                            {node.podsCount} <span className="text-slate-400 font-normal">/ 110 max</span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedNode(node);
                              }}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Storage Claims */}
        {activeTab === 'storage' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Kubernetes PersistentVolumeClaims (PVCs)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dynamic EBS CSI Driver storage claims attached to stateful pods (Demo data).
                </p>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Total Provisioned: <strong className="text-slate-900">1,950 GiB</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Claim Name</th>
                    <th className="px-4 py-3">Namespace</th>
                    <th className="px-4 py-3">Storage Class</th>
                    <th className="px-4 py-3">Capacity</th>
                    <th className="px-4 py-3">Utilization</th>
                    <th className="px-4 py-3">Access Mode</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {storageClaims.map((claim) => (
                    <tr key={claim.name} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{claim.name}</td>
                      <td className="px-4 py-3.5 text-slate-600">{claim.namespace}</td>
                      <td className="px-4 py-3.5 text-slate-500">{claim.storageClass}</td>
                      <td className="px-4 py-3.5 text-slate-800 font-medium">{claim.size}</td>
                      <td className="px-4 py-3.5 font-sans">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 rounded-full"
                              style={{ width: `${claim.usedPercentage}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-slate-600">{claim.usedPercentage}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{claim.accessMode}</td>
                      <td className="px-4 py-3.5 font-sans">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {claim.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Terraform Blueprint */}
        {activeTab === 'blueprint' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-500 text-[18px]">terminal</span>
                <span className="font-mono text-xs font-semibold text-slate-800">
                  terraform/eks-cluster-production.tf
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded font-sans">
                  Demo data
                </span>
              </div>
              <button
                onClick={handleCopyBlueprint}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {copiedBlueprint ? 'check' : 'content_copy'}
                </span>
                {copiedBlueprint ? 'Copied' : 'Copy HCL'}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono bg-slate-900 text-slate-100 overflow-x-auto leading-relaxed">
              <code>{terraformBlueprintSnippet}</code>
            </pre>
          </div>
        )}
      </div>

      {/* Node Inspector Modal / Drawer */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-medium text-indigo-600 uppercase tracking-wider">
                  Node Inspector &bull; Demo data
                </span>
                <h3 className="text-lg font-bold font-mono text-slate-900 mt-1">{selectedNode.name}</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  IP: {selectedNode.ip} &bull; Zone: {selectedNode.zone}
                </p>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500">Instance Class</span>
                <div className="text-sm font-semibold font-mono text-slate-800 mt-0.5">{selectedNode.instanceType}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500">Node Pool</span>
                <div className="text-sm font-semibold text-slate-800 mt-0.5">{selectedNode.pool}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500">CPU Usage</span>
                <div className="text-sm font-semibold text-slate-800 mt-0.5">
                  {selectedNode.cpuUsage}% of {selectedNode.cores} Cores
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500">Memory Usage</span>
                <div className="text-sm font-semibold text-slate-800 mt-0.5">
                  {selectedNode.memoryUsage}% of {selectedNode.memoryGiB} GiB
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500">Uptime:</span>{' '}
                <strong className="text-slate-800 font-mono">{selectedNode.uptime}</strong>
              </div>
              <div>
                <span className="text-slate-500">Kernel:</span>{' '}
                <strong className="text-slate-800 font-mono">{selectedNode.kernel}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedNode(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  alert(`Cordon signal sent to ${selectedNode.name} (Simulation)`);
                  setSelectedNode(null);
                }}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
              >
                Cordon &amp; Drain Node
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
