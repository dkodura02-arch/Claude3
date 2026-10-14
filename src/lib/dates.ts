const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday of the week containing `d` */
export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // Mon=0 … Sun=6
  x.setDate(x.getDate() - day);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addWeeks(week: string, n: number): string {
  return toISODate(addDays(fromISODate(week), 7 * n));
}

/**
 * The week we are planning for: on Saturday and Sunday that is already the coming week
 * (cooking on Sunday for Monday–Friday), otherwise the current week.
 */
export function planningWeek(now = new Date()): string {
  const day = now.getDay();
  const monday = mondayOf(now);
  return toISODate(day === 6 || day === 0 ? addDays(monday, 7) : monday);
}

export function isoWeekNumber(week: string): number {
  const d = fromISODate(week);
  const thursday = addDays(mondayOf(d), 3);
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  return 1 + Math.floor((thursday.getTime() - jan1.getTime()) / (7 * 864e5));
}

const fmt = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });

/** "20.–26. Okt." */
export function weekRangeLabel(week: string): string {
  const start = fromISODate(week);
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}.–${fmt.format(end)}`;
  }
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export function weeksBetween(a: string, b: string): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / (7 * 864e5));
}

/** Month (1-12) that best represents the week (its Thursday) */
export function weekMonth(week: string): number {
  return addDays(fromISODate(week), 3).getMonth() + 1;
}
