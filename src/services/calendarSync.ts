import Constants, { ExecutionEnvironment } from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { buildICS, planNotes, planTimes, planTitle } from '../core/ics';
import type { TripPlan } from '../core/models';

/**
 * 캘린더 연동.
 * - Expo Go: 캘린더 직접 연동 모듈이 없어서, .ics 파일을 만들어 공유 시트로 캘린더에 추가한다.
 * - 개발/배포 빌드: expo-calendar 로 "KTX MATE" 캘린더에 직접 넣고 상태가 바뀌면 갱신한다.
 */
export const canSyncDirectly = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

const CALENDAR_TITLE = 'KTX MATE';

// Expo Go 에서는 불러오기만 해도 오류가 나므로 필요할 때만 불러온다.
function calendarModule(): any | undefined {
  if (!canSyncDirectly) return undefined;
  try {
    return require('expo-calendar/legacy');
  } catch {
    return undefined;
  }
}

let calendarIdCache: string | undefined;

async function ktxCalendarId(Cal: any): Promise<string | undefined> {
  if (calendarIdCache) return calendarIdCache;
  const perm = await Cal.requestCalendarPermissionsAsync();
  if (perm.status !== 'granted') return undefined;
  const calendars = await Cal.getCalendarsAsync(Cal.EntityTypes.EVENT);
  const existing = calendars.find((c: any) => c.title === CALENDAR_TITLE);
  if (existing) return (calendarIdCache = existing.id);

  const source =
    Platform.OS === 'ios'
      ? (await Cal.getDefaultCalendarAsync()).source
      : { isLocalAccount: true, name: CALENDAR_TITLE, type: Cal.SourceType?.LOCAL ?? 'LOCAL' };
  calendarIdCache = await Cal.createCalendarAsync({
    title: CALENDAR_TITLE,
    color: '#005BAC',
    entityType: Cal.EntityTypes.EVENT,
    sourceId: source?.id,
    source,
    name: 'ktxmate',
    ownerAccount: 'personal',
    accessLevel: Cal.CalendarAccessLevel?.OWNER,
  });
  return calendarIdCache;
}

/** 직접 연동이 되면 이벤트를 만들거나 갱신하고 id 를 돌려준다. 안 되면 undefined. */
export async function upsertEvent(plan: TripPlan): Promise<string | undefined> {
  const Cal = calendarModule();
  if (!Cal) return undefined;
  const calendarId = await ktxCalendarId(Cal);
  if (!calendarId) return undefined;
  const { start, end } = planTimes(plan);
  const details = {
    title: planTitle(plan),
    notes: planNotes(plan),
    location: `${plan.from.name}역`,
    startDate: start,
    endDate: end,
    timeZone: 'Asia/Seoul',
  };
  if (plan.calendarEventId) {
    try {
      await Cal.updateEventAsync(plan.calendarEventId, details);
      return plan.calendarEventId;
    } catch {
      // 사용자가 캘린더에서 지운 경우 새로 만든다
    }
  }
  return Cal.createEventAsync(calendarId, details);
}

export async function removeEvent(eventId?: string): Promise<void> {
  const Cal = calendarModule();
  if (!Cal || !eventId) return;
  try {
    await Cal.deleteEventAsync(eventId);
  } catch {}
}

/** Expo Go 용: 일정들을 .ics 로 만들어 공유 시트 → "캘린더에 추가" */
export async function shareICS(plans: TripPlan[]): Promise<void> {
  const file = new File(Paths.cache, `ktxmate-${Date.now()}.ics`);
  file.create();
  file.write(buildICS(plans));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', UTI: 'com.apple.ical.ics' });
  }
}
