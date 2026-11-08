import { describe, expect, test } from "@jest/globals";
import { buildICS, planTitle } from '../src/core/ics';
import type { TrainCandidate, TripPlan } from '../src/core/models';
import { refreshStatus } from '../src/core/models';
import { parseIntent, parseTime } from '../src/core/naturalLanguage';
import { openDate, STANDARD_RULE } from '../src/core/openingRule';
import { expandDates } from '../src/core/recurrence';
import { recommend } from '../src/core/recommender';
import { parseTagoTime, parseTrains } from '../src/core/tago';
import { addMonthsClamped, dayKeyOf, kstDate } from '../src/core/time';

// 2026-11-08(일) 22:00 KST
const NOW = kstDate('2026-11-08', 22 * 60);

describe('시간 도우미', () => {
  test('KST 날짜 변환', () => {
    expect(kstDate('2026-12-07', 420).toISOString()).toBe('2026-12-06T22:00:00.000Z');
    expect(dayKeyOf(new Date('2026-12-06T15:30:00Z'))).toBe('2026-12-07');
  });
  test('월 빼기는 말일로 맞춤', () => {
    expect(addMonthsClamped('2027-03-31', -1)).toBe('2027-02-28');
    expect(addMonthsClamped('2027-01-15', -1)).toBe('2026-12-15');
  });
});

describe('오픈일', () => {
  test('1개월 전 07:00', () => {
    expect(openDate('2026-12-14')).toEqual(kstDate('2026-11-14', 420));
  });
  test('말일 보정', () => {
    expect(openDate('2027-03-31')).toEqual(kstDate('2027-02-28', 420));
  });
  test('예외 규칙', () => {
    const rule = { ...STANDARD_RULE, overrides: { '2027-02-06': '2027-01-12T07:00:00+09:00' } };
    expect(openDate('2027-02-06', rule)).toEqual(new Date('2027-01-12T07:00:00+09:00'));
  });
});

describe('반복 일정', () => {
  test('이번달 매주 월요일 (오늘 이후)', () => {
    expect(expandDates({ period: { kind: 'thisMonth' }, weekdays: [1] }, NOW)).toEqual([
      '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30',
    ]);
  });
  test('다음달 매주 월요일', () => {
    expect(expandDates({ period: { kind: 'nextMonth' }, weekdays: [1] }, NOW)).toEqual([
      '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28',
    ]);
  });
});

const train = (no: string, h: number, m: number, minutes = 160, grade = 'KTX'): TrainCandidate => {
  const dep = kstDate('2026-12-07', h * 60 + m);
  return {
    trainNo: no, gradeName: grade, departure: dep.toISOString(),
    arrival: new Date(dep.getTime() + minutes * 60_000).toISOString(),
    fromName: '서울', toName: '부산',
  };
};

describe('추천', () => {
  const preferred = kstDate('2026-12-07', 420);
  test('희망 시각에 가장 가까운 KTX', () => {
    const r = recommend([train('101', 6, 30), train('103', 7, 0), train('105', 7, 30), train('1001', 7, 5, 300, '무궁화호')], preferred);
    expect(r.best?.trainNo).toBe('103');
    expect(r.alternatives.map((t) => t.trainNo)).not.toContain('103');
  });
  test('매진 제외 시 차선', () => {
    const r = recommend([train('101', 6, 30), train('103', 7, 0), train('105', 7, 30)], preferred, ['103']);
    expect(r.best?.trainNo).toBeDefined();
    expect(r.best?.trainNo).not.toBe('103');
  });
  test('너무 먼 시간은 제외', () => {
    expect(recommend([train('201', 15, 0)], preferred).best).toBeUndefined();
  });
});

describe('TAGO 응답 파싱', () => {
  test('시각 파싱(KST)', () => {
    expect(parseTagoTime(20261207070000)?.toISOString()).toBe('2026-12-06T22:00:00.000Z');
  });
  test('배열 / 단일 객체 / 빈 결과', () => {
    const item = { adultcharge: 59800, arrplacename: '부산', arrplandtime: 20261207094100, depplacename: '서울', depplandtime: 20261207070000, traingradename: 'KTX', trainno: 103 };
    expect(parseTrains({ response: { body: { items: { item: [item] } } } })[0]).toMatchObject({ trainNo: '103', adultFare: 59800 });
    expect(parseTrains({ response: { body: { items: { item } } } })).toHaveLength(1);
    expect(parseTrains({ response: { body: { items: '' } } })).toHaveLength(0);
  });
});

describe('말로 등록', () => {
  test('이번달 매주 월요일 7시 서울에서 부산', () => {
    const i = parseIntent('이번달 매주 월요일 7시 서울에서 부산 티켓 구매해줘', NOW)!;
    expect(i.request).toEqual({ period: { kind: 'thisMonth' }, weekdays: [1] });
    expect(i.preferredMinutes).toBe(420);
    expect(i.from?.name).toBe('서울');
    expect(i.to?.name).toBe('부산');
  });
  test('특정 날짜와 저녁 시간', () => {
    const i = parseIntent('12월 24일 저녁 6시반 부산에서 서울로', NOW)!;
    expect(i.request.period).toEqual({ kind: 'single', day: '2026-12-24' });
    expect(i.preferredMinutes).toBe(18 * 60 + 30);
    expect(i.from?.name).toBe('부산');
    expect(i.to?.name).toBe('서울');
  });
  test('다음주 금요일', () => {
    const i = parseIntent('다음주 금요일 오전 9시 대전 서울', NOW)!;
    expect(i.request.period).toEqual({ kind: 'single', day: '2026-11-13' });
    expect(i.from?.name).toBe('대전');
    expect(i.to?.name).toBe('서울');
  });
  test('다음달 평일', () => {
    const i = parseIntent('다음달 평일 아침 7시 서울 오송', NOW)!;
    expect(i.request).toEqual({ period: { kind: 'nextMonth' }, weekdays: [1, 2, 3, 4, 5] });
  });
  test('시간 형식', () => {
    expect(parseTime('19:30')).toBe(1170);
    expect(parseTime('오후 2시')).toBe(840);
    expect(parseTime('7시 15분')).toBe(435);
    expect(parseTime('시간 없음')).toBeUndefined();
  });
});

describe('상태와 캘린더 파일', () => {
  const plan: TripPlan = {
    id: 'p1', travelDay: '2026-12-07', preferredMinutes: 420,
    from: { id: 'NAT010000', name: '서울' }, to: { id: 'NAT014445', name: '부산' },
    openAt: kstDate('2026-11-07', 420).toISOString(), status: 'waitingForOpen',
    chosen: train('103', 7, 0), createdAt: NOW.toISOString(),
  };
  test('오픈 지나면 예매 필요', () => {
    expect(refreshStatus(plan, NOW).status).toBe('openNotBooked');
  });
  test('ics 생성', () => {
    const ics = buildICS([plan], NOW);
    expect(ics).toContain('DTSTART:20261206T220000Z');
    expect(ics).toContain('SUMMARY:⏳ (미예매) 서울→부산 KTX 103');
    expect(planTitle({ ...plan, status: 'booked' })).toBe('🚄 서울→부산 KTX 103');
  });
});
