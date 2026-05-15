import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMetric(value: unknown, unit?: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: value < 10 ? 2 : 1 });
  if (unit === 'percent') return `${formatter.format(value)}%`;
  if (unit === 'ms') return `${formatter.format(value)} ms`;
  if (unit === 'rpm') return `${formatter.format(value)} rpm`;
  if (unit === 'bytes') return `${formatter.format(value)} B`;
  return formatter.format(value);
}

export function displayValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function rowsToCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return '';
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const escape = (value: unknown) => {
    const raw = displayValue(value);
    return `"${raw.replaceAll('"', '""')}"`;
  };
  return [columns.map(escape).join(','), ...rows.map(row => columns.map(col => escape(row[col])).join(','))].join('\n');
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
