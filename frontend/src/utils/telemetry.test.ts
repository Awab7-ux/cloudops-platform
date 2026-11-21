import { expect, test } from 'vitest';
import {
  calculateApdex,
  formatLatency,
  calculatePercentage,
  formatMemory,
  categorizeHttpStatus,
} from './telemetry';
import {
  isValidHealthPayload,
  isValidVersionPayload,
  formatEndpointUrl,
} from './apiHealth';

test('calculateApdex returns accurate Apdex score', () => {
  expect(calculateApdex(98, 2, 100)).toBe(0.99);
  expect(calculateApdex(100, 0, 100)).toBe(1);
  expect(calculateApdex(0, 0, 0)).toBe(1);
  expect(calculateApdex(50, 20, 100)).toBe(0.6);
});

test('formatLatency formats sub-millisecond, millisecond, and second values', () => {
  expect(formatLatency(18)).toBe('18ms');
  expect(formatLatency(18.4)).toBe('18.4ms');
  expect(formatLatency(1200)).toBe('1.20s');
  expect(formatLatency(0.5)).toBe('500\u00b5s');
});

test('calculatePercentage handles zero denominators and precision', () => {
  expect(calculatePercentage(12, 14, 1)).toBe(85.7);
  expect(calculatePercentage(0, 10)).toBe(0);
  expect(calculatePercentage(10, 0)).toBe(0);
});

test('formatMemory uses MiB below one GiB and GiB at or above it', () => {
  expect(formatMemory(512)).toBe('512MiB');
  expect(formatMemory(1024)).toBe('1.0GiB');
  expect(formatMemory(2048)).toBe('2.0GiB');
});

test('categorizeHttpStatus groups common response status classes', () => {
  expect(categorizeHttpStatus(200)).toBe('2xx');
  expect(categorizeHttpStatus(404)).toBe('4xx');
  expect(categorizeHttpStatus(503)).toBe('5xx');
  expect(categorizeHttpStatus(301)).toBe('3xx');
});

test('isValidHealthPayload rejects malformed health responses', () => {
  expect(isValidHealthPayload({ status: 'healthy' })).toBe(true);
  expect(isValidHealthPayload({ status: 'ok', service: 'fastapi' })).toBe(true);
  expect(isValidHealthPayload({ foo: 'bar' })).toBe(false);
  expect(isValidHealthPayload(null)).toBe(false);
  expect(isValidHealthPayload('healthy')).toBe(false);
});

test('isValidVersionPayload requires a version string', () => {
  expect(isValidVersionPayload({ version: '1.2.0' })).toBe(true);
  expect(isValidVersionPayload({})).toBe(false);
  expect(isValidVersionPayload(null)).toBe(false);
});

test('formatEndpointUrl joins base URLs and endpoint paths without duplicate slashes', () => {
  expect(formatEndpointUrl('http://localhost:8000', '/health')).toBe('http://localhost:8000/health');
  expect(formatEndpointUrl('http://localhost:8000/', 'health')).toBe('http://localhost:8000/health');
  expect(formatEndpointUrl('https://api.cloudops.internal/', '/version')).toBe('https://api.cloudops.internal/version');
});
