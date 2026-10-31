# CloudOps Platform - Cloud Infrastructure & Operations Dashboard

A responsive local CloudOps dashboard built with React, TypeScript, Tailwind CSS, and Vite. Backend-supported views use live API data; unsupported cluster capabilities are shown as unavailable.

Designed for local development and operations work with the CloudOps FastAPI backend and optional Prometheus/Grafana Kubernetes monitoring stack.

---

## Features

- **Overview**: Live application, deployment, and log summaries plus `/health`, `/version`, and `/` probes. Cluster CPU, memory, and node history are shown as unavailable because the frontend has no such API.
- **Applications**: Create, list, edit, and delete application records through the backend. Application details also load deployment history and persisted application logs.
- **Deployments**: Application-scoped deployment history, record creation, and lifecycle status transitions use the backend API. These operations do not trigger Kubernetes rollouts.
- **Infrastructure**: Clearly reports that node, pod, PVC, and Terraform state are not exposed to the browser.
- **Monitoring**: Reads actual backend Prometheus metrics from `GET /metrics`. Prometheus target health, kube-state-metrics, and Grafana datasource status are not exposed through the browser API.
- **Alerts**: Displays current derived alerts from the backend. Acknowledgement, resolution, playbooks, notification channels, and historical incident data are unavailable.
- **Logs**: Searches and filters persisted backend log records. Container stdout/stderr, trace IDs, spans, and stack traces are not provided by the logs API.
- **Live Backend API Integration**: Applications CRUD, scoped deployments and logs, summary, alerts, metrics, and `/health`, `/version`, and `/` probes use `VITE_API_BASE_URL`.
- **Sample data**: Files under `src/data/` remain available as development fixtures and are not rendered as production operational data.

---

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Routing**: React Router v7 (`react-router-dom`)
- **Styling**: Tailwind CSS v4 with custom design tokens
- **Icons & Typography**: Material Symbols Outlined, Inter, and JetBrains Mono fonts
- **Build Tool**: Vite 8+

---

## Getting Started

### Prerequisites

- Node.js 22.13 or later (or Node.js 24 or later)
- npm 10.x or later

### Installation

1. Clone or extract the repository to your local environment.
2. Install dependencies from `frontend/`:

```bash
npm ci
```

### Environment Configuration

The application reads the backend base URL from `VITE_API_BASE_URL`; the typed API clients do not use a hard-coded fallback. In PowerShell, set the variable before starting the development server:

```powershell
$env:VITE_API_BASE_URL="http://localhost:8000"
```

The existing backend probe connects to:
- `GET /health` - Returns `{ status: "ok" | "healthy", timestamp?: string }`
- `GET /version` - Returns `{ version: string, build?: string, commit?: string }`

The Applications page reads and updates records using `GET`, `POST`, `PATCH`, and `DELETE /applications`. Deployments are listed and created under a selected application with `GET` and `POST /applications/{id}/deployments`; one deployment is read with `GET /deployments/{id}` and its status is updated with `PATCH /deployments/{id}/status`. The API has no global deployments list endpoint, so choose an application on the Deployments page first. The list selector retains its application in the URL query. Logs, alerts, summaries, and Prometheus metrics use `/logs`, `/alerts`, `/summary`, and `/metrics`. If the backend is unavailable or the URL is not configured, API-backed views display an error and offer retry where appropriate. Fields without an API source are explicitly shown as unavailable.

### Development Server

Start the local development server from `frontend/`:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.
The Vite script uses port `3000`, which is included in the backend's default CORS origins. If you use another port or origin, configure backend `CORS_ORIGINS` to allow that exact origin; the backend must allow the browser's preflight request.

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

Run the API and UI tests, including deployment lifecycle and detail-page coverage:

```bash
npm run test
```

Run the existing telemetry test suite:

```bash
npx tsx --test src/utils/telemetry.test.ts
```

---

## Project Structure

```
├── public/                     # Static assets and design references
├── src/
│   ├── api/                    # Live backend API clients
│   │   ├── applications.ts     # Applications CRUD API calls
│   │   ├── applications.test.ts # API client contract tests
│   │   ├── alerts.ts           # Derived alerts API
│   │   ├── deployments.ts      # Application-scoped deployments API calls
│   │   ├── deployments.test.ts # Deployment API contract and transition tests
│   │   ├── logs.ts             # Persisted application/deployment logs API
│   │   ├── metrics.ts          # Prometheus text endpoint client and parser
│   │   ├── summary.ts          # Dashboard summary API
│   │   ├── client.ts           # Shared timeout and typed error handling
│   │   └── types.ts            # Backend request and response types
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
│   │   ├── ApplicationsPage.test.tsx # Applications UI behavior tests
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
├── vite.config.ts              # Vite configuration with Tailwind CSS plugin
└── vitest.config.ts            # jsdom-backed React test configuration
```

---

## License

Apache-2.0
