"""Prometheus metrics backed by real HTTP requests and database summaries."""

from __future__ import annotations

from prometheus_client import (
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

from app.schemas.summary import SummaryResponse


class CloudOpsMetrics:
    """Own one isolated metric registry for one FastAPI application instance."""

    def __init__(self) -> None:
        # A private registry keeps app factories and tests from duplicating names.
        self.registry = CollectorRegistry()
        self.http_requests = Counter(
            "cloudops_http_requests",
            "HTTP responses served by the CloudOps API.",
            labelnames=("method", "route", "status_code"),
            registry=self.registry,
        )
        self.http_request_duration = Histogram(
            "cloudops_http_request_duration_seconds",
            "HTTP request duration in seconds.",
            labelnames=("method", "route"),
            buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
            registry=self.registry,
        )
        self.applications_total = Gauge(
            "cloudops_applications_total",
            "Current application records in the CloudOps database.",
            registry=self.registry,
        )
        self.applications_by_status = Gauge(
            "cloudops_applications_by_status",
            "Current application records by backend status.",
            labelnames=("status",),
            registry=self.registry,
        )
        self.applications_by_environment = Gauge(
            "cloudops_applications_by_environment",
            "Current application records by backend environment.",
            labelnames=("environment",),
            registry=self.registry,
        )
        self.deployments_total = Gauge(
            "cloudops_deployments_total",
            "Current deployment records in the CloudOps database.",
            registry=self.registry,
        )
        self.deployments_by_status = Gauge(
            "cloudops_deployments_by_status",
            "Current deployment records by backend lifecycle status.",
            labelnames=("status",),
            registry=self.registry,
        )
        self.deployments_last_24h = Gauge(
            "cloudops_deployments_last_24h",
            "Deployments created in the trailing 24 hours.",
            registry=self.registry,
        )
        self.logs_total = Gauge(
            "cloudops_logs_total",
            "Current log records in the CloudOps database.",
            registry=self.registry,
        )
        self.log_errors_last_24h = Gauge(
            "cloudops_log_errors_last_24h",
            "Error log records in the trailing 24 hours.",
            registry=self.registry,
        )
        self.active_alerts = Gauge(
            "cloudops_active_alerts",
            "Current derived CloudOps alerts grouped by alert type.",
            labelnames=("type",),
            registry=self.registry,
        )

    # Records response metrics with a bounded route label, never a raw URL path.
    def record_request(
        self,
        *,
        method: str,
        route: str,
        status_code: int,
        duration_seconds: float,
    ) -> None:
        """Record one completed HTTP response."""
        bounded_route = route or "unmatched"
        self.http_requests.labels(
            method=method,
            route=bounded_route,
            status_code=str(status_code),
        ).inc()
        self.http_request_duration.labels(
            method=method,
            route=bounded_route,
        ).observe(duration_seconds)

    # Refreshes gauges from the same summary calculation used by the live API.
    def update_summary(self, summary: SummaryResponse) -> None:
        """Publish current application, deployment, and log aggregates."""
        self.applications_total.set(summary.applications.total)
        for status, count in summary.applications.by_status.items():
            self.applications_by_status.labels(status=status).set(count)
        for environment, count in summary.applications.by_environment.items():
            self.applications_by_environment.labels(environment=environment).set(
                count
            )

        self.deployments_total.set(summary.deployments.total)
        for status, count in summary.deployments.by_status.items():
            self.deployments_by_status.labels(status=status).set(count)
        self.deployments_last_24h.set(summary.deployments.last_24h)

        self.logs_total.set(summary.logs.total)
        self.log_errors_last_24h.set(summary.logs.errors_last_24h)

    # Publishes counts from the same rule engine used by the alerts API.
    def update_alert_counts(self, counts: dict[str, int]) -> None:
        """Replace active alert gauges with the current derived alert counts."""
        self.active_alerts.clear()
        for alert_type, count in counts.items():
            self.active_alerts.labels(type=alert_type).set(count)

    # Returns the Prometheus text exposition for this app's registry.
    def render(self) -> bytes:
        """Serialize all registered metrics in Prometheus text format."""
        return generate_latest(self.registry)
