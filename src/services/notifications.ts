import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { TripPlan } from '../core/models';
import { formatDay } from '../core/time';

/**
 * 예매 오픈 전 알림 (기본: 하루 전, 10분 전, 정각).
 * iOS 는 대기 중인 로컬 알림이 앱당 64개까지라 가까운 것부터 60개만 건다.
 * 앱이 열릴 때마다 전부 지우고 다시 건다.
 */
export const CATEGORY = 'ktx_open';
export const OPEN_KORAIL = 'open_korail';
const MAX_PENDING = 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '예매 오픈 알림',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: OPEN_KORAIL, buttonTitle: '코레일+ 열기', options: { opensAppToForeground: true } },
  ]);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const next = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return next.granted;
}

export interface PlannedNotification {
  planId: string;
  fireAt: Date;
  title: string;
  body: string;
}

/** 순수 계산: 어떤 알림을 언제 걸지 */
export function planNotifications(plans: TripPlan[], offsetsMin: number[], now = new Date()): PlannedNotification[] {
  const items: PlannedNotification[] = [];
  for (const p of plans) {
    if (p.status !== 'waitingForOpen' && p.status !== 'openNotBooked') continue;
    const open = Date.parse(p.openAt);
    for (const off of offsetsMin) {
      const fireAt = new Date(open - off * 60_000);
      if (fireAt <= now) continue;
      const route = `${p.from.name}→${p.to.name}`;
      const train = p.chosen ? ` ${p.chosen.gradeName} ${p.chosen.trainNo}` : '';
      const when = off === 0 ? '지금 열렸습니다' : off >= 60 * 24 ? '내일 이 시각에 열립니다' : `${off}분 뒤 열립니다`;
      items.push({
        planId: p.id,
        fireAt,
        title: off === 0 ? '🚄 지금 예매 오픈!' : '⏰ 곧 예매 오픈',
        body: `${formatDay(p.travelDay)} ${route}${train} 승차권이 ${when}.`,
      });
    }
  }
  return items.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, MAX_PENDING);
}

export async function rescheduleAll(plans: TripPlan[], offsetsMin: number[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const n of planNotifications(plans, offsetsMin)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: n.title,
        body: n.body,
        sound: true,
        categoryIdentifier: CATEGORY,
        data: { planId: n.planId },
        interruptionLevel: 'timeSensitive',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.fireAt, channelId: 'default' },
    });
  }
}
