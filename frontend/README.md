# CloudOps Platform - Cloud Infrastructure & Operations Dashboard

A production-grade, highly responsive cloud infrastructure and operations management console built with React, TypeScript, Tailwind CSS, and Vite.

Designed for Site Reliability Engineers (SREs), DevOps architects, and platform teams monitoring distributed microservices, Kubernetes clusters, canary rollouts, multi-AZ cloud topologies, and incident remediation.

---

## Features

- **Executive Cluster Overview**: High-level Golden Signal metrics (cluster health, daily requests, p95 latency, error budget burn), cluster throughput graphs, node pool capacities, and real-time operational event stream.
- **Applications & Microservice Topology**: Service registry with environment filters, interactive topology dependency graph, endpoint telemetry, pod fleet inspection, and register-service modal.
- **Canary Deployments & Rollout Pipeline**: Progressive traffic stepping (10% → 25% → 50% → 100%), real-time baseline vs. canary latency and error telemetry comparison, replica pod fleet grid, and emergency rollback simulation.
- **Cluster Infrastructure & Multi-AZ**: Physical node fleet inventory (compute, memory, storage optimized), multi-AZ zone balance (us-east-1a/b/c), persistent volume claims (PVCs), and Terraform HCL blueprint inspector.
- **System Monitoring & Apdex**: Apdex score breakdown across microservices, percentile latency curves (p50 / p95 / p99), HTTP status distribution (2xx / 3xx / 4xx / 5xx), and global synthetic edge probes.
- **Incidents & Auto-Remediation**: Active alert escalation with timeline progression, one-click incident acknowledgement and resolution, automated remediation playbooks (HPA scale burst, Redis failover, pod recycle), and notification channel health pings.
- **Structured Log Stream**: High-frequency streaming logs with search syntax, severity filters, stacked ingestion rate histogram, and expandable OpenTelemetry trace/span inspect panels.
- **Live Backend API Integration**: Real-time integration with backend endpoints (`GET /health` and `GET /version`) via `VITE_API_BASE_URL` with connection testing diagnostics and graceful offline handling.
- **Demo Data Transparency**: Every simulated metric and fixture is explicitly labeled as `Demo data` across all dashboards.

---

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Routing**: React Router v7 (`react-router-dom`)
- **Styling**: Tailwind CSS v4 with custom design tokens
- **Icons & Typography**: Material Symbols Outlined, Inter, and JetBrains Mono fonts
- **Build Tool**: Vite 6+

---

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm 9.x or later

### Installation

1. Clone or extract the repository to your local environment.
2. Install dependencies:

```bash
npm install
```

### Environment Configuration

The application reads the backend base URL from the `VITE_API_BASE_URL` environment variable. By default, it falls back to `http://localhost:8000`.

To point to a custom backend or API proxy, create a `.env` file in the root directory:

```env
VITE_API_BASE_URL="http://localhost:8000"
```

The application connects to:
- `GET /health` - Returns `{ status: "ok" | "healthy", timestamp?: string }`
- `GET /version` - Returns `{ version: string, build?: string, commit?: string }`

If your backend is not yet running, the dashboard continues to function smoothly with clear visual diagnostics indicating the offline status of the live backend.

### Development Server

Start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

### Production Build

Compile and bundle the production assets:

```bash
npm run build
```

The compiled output will be generated in the `dist/` directory, ready to be hosted on any static hosting platform (Nginx, AWS S3/CloudFront, Cloudflare Pages, etc.).

### Preview Production Build

To preview the built production bundle locally:

```bash
npm run preview
```

### Unit Tests

Run the telemetry calculation test suite:

```bash
npx tsx --test src/utils/telemetry.test.ts
```

---

## Project Structure

```
├── public/                     # Static assets and design references
├── src/
│   ├── components/             # Reusable UI components
│   │   └── layout/             # Master layout, Sidebar, Header, GlobalSearchModal
│   ├── context/
│   │   └── ApiContext.tsx      # Real API provider for /health, /version, & config
│   ├── data/                   # Isolated sample data fixtures (labeled Demo data)
│   │   ├── alertsData.ts       # Incidents, playbooks, dispatch channels
│   │   ├── applicationsData.ts # Service registry, endpoints, pod replicas
│   │   ├── deploymentsData.ts  # Canary rollouts, traffic steps, audit logs
│   │   ├── infrastructureData.ts # Nodes, multi-AZ breakdown, PVCs, Terraform spec
│   │   ├── logsData.ts         # Log stream events, rate histogram, syntax filters
│   │   ├── monitoringData.ts   # Apdex scores, percentiles, HTTP status distribution
│   │   └── overviewData.ts     # Executive KPIs, throughput, activity stream
│   ├── pages/                  # Route views
│   │   ├── OverviewPage.tsx
│   │   ├── ApplicationsPage.tsx
│   │   ├── ApplicationDetailPage.tsx
│   │   ├── DeploymentsPage.tsx
│   │   ├── DeploymentDetailPage.tsx
│   │   ├── InfrastructurePage.tsx
│   │   ├── MonitoringPage.tsx
│   │   ├── AlertsPage.tsx
│   │   ├── LogsPage.tsx
│   │   └── SettingsPage.tsx
│   ├── services/
│   │   └── apiService.ts       # Live probe executor for /health and /version
│   ├── utils/
│   │   ├── apiHealth.ts        # API URL resolver and response validation
│   │   ├── telemetry.ts        # Pure calculation utilities (Apdex, latencies, etc.)
│   │   └── telemetry.test.ts   # Automated test suite
│   ├── App.tsx                 # Route router and application entry
│   ├── index.css               # Design tokens, typography styles, Tailwind setup
│   └── main.tsx                # React DOM root mounting
├── index.html                  # HTML entry point with Inter & JetBrains Mono fonts
├── package.json                # Dependencies and project scripts
├── tsconfig.json               # TypeScript configuration
└── vite.config.ts              # Vite configuration with Tailwind CSS plugin
```

---

## License

Apache-2.0
