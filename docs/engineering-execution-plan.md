# CloudOps Platform Engineering Execution Plan

## Repository audit baseline

- Repository: `C:\Users\hp\Desktop\cloudops-platform`
- Branch: `wip/snapshot-20261031`, tracking `origin/wip/snapshot-20261031`
- The working tree was already dirty at the start of this task. Existing user changes include local fonts, font license files, and the `frontend/index.html` / `frontend/src/main.tsx` wiring. Preserve those changes.
- Existing project areas include FastAPI layers under `app/`, React pages and API clients under `frontend/src/`, Python and Vitest suites, Docker/Compose configuration, a GitHub Actions workflow, Kubernetes manifests, Terraform configuration, and Prometheus/Grafana resources.
- Existing project documentation says the API is unauthenticated, SQLite has no migration or backup strategy, and cluster inventory is unavailable to the frontend. These are current limitations, not resolved features.
- Baseline evidence: frontend tests passed (107 tests), frontend TypeScript check passed, frontend production build passed; backend tests passed when collection was scoped to `tests/` (299 tests). A root-level `pytest` invocation also tried to collect permission-restricted temporary directories, so future backend runs must target `tests/`.

## Phase plan

| Phase | Status | Audit scope and planned work | Acceptance evidence |
| --- | --- | --- | --- |
| 1. Frontend completion | IN PROGRESS | Review `frontend/src/pages/`, `frontend/src/api/`, and `frontend/src/components/` against the actual API contract. Keep unsupported alert writes and cluster inventory clearly unavailable. Remove unused demo fixtures. Review loading, error, empty, pagination, filtering, refresh, auto-tail, and export behavior. Add accurate function documentation and tests only where a real gap is found. | Vitest suite, `tsc --noEmit`, and Vite production build pass; API contract checks remain aligned; no unused demo fixture imports remain. |
| 2. Backend reliability | NOT STARTED | Audit `app/api/routes/`, `app/services/`, `app/repositories/`, `app/models/`, `app/schemas/`, `app/core/`, and `app/db/`. Verify transaction boundaries, UTC behavior, deletion relationships, PATCH conflict handling, pagination constants, and duplicated time/SHA helpers. Document migration options and impact before making a database architecture change. | Focused backend tests and full `tests/` suite pass; lint/type checks where configured; unresolved migration decision documented. |
| 3. Docker and containers | NOT STARTED | Inspect `Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, and `docker-compose.yml` for non-root execution, localhost bindings, health checks, API routing, environment handling, and persistent database storage. Validate statically before considering any local service startup; check ports and Docker resources first. | Dockerfile/Compose validation and, if the local environment permits safely, a scoped CloudOps-only smoke check with persistence evidence. |
| 4. CI/CD | NOT STARTED | Review `.github/workflows/` for backend/frontend checks, image builds, manifest validation, Terraform checks, least privilege, controlled dependencies, and absence of automatic paid deployment. | Workflow syntax and local-equivalent checks pass; no secrets or apply/deploy steps are introduced. |
| 5. Security and readiness | NOT STARTED | Audit input validation, CORS, headers, error responses, secrets, logging, dependencies, and rate limits in `app/` and the frontend. Prepare an authentication design and impact note. Authentication is a major architectural decision and will not be implemented until explicitly approved. | Security findings and accepted design documented; existing behavior remains covered by tests. |
| 6. Kubernetes | NOT STARTED | Review `k8s/` namespace, deployments, Services, ConfigMaps, Secret generation, probes, resources, and storage. Validate manifests without deleting or replacing a cluster or workload. | Manifest validation succeeds; any local deployment check is scoped to the existing CloudOps namespace and cluster after inspection. |
| 7. Terraform | NOT STARTED | Review `terraform/*.tf`, examples, and documentation for local provider scope, pinning, variables, outputs, state guidance, formatting, validation, and plan safety. Do not apply or destroy infrastructure. | `terraform fmt -check`, validation, and a non-applying plan pass when required providers are available. |
| 8. Monitoring and observability | NOT STARTED | Audit `app/core/metrics.py`, its tests, and `k8s/monitoring/` for real application metrics, scrape configuration, dashboard queries, alert rules, retention, and operational limitations. | Metrics tests and static configuration validation pass; dashboards use emitted series and documented data sources. |
| 9. Documentation and portfolio | NOT STARTED | Maintain the README and phase guides; add an architecture diagram, troubleshooting guidance, and a traceable function audit covering implementation, tests, debug status, and documentation. | Documentation matches verified behavior and every audited function has a report status. |

## Current phase 1 work

- Removed the unused fixture modules from `frontend/src/data/` after confirming there were no runtime or test imports.
- Moved the Applications display model into `frontend/src/types/applicationDisplay.ts`; it represents view data and keeps unavailable infrastructure values separate from backend API types.
- Replaced Vite's `__dirname` alias path with Node's ESM `import.meta.dirname` and documented the config factory.
- Preserved the pre-existing local font edits and assets.
- Post-change evidence: Vitest passed (107 tests), `npm run lint` passed, and `npm run build` passed without the previous Vite config warning.

## Change and safety controls

- Inspect `git status` before each phase and after its implementation.
- Keep work phase-by-phase; do not mark a phase complete while a required gate is missing.
- Do not commit, push, merge, reset, rebase, amend, stash, delete branches, or discard user changes.
- Do not run destructive Docker, Kubernetes, or Terraform operations. Ask for explicit approval before a major architecture change, including authentication or database migrations.
