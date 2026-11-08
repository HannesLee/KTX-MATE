import * as Clipboard from 'expo-clipboard';
import { Linking } from 'react-native';
import type { TripPlan } from '../core/models';
import { formatDateTime, formatDay } from '../core/time';

/**
 * 1단계 구매 방식: 추천 열차 정보를 복사하고 코레일+ 앱(안 열리면 웹)으로 넘긴다.
 * 코레일+ 앱의 실제 URL 스킴은 기기에서 확인 필요.
 */
const KORAIL_APP = 'korailtalk://';
const KORAIL_WEB = 'https://www.korail.com';

export function summary(p: TripPlan): string {
  const when = p.chosen ? formatDateTime(new Date(p.chosen.departure)) : formatDay(p.travelDay);
  const train = p.chosen ? `${p.chosen.gradeName} ${p.chosen.trainNo}` : '열차 미선택';
  return `${when} ${p.from.name}→${p.to.name} ${train}`;
}

export async function openKorail(p?: TripPlan): Promise<void> {
  if (p) await Clipboard.setStringAsync(summary(p));
  try {
    await Linking.openURL(KORAIL_APP);
  } catch {
    await Linking.openURL(KORAIL_WEB);
  }
}
