export const NEW_RELIC_TIMEZONE = 'UTC';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const MAX_TIMESERIES_BUCKETS = 320;

export type TimeRangeSelection =
  | { kind: 'preset'; value: string; label: string; minutes: number }
  | { kind: 'custom'; label: string; fromLocal: string; toLocal: string };

export function defaultTimeRangeSelection(minutes = 180): TimeRangeSelection {
  return { kind: 'preset', value: String(minutes), label: minutesToLabel(minutes), minutes };
}

export function minutesToLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 1440 === 0) return `${minutes / 1440} d`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
}

export function floorToFiveMinutes(date: Date) {
  return new Date(Math.floor(date.getTime() / FIVE_MINUTES_MS) * FIVE_MINUTES_MS);
}

export function floorToMinute(date: Date) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  return next;
}

function stepForMinutes(minutes: number) {
  const candidates = [
    { minutes: 1, label: '1 minute' },
    { minutes: 2, label: '2 minutes' },
    { minutes: 5, label: '5 minutes' },
    { minutes: 10, label: '10 minutes' },
    { minutes: 15, label: '15 minutes' },
    { minutes: 30, label: '30 minutes' },
    { minutes: 60, label: '1 hour' },
    { minutes: 120, label: '2 hours' },
    { minutes: 360, label: '6 hours' },
    { minutes: 720, label: '12 hours' },
    { minutes: 1440, label: '1 day' }
  ];
  const match = candidates.find((candidate) => minutes / candidate.minutes <= MAX_TIMESERIES_BUCKETS);
  return match?.label ?? '1 day';
}

export function absoluteUtcRange(minutesBack: number, now: Date = new Date()) {
  const until = floorToFiveMinutes(now);
  const since = new Date(until.getTime() - minutesBack * 60_000);
  return {
    since: `'${toNrqlUtcIso(since)}'`,
    until: `'${toNrqlUtcIso(until)}'`,
    timezone: NEW_RELIC_TIMEZONE,
    step: stepForMinutes(minutesBack)
  };
}

export function customUtcRange(fromLocal: string, toLocal: string) {
  const from = floorToFiveMinutes(new Date(fromLocal));
  const to = floorToFiveMinutes(new Date(toLocal));
  const minutes = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 60_000));
  return {
    since: `'${toNrqlUtcIso(from)}'`,
    until: `'${toNrqlUtcIso(to)}'`,
    timezone: NEW_RELIC_TIMEZONE,
    step: stepForMinutes(minutes)
  };
}

export function resolveTimeRange(selection: TimeRangeSelection) {
  if (selection.kind === 'custom') {
    return customUtcRange(selection.fromLocal, selection.toLocal);
  }
  return absoluteUtcRange(selection.minutes);
}

export function describeTimeRangeSelection(selection: TimeRangeSelection) {
  if (selection.kind === 'custom') return selection.label || 'Personalizado';
  return selection.label || minutesToLabel(selection.minutes);
}

export function toNrqlUtcIso(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function formatForDatetimeLocal(date: Date) {
  const floored = floorToFiveMinutes(date);
  return new Date(floored.getTime() - floored.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function formatUtcDateTime(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: NEW_RELIC_TIMEZONE,
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(floorToMinute(date)) + ' UTC';
}

export function formatUtcAxis(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: NEW_RELIC_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(floorToMinute(date));
}
