/**
 * 한국 시간(KST, UTC+9, 서머타임 없음) 기준 날짜 도우미.
 * 날짜는 "YYYY-MM-DD" 문자열(DayKey)로 다루고, 시각이 필요할 때만 Date 로 바꾼다.
 * 기기 시간대가 달라도 항상 한국 기준으로 계산된다.
 */
export type DayKey = string; // "2026-12-07"

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

export function parseDayKey(key: DayKey): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

export function makeDayKey(y: number, m: number, d: number): DayKey {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Date(순간) → 한국 날짜 */
export function dayKeyOf(date: Date): DayKey {
  const k = new Date(date.getTime() + KST_OFFSET_MS);
  return makeDayKey(k.getUTCFullYear(), k.getUTCMonth() + 1, k.getUTCDate());
}

/** 한국 날짜 + 자정부터 분 → Date(순간) */
export function kstDate(key: DayKey, minutes = 0): Date {
  const { y, m, d } = parseDayKey(key);
  return new Date(Date.UTC(y, m - 1, d) - KST_OFFSET_MS + minutes * 60_000);
}

/** Date → 한국 시각의 자정부터 분 */
export function minutesOfDay(date: Date): number {
  const k = new Date(date.getTime() + KST_OFFSET_MS);
  return k.getUTCHours() * 60 + k.getUTCMinutes();
}

export function addDays(key: DayKey, n: number): DayKey {
  const { y, m, d } = parseDayKey(key);
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
  return makeDayKey(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 0=일요일 … 6=토요일 */
export function weekday(key: DayKey): number {
  const { y, m, d } = parseDayKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 월 더하기. 없는 날짜는 그 달 말일로 맞춘다 (3/31 - 1개월 → 2/28) */
export function addMonthsClamped(key: DayKey, n: number): DayKey {
  const { y, m, d } = parseDayKey(key);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return makeDayKey(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export function firstOfMonth(key: DayKey): DayKey {
  const { y, m } = parseDayKey(key);
  return makeDayKey(y, m, 1);
}

export function lastOfMonth(key: DayKey): DayKey {
  const { y, m } = parseDayKey(key);
  return makeDayKey(y, m, daysInMonth(y, m));
}

export function formatHM(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
export const weekdayKo = (wd: number) => WEEKDAY_KO[wd];

/** "12/7(월)" */
export function formatDay(key: DayKey): string {
  const { m, d } = parseDayKey(key);
  return `${m}/${d}(${weekdayKo(weekday(key))})`;
}

/** Date → "11/7(토) 07:00" (한국 시간) */
export function formatDateTime(date: Date): string {
  return `${formatDay(dayKeyOf(date))} ${formatHM(minutesOfDay(date))}`;
}
