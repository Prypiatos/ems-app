import { describe, expect, it, vi } from 'vitest';
import {
  calcRollingAverage,
  formatKwh,
  formatTimestamp,
  severityColor,
  toRollingWindow,
  type TimedReading,
} from '../energyTransforms';

describe('formatKwh', () => {
  it('returns Wh for sub-kWh values', () => {
    expect(formatKwh(0.5)).toBe('500 Wh');
  });

  it('returns kWh for normal values', () => {
    expect(formatKwh(12.345)).toBe('12.35 kWh');
  });

  it('returns MWh for large values', () => {
    expect(formatKwh(2500)).toBe('2.50 MWh');
  });

  it('handles null values', () => {
    expect(formatKwh(null)).toBe('-');
  });
});

describe('toRollingWindow', () => {
  it('returns empty for empty input', () => {
    expect(toRollingWindow([], 300)).toEqual([]);
  });

  it('trims readings to the requested time window', () => {
    const now = new Date('2026-05-02T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const readings: TimedReading[] = [
      { timestamp: '2026-05-02T11:40:00.000Z', value: 1 },
      { timestamp: '2026-05-02T11:56:00.000Z', value: 2 },
      { timestamp: '2026-05-02T11:59:30.000Z', value: 3 },
    ];

    const result = toRollingWindow(readings, 300);
    expect(result).toEqual([
      { timestamp: '2026-05-02T11:56:00.000Z', value: 2 },
      { timestamp: '2026-05-02T11:59:30.000Z', value: 3 },
    ]);

    vi.useRealTimers();
  });

  it('excludes future timestamps', () => {
    const now = new Date('2026-05-02T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const readings: TimedReading[] = [
      { timestamp: '2026-05-02T11:59:00.000Z', value: 1 },
      { timestamp: '2026-05-02T12:01:00.000Z', value: 2 },
    ];

    const result = toRollingWindow(readings, 300);
    expect(result).toEqual([{ timestamp: '2026-05-02T11:59:00.000Z', value: 1 }]);

    vi.useRealTimers();
  });
});

describe('calcRollingAverage', () => {
  it('returns 0 for empty arrays', () => {
    expect(calcRollingAverage([], 300)).toBe(0);
  });

  it('returns average for filtered window values', () => {
    const now = new Date('2026-05-02T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const readings: TimedReading[] = [
      { timestamp: '2026-05-02T11:40:00.000Z', value: 10 },
      { timestamp: '2026-05-02T11:58:00.000Z', value: 20 },
      { timestamp: '2026-05-02T11:59:00.000Z', value: 30 },
    ];

    expect(calcRollingAverage(readings, 300)).toBe(25);

    vi.useRealTimers();
  });

  it('ignores null values', () => {
    const now = new Date('2026-05-02T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const readings: TimedReading[] = [
      { timestamp: '2026-05-02T11:58:00.000Z', value: 20 },
      { timestamp: '2026-05-02T11:59:00.000Z', value: null },
    ];

    expect(calcRollingAverage(readings, 300)).toBe(20);

    vi.useRealTimers();
  });
});

describe('formatTimestamp', () => {
  it('returns placeholder for invalid values', () => {
    expect(formatTimestamp(null, 'en-US')).toBe('-');
    expect(formatTimestamp('not-a-date', 'en-US')).toBe('-');
  });

  it('formats valid timestamps (including future timestamps)', () => {
    expect(formatTimestamp('2027-01-01T00:00:00.000Z', 'en-US')).not.toBe('-');
  });
});

describe('severityColor', () => {
  const thresholds = { warning: 50, critical: 80 };

  it('returns info token for null values', () => {
    expect(severityColor(null, thresholds)).toBe('text-blue-500');
  });

  it('returns warning and critical tokens by threshold', () => {
    expect(severityColor(60, thresholds)).toBe('text-yellow-500');
    expect(severityColor(85, thresholds)).toBe('text-red-500');
  });

  it('supports custom tokens', () => {
    expect(
      severityColor(85, {
        warning: 50,
        critical: 80,
        criticalToken: 'critical-token',
        warningToken: 'warning-token',
        infoToken: 'info-token',
      })
    ).toBe('critical-token');
  });
});
