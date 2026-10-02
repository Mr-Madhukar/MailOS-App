export const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function monthIndex(token: string): number | null {
  const key = token.toLowerCase().replaceAll(".", "");
  return MONTHS[key] ?? null;
}

export function stripOnce(text: string, pattern: RegExp | string): string {
  return text.replace(pattern, " ").replace(/\s+/g, " ").trim();
}

export function resolveDayMonth(day: number, month: number, refDate: Date): Date {
  let year = refDate.getFullYear();
  const candidate = new Date(year, month, day);
  const todayStart = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  if (candidate < todayStart) year += 1;
  return new Date(year, month, day);
}
