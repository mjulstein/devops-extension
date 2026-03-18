import type { ClosedDateRange } from '@/types';

const DEFAULT_CLOSED_RANGE_DAYS = 7;

interface ClosedDateRangeOverrides {
  start?: string;
  end?: string;
}

export function createDefaultClosedDateRange(
  today = new Date()
): ClosedDateRange {
  const end = toDateInputValue(today);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - DEFAULT_CLOSED_RANGE_DAYS);

  return {
    start: toDateInputValue(startDate),
    end
  };
}

export function isValidClosedDateRange(range: ClosedDateRange): boolean {
  const start = parseDateInputValue(range.start);
  const end = parseDateInputValue(range.end);

  return start !== null && end !== null && start.getTime() <= end.getTime();
}

export function areClosedDateRangesEqual(
  left: ClosedDateRange,
  right: ClosedDateRange
): boolean {
  return left.start === right.start && left.end === right.end;
}

export function getTodayDateInputValue(today = new Date()): string {
  return toDateInputValue(today);
}

export function isTodayDateInputValue(
  value: string,
  today = new Date()
): boolean {
  return value === getTodayDateInputValue(today);
}

export function createClosedDateRangeOverrides(
  range: ClosedDateRange,
  today = new Date()
): ClosedDateRangeOverrides | null {
  const defaults = createDefaultClosedDateRange(today);
  const overrides: ClosedDateRangeOverrides = {};

  if (range.start !== defaults.start) {
    overrides.start = range.start;
  }

  if (range.end !== defaults.end) {
    overrides.end = range.end;
  }

  return Object.keys(overrides).length ? overrides : null;
}

export function applyClosedDateRangeOverrides(
  value: unknown,
  today = new Date()
): ClosedDateRange {
  const defaults = createDefaultClosedDateRange(today);

  if (!isRecord(value)) {
    return defaults;
  }

  const range = {
    start: typeof value.start === 'string' ? value.start : defaults.start,
    end: typeof value.end === 'string' ? value.end : defaults.end
  };

  return isValidClosedDateRange(range) ? range : defaults;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearString, monthString, dayString] = value.split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
