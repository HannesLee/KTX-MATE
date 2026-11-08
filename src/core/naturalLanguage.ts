import { stationNamed, STATIONS, type Station } from './models';
import type { Period, RecurrenceRequest } from './recurrence';
import { addDays, dayKeyOf, makeDayKey, parseDayKey, weekday, type DayKey } from './time';

/**
 * 말로 등록: "이번달 매주 월요일 7시 서울에서 부산" → 구조화된 요청.
 * Expo Go 에서도 돌아가도록 규칙 기반으로 만든 1차 버전.
 * (나중에 개발 빌드에서는 애플/구글 온디바이스 AI 로 교체하거나 보완)
 */
export interface PlanIntent {
  request: RecurrenceRequest;
  preferredMinutes?: number;
  from?: Station;
  to?: Station;
}

const WD: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

export function parseIntent(text: string, now = new Date()): PlanIntent | undefined {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  const today = dayKeyOf(now);

  // 요일: "매주 월요일", "월, 수요일", "월수금", "평일", "주말"
  const weekdays = new Set<number>();
  if (/평일/.test(t)) [1, 2, 3, 4, 5].forEach((d) => weekdays.add(d));
  if (/주말/.test(t)) [0, 6].forEach((d) => weekdays.add(d));
  for (const m of t.matchAll(/([월화수목금토일]+)\s*요일/g)) {
    for (const ch of m[1]) weekdays.add(WD[ch]);
  }

  // 기간
  let period: Period | undefined;
  if (/다음\s*달|다음달|담달/.test(t)) period = { kind: 'nextMonth' };
  else if (/이번\s*달|이번달/.test(t)) period = { kind: 'thisMonth' };

  const explicit = t.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (explicit) {
    const { y } = parseDayKey(today);
    let day = makeDayKey(y, Number(explicit[1]), Number(explicit[2]));
    if (day < today) day = makeDayKey(y + 1, Number(explicit[1]), Number(explicit[2]));
    period = { kind: 'single', day };
  } else if (/모레/.test(t)) period = { kind: 'single', day: addDays(today, 2) };
  else if (/내일/.test(t)) period = { kind: 'single', day: addDays(today, 1) };
  else if (/오늘/.test(t)) period = { kind: 'single', day: today };

  // "다음주 월요일" / "이번주 금요일" 처럼 기간 없이 요일만 → 그 주의 그 요일 하루
  if (!period && weekdays.size === 1 && !/매주/.test(t)) {
    const wd = [...weekdays][0];
    let day: DayKey;
    if (/다음\s*주/.test(t)) {
      // 다음 주 월요일을 기준으로 (한 주는 월~일)
      const toNextMonday = (8 - weekday(today)) % 7 || 7;
      day = addDays(addDays(today, toNextMonday), (wd + 6) % 7);
    } else {
      day = addDays(today, (wd - weekday(today) + 7) % 7);
    }
    period = { kind: 'single', day };
    weekdays.clear();
  }
  if (!period) period = { kind: 'thisMonth' };

  return {
    request: { period, weekdays: period.kind === 'single' ? [] : [...weekdays].sort() },
    preferredMinutes: parseTime(t),
    ...parseRoute(t),
  };
}

/** "7시", "오전 7시 30분", "저녁 7시", "19:30", "7시반" → 분 */
export function parseTime(t: string): number | undefined {
  const colon = t.match(/(\d{1,2}):(\d{2})/);
  let h: number | undefined;
  let m = 0;
  if (colon) {
    h = Number(colon[1]);
    m = Number(colon[2]);
  } else {
    const k = t.match(/(\d{1,2})\s*시\s*(반|(\d{1,2})\s*분)?/);
    if (!k) return undefined;
    h = Number(k[1]);
    m = k[2] === '반' ? 30 : k[3] ? Number(k[3]) : 0;
  }
  if (/오후|저녁|밤/.test(t) && h < 12) h += 12;
  if (h > 23 || m > 59) return undefined;
  return h * 60 + m;
}

/** "서울에서 부산", "서울→부산", "서울 부산" */
export function parseRoute(t: string): { from?: Station; to?: Station } {
  const from = t.match(/([가-힣]+?)역?에서/);
  const to = t.match(/(?:에서|→|->|~)\s*([가-힣]+?)역?(?:까지|으로|로|행|\s|$)/);
  const result: { from?: Station; to?: Station } = {
    from: from ? stationNamed(from[1]) : undefined,
    to: to ? stationNamed(to[1]) : undefined,
  };
  if (!result.from || !result.to) {
    // 문장에 나온 역 이름을 순서대로
    const found = STATIONS.map((s) => ({ s, i: t.indexOf(s.name) }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i)
      .map((x) => x.s);
    result.from ??= found[0];
    result.to ??= found.find((s) => s.id !== result.from?.id);
  }
  return result;
}

export type { DayKey };
