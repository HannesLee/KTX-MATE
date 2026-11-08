import type { Station, TrainCandidate } from './models';
import { parseDayKey, type DayKey } from './time';

/**
 * 국토교통부 TAGO 열차정보 서비스 (공공데이터포털, 공식·무료)
 * https://www.data.go.kr/data/15098552/openapi.do
 * 시간표/운임만 있고 잔여석 정보는 없다.
 */
const BASE = 'https://apis.data.go.kr/1613000/TrainInfoService';

export class TagoError extends Error {}

export async function fetchTrains(
  serviceKey: string,
  from: Station,
  to: Station,
  day: DayKey,
  fetchImpl: typeof fetch = fetch,
): Promise<TrainCandidate[]> {
  if (!serviceKey) throw new TagoError('설정에서 공공데이터포털 인증키를 먼저 입력해 주세요.');
  const params = new URLSearchParams({
    serviceKey,
    depPlaceId: from.id,
    arrPlaceId: to.id,
    depPlandTime: day.replaceAll('-', ''),
    numOfRows: '200',
    pageNo: '1',
    _type: 'json',
  });
  const res = await fetchImpl(`${BASE}/getStrtpntAlocFndTrainInfo?${params}`);
  const text = await res.text();
  if (!res.ok) throw new TagoError(`시간표 조회 실패 (${res.status})`);
  try {
    return parseTrains(JSON.parse(text));
  } catch {
    // 인증키 오류 등은 XML 로 오는 경우가 있다
    throw new TagoError(text.includes('SERVICE_KEY') ? '인증키가 올바르지 않거나 아직 승인 전입니다.' : '시간표 응답을 읽지 못했습니다.');
  }
}

/** 결과 0건이면 items 가 "", 1건이면 item 이 배열이 아닌 객체로 오는 경우까지 처리 */
export function parseTrains(json: any): TrainCandidate[] {
  const items = json?.response?.body?.items;
  if (!items || typeof items !== 'object') return [];
  const raw = Array.isArray(items.item) ? items.item : items.item ? [items.item] : [];
  return raw.flatMap((it: any): TrainCandidate[] => {
    const dep = parseTagoTime(it.depplandtime);
    const arr = parseTagoTime(it.arrplandtime);
    if (!dep || !arr) return [];
    const fare = Number(it.adultcharge);
    return [
      {
        trainNo: String(it.trainno),
        gradeName: String(it.traingradename ?? ''),
        departure: dep.toISOString(),
        arrival: arr.toISOString(),
        fromName: String(it.depplacename ?? ''),
        toName: String(it.arrplacename ?? ''),
        adultFare: Number.isFinite(fare) && fare > 0 ? fare : undefined,
      },
    ];
  });
}

/** 20261207070000 (KST) → Date */
export function parseTagoTime(v: unknown): Date | undefined {
  const s = String(v ?? '');
  if (!/^\d{14}$/.test(s)) return undefined;
  const day = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const { y, m, d } = parseDayKey(day);
  const utc = Date.UTC(y, m - 1, d, Number(s.slice(8, 10)) - 9, Number(s.slice(10, 12)));
  return new Date(utc);
}
