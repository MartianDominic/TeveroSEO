import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime, formatShortDate, formatDateTime, formatTime } from '../lib/format-time';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for times less than a minute ago', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('returns minutes ago for recent times', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
  });

  it('returns hours ago for times within a day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days ago for times within a week', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');
  });

  it('handles string input', () => {
    const result = formatRelativeTime('2026-04-30T12:00:00Z');
    expect(typeof result).toBe('string');
  });

  it('handles number input', () => {
    const result = formatRelativeTime(Date.now());
    expect(result).toBe('just now');
  });

  it('returns "Invalid date" for invalid input', () => {
    expect(formatRelativeTime('not-a-date')).toBe('Invalid date');
  });

  it('handles future dates', () => {
    const inFiveMinutes = new Date(Date.now() + 5 * 60 * 1000);
    expect(formatRelativeTime(inFiveMinutes)).toBe('in 5m');
  });
});

describe('formatShortDate', () => {
  it('formats date as "Apr 30, 2026"', () => {
    const date = new Date('2026-04-30T12:00:00Z');
    expect(formatShortDate(date)).toBe('Apr 30, 2026');
  });

  it('handles string input', () => {
    expect(formatShortDate('2026-01-15')).toBe('Jan 15, 2026');
  });

  it('returns "Invalid date" for invalid input', () => {
    expect(formatShortDate('not-a-date')).toBe('Invalid date');
  });
});

describe('formatDateTime', () => {
  it('formats date with time', () => {
    const date = new Date('2026-04-30T15:45:00');
    const result = formatDateTime(date);
    expect(result).toContain('Apr 30, 2026');
  });

  it('returns "Invalid date" for invalid input', () => {
    expect(formatDateTime('not-a-date')).toBe('Invalid date');
  });
});

describe('formatTime', () => {
  it('formats time only', () => {
    const date = new Date('2026-04-30T15:45:00');
    const result = formatTime(date);
    expect(result).toContain('45');
  });

  it('returns "Invalid time" for invalid input', () => {
    expect(formatTime('not-a-date')).toBe('Invalid time');
  });
});
