import type { DayKey } from './time';

export interface Station {
  id: string; // TAGO 역 코드, 예: "NAT010000"
  name: string;
}

/**
 * 자주 쓰는 역. TAGO 역 목록 API 응답으로 한 번 검증 필요.
 */
export const STATIONS: Station[] = [
  { id: 'NAT010000', name: '서울' },
  { id: 'NAT010032', name: '용산' },
  { id: 'NAT010415', name: '광명' },
  { id: 'NAT050044', name: '오송' },
  { id: 'NAT011668', name: '대전' },
  { id: 'NAT013271', name: '동대구' },
  { id: 'NAT014445', name: '부산' },
];

export function stationNamed(name: string): Station | undefined {
  const n = name.replace(/역$/, '').trim();
  return STATIONS.find((s) => s.name === n);
}

export interface TrainCandidate {
  trainNo: string;
  gradeName: string; // "KTX", "KTX-산천", "ITX-새마을" …
  departure: string; // ISO 문자열 (저장/직렬화 편하게)
  arrival: string;
  fromName: string;
  toName: string;
  adultFare?: number;
}

export const isKTX = (t: TrainCandidate) => t.gradeName.toUpperCase().includes('KTX');
export const durationMin = (t: TrainCandidate) =>
  (Date.parse(t.arrival) - Date.parse(t.departure)) / 60_000;

export type TicketStatus = 'waitingForOpen' | 'openNotBooked' | 'booked' | 'needsAlternative';

export const STATUS_LABEL: Record<TicketStatus, string> = {
  waitingForOpen: '오픈 대기',
  openNotBooked: '예매 필요',
  booked: '예매 완료',
  needsAlternative: '차선 필요',
};

export const STATUS_COLOR: Record<TicketStatus, string> = {
  waitingForOpen: '#8E8E93',
  openNotBooked: '#FF9500',
  booked: '#0A84FF',
  needsAlternative: '#FF3B30',
};

/** 사용자가 등록한 "이 날 이 시간쯤 기차표가 필요하다" 하나 */
export interface TripPlan {
  id: string;
  travelDay: DayKey;
  preferredMinutes: number; // 07:00 → 420
  from: Station;
  to: Station;
  openAt: string; // ISO
  status: TicketStatus;
  chosen?: TrainCandidate;
  seat?: string;
  calendarEventId?: string;
  seriesId?: string;
  createdAt: string;
}

/** 시각이 지나면 오픈 대기 → 예매 필요로 바뀐다 (예매 완료/차선 필요는 유지) */
export function refreshStatus(plan: TripPlan, now = new Date()): TripPlan {
  if (plan.status !== 'waitingForOpen' && plan.status !== 'openNotBooked') return plan;
  const status: TicketStatus = now.getTime() >= Date.parse(plan.openAt) ? 'openNotBooked' : 'waitingForOpen';
  return status === plan.status ? plan : { ...plan, status };
}

export const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
