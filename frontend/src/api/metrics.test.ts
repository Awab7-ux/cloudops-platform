import { describe, expect, it } from 'vitest';

import { parsePrometheusMetrics } from './metrics';

describe('parsePrometheusMetrics', () => {
  it('parses metric names, labels, and numeric samples while ignoring comments', () => {
    const samples = parsePrometheusMetrics([
      '# HELP cloudops_http_requests_total HTTP responses served.',
      '# TYPE cloudops_http_requests_total counter',
      'cloudops_http_requests_total{method="GET",route="/health",status_code="200"} 3',
      'cloudops_active_alerts{type="deployment_failed"} 1.0',
      'not a metric line',
    ].join('\n'));

    expect(samples).toEqual([
      {
        name: 'cloudops_http_requests_total',
        labels: { method: 'GET', route: '/health', status_code: '200' },
        value: 3,
      },
      {
        name: 'cloudops_active_alerts',
        labels: { type: 'deployment_failed' },
        value: 1,
      },
    ]);
  });

  it('unescapes quoted label characters', () => {
    expect(parsePrometheusMetrics('cloudops_test{route="/a\\\"b\\\\c\\nd"} 2')).toEqual([
      {
        name: 'cloudops_test',
        labels: { route: '/a"b\\c\nd' },
        value: 2,
      },
    ]);
  });
});
