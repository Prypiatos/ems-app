export interface TimedReading {
  timestamp: string;
  value: number | null;
}

export interface SeverityThresholds {
  warning: number;
  critical: number;
  infoToken?: string;
  warningToken?: string;
  criticalToken?: string;
}

const DEFAULT_INFO_TOKEN = 'text-blue-500';
const DEFAULT_WARNING_TOKEN = 'text-yellow-500';
const DEFAULT_CRITICAL_TOKEN = 'text-red-500';

export function formatKwh(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';

  const absValue = Math.abs(value);

  if (absValue < 1) {
    return `${(value * 1000).toFixed(0)} Wh`;
  }

  if (absValue >= 1000) {
    return `${(value / 1000).toFixed(2)} MWh`;
  }

  return `${value.toFixed(2)} kWh`;
}

export function toRollingWindow(
  readings: TimedReading[] | null | undefined,
  windowSeconds: number
): TimedReading[] {
  if (!Array.isArray(readings) || readings.length === 0) return [];
  if (!Number.isFinite(windowSeconds) || windowSeconds <= 0) return [];

  const nowMs = Date.now();
  const minMs = nowMs - windowSeconds * 1000;

  return readings.filter((reading) => {
    if (!reading?.timestamp) return false;

    const tsMs = new Date(reading.timestamp).getTime();
    if (!Number.isFinite(tsMs)) return false;

    // Exclude future timestamps and keep only points inside the rolling window.
    return tsMs >= minMs && tsMs <= nowMs;
  });
}

export function calcRollingAverage(
  readings: TimedReading[] | null | undefined,
  windowSeconds: number
): number {
  const window = toRollingWindow(readings, windowSeconds);

  const values = window
    .map((item) => item.value)
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (values.length === 0) return 0;

  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

export function formatTimestamp(iso: string | null | undefined, locale: string): string {
  if (!iso) return '-';

  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '-';

  return new Intl.DateTimeFormat(locale || 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function severityColor(
  value: number | null | undefined,
  thresholds: SeverityThresholds
): string {
  const infoToken = thresholds.infoToken ?? DEFAULT_INFO_TOKEN;
  const warningToken = thresholds.warningToken ?? DEFAULT_WARNING_TOKEN;
  const criticalToken = thresholds.criticalToken ?? DEFAULT_CRITICAL_TOKEN;

  if (value == null || !Number.isFinite(value)) return infoToken;

  const warning = Math.min(thresholds.warning, thresholds.critical);
  const critical = Math.max(thresholds.warning, thresholds.critical);

  if (value >= critical) return criticalToken;
  if (value >= warning) return warningToken;
  return infoToken;
}
