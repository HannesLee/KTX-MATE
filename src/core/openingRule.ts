import { addMonthsClamped, kstDate, type DayKey } from './time';

/**
 * 예매 오픈 규칙.
 * 평상시: 승차일 1개월 전 같은 날 07:00 (전월에 그 날짜가 없으면 말일).
 * 명절 특별예매 같은 예외는 overrides 로 덮어쓴다. 코레일 공지로 최종 확인 필요.
 */
export interface OpeningRule {
  monthsBefore: number;
  openMinutes: number; // 07:00 → 420
  overrides: Record<DayKey, string>; // 승차일 → 오픈 일시(ISO)
}

export const STANDARD_RULE: OpeningRule = { monthsBefore: 1, openMinutes: 7 * 60, overrides: {} };

export function openDate(travelDay: DayKey, rule: OpeningRule = STANDARD_RULE): Date {
  const override = rule.overrides[travelDay];
  if (override) return new Date(override);
  return kstDate(addMonthsClamped(travelDay, -rule.monthsBefore), rule.openMinutes);
}
