import { STATUS_LABEL, type TripPlan } from './models';
import { formatDateTime, kstDate } from './time';

/**
 * 캘린더 파일(.ics). Expo Go 에서는 캘린더 직접 연동이 안 되므로
 * 이 파일을 공유 시트로 넘겨 아이폰 캘린더에 추가한다.
 */
export function planTitle(p: TripPlan): string {
  const route = `${p.from.name}→${p.to.name}`;
  const train = p.chosen ? ` ${p.chosen.gradeName} ${p.chosen.trainNo}` : '';
  if (p.status === 'booked') return `🚄 ${route}${train}`;
  if (p.status === 'needsAlternative') return `⚠️ (차선 필요) ${route}${train}`;
  return `⏳ (미예매) ${route}${train}`;
}

export function planNotes(p: TripPlan): string {
  const lines = [`상태: ${STATUS_LABEL[p.status]}`, `예매 오픈: ${formatDateTime(new Date(p.openAt))}`];
  if (p.seat) lines.push(`좌석: ${p.seat}`);
  lines.push('KTX MATE에서 관리하는 일정입니다.');
  return lines.join('\n');
}

export function planTimes(p: TripPlan): { start: Date; end: Date } {
  const start = p.chosen ? new Date(p.chosen.departure) : kstDate(p.travelDay, p.preferredMinutes);
  const end = p.chosen ? new Date(p.chosen.arrival) : new Date(start.getTime() + 2 * 3600_000);
  return { start, end };
}

const icsTime = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);

export function buildICS(plans: TripPlan[], now = new Date()): string {
  const events = plans.map((p) => {
    const { start, end } = planTimes(p);
    return [
      'BEGIN:VEVENT',
      `UID:${p.id}@ktxmate`,
      `DTSTAMP:${icsTime(now)}`,
      `DTSTART:${icsTime(start)}`,
      `DTEND:${icsTime(end)}`,
      `SUMMARY:${esc(planTitle(p))}`,
      `LOCATION:${esc(`${p.from.name}역`)}`,
      `DESCRIPTION:${esc(planNotes(p))}`,
      'END:VEVENT',
    ].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KTX MATE//KO', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR', ''].join('\r\n');
}
