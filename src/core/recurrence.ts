import { addDays, addMonthsClamped, dayKeyOf, firstOfMonth, lastOfMonth, weekday, type DayKey } from './time';

export type Period =
  | { kind: 'single'; day: DayKey }
  | { kind: 'thisMonth' }
  | { kind: 'nextMonth' }
  | { kind: 'range'; from: DayKey; to: DayKey };

export interface RecurrenceRequest {
  period: Period;
  /** 0=일 … 6=토. 비어 있으면 기간 내 모든 날 */
  weekdays: number[];
}

/** "이번달 매주 월요일" → 날짜 목록 (오늘 이전은 뺀다) */
export function expandDates(req: RecurrenceRequest, now = new Date(), includePast = false): DayKey[] {
  const today = dayKeyOf(now);
  let start: DayKey;
  let end: DayKey;
  switch (req.period.kind) {
    case 'single':
      return [req.period.day];
    case 'thisMonth':
      start = firstOfMonth(today);
      end = lastOfMonth(today);
      break;
    case 'nextMonth': {
      const next = addMonthsClamped(firstOfMonth(today), 1);
      start = next;
      end = lastOfMonth(next);
      break;
    }
    case 'range':
      start = req.period.from;
      end = req.period.to;
      break;
  }
  const result: DayKey[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const ok = req.weekdays.length === 0 || req.weekdays.includes(weekday(d));
    if (ok && (includePast || d >= today)) result.push(d);
  }
  return result;
}
