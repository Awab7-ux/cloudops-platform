import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateApdex,
  formatLatency,
  calculatePercentage,
  formatMemory,
  categorizeHttpStatus,
} from './telemetry.ts';
import {
  isValidHealthPayload,
  isValidVersionPayload,
  formatEndpointUrl,
} from './apiHealth.ts';

test('calculateApdex returns accurate Apdex score', () => {
  // 98 satisfied, 2 tolerating, 0 frustrated out of 100 => (98 + 1) / 100 = 0.99
  assert.equal(calculateApdex(98, 2, 100), 0.99);
  assert.equal(calculateApdex(100, 0, 100), 1.0);
  assert.equal(calculateApdex(0, 0, 0), 1.0);
  assert.equal(calculateApdex(50, 20, 100), 0.6);
});

test('formatLatency formats numbers properly', () => {
  assert.equal(formatLatency(18), '18ms');
  assert.equal(formatLatency(18.4), '18.4ms');
  assert.equal(formatLatency(1200), '1.20s');
  assert.equal(formatLatency(0.5), '500µs');
});

test('calculatePercentage handles divisions cleanly', () => {
  assert.equal(calculatePercentage(12, 14, 1), 85.7);
  assert.equal(calculatePercentage(0, 10), 0);
  assert.equal(calculatePercentage(10, 0), 0);
});

test('formatMemory formats mb to GiB when appropriate', () => {
  assert.equal(formatMemory(512), '512MiB');
  assert.equal(formatMemory(1024), '1.0GiB');
  assert.equal(formatMemory(2048), '2.0GiB');
});

test('categorizeHttpStatus categorizes codes correctly', () => {
  assert.equal(categorizeHttpStatus(200), '2xx');
  assert.equal(categorizeHttpStatus(404), '4xx');
  assert.equal(categorizeHttpStatus(503), '5xx');
  assert.equal(categorizeHttpStatus(301), '3xx');
});

test('isValidHealthPayload validates responses accurately', () => {
  assert.equal(isValidHealthPayload({ status: 'healthy' }), true);
  assert.equal(isValidHealthPayload({ status: 'ok', service: 'fastapi' }), true);
  assert.equal(isValidHealthPayload({ foo: 'bar' }), false);
  assert.equal(isValidHealthPayload(null), false);
  assert.equal(isValidHealthPayload('healthy'), false);
});

test('isValidVersionPayload validates version strings accurately', () => {
  assert.equal(isValidVersionPayload({ version: '1.2.0' }), true);
  assert.equal(isValidVersionPayload({}), false);
  assert.equal(isValidVersionPayload(null), false);
});

test('formatEndpointUrl formats URLs cleanly', () => {
  assert.equal(formatEndpointUrl('http://localhost:8000', '/health'), 'http://localhost:8000/health');
  assert.equal(formatEndpointUrl('http://localhost:8000/', 'health'), 'http://localhost:8000/health');
  assert.equal(formatEndpointUrl('https://api.cloudops.internal/', '/version'), 'https://api.cloudops.internal/version');
});
