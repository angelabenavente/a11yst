export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now(): Date {
    return new Date();
  },
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseCalendarDate(value: string): { year: number; month: number; day: number } {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`Invalid calendar date "${value}". Expected YYYY-MM-DD.`);
  }
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date "${value}".`);
  }
  return { year, month, day };
}

/** Start of the UTC day after `expiresAt` — when the classification is expired. */
export function expirationInstantUtc(expiresAt: string): Date {
  const { year, month, day } = parseCalendarDate(expiresAt);
  return new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
}

/** Whether a calendar-date classification is expired at `instant` (UTC). */
export function isClassificationExpired(
  expiresAt: string | undefined,
  instant: Date,
): boolean {
  if (!expiresAt) {
    return false;
  }
  return instant.getTime() >= expirationInstantUtc(expiresAt).getTime();
}

export function formatCalendarDateUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function assertFutureOrTodayCalendarDate(
  value: string,
  clock: Clock,
  label: string,
): void {
  parseCalendarDate(value);
  const today = formatCalendarDateUtc(clock.now());
  if (value < today) {
    throw new Error(`${label} must be today or in the future; received "${value}".`);
  }
}
