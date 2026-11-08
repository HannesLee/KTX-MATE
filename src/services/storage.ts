import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TripPlan } from '../core/models';

const PLANS_KEY = 'ktxmate.plans.v1';
const SETTINGS_KEY = 'ktxmate.settings.v1';

export interface Settings {
  tagoKey: string; // 공공데이터포털 인증키 (Decoding)
  notifyOffsetsMin: number[]; // 오픈 몇 분 전에 알릴지. 0 = 정각
}

export const DEFAULT_SETTINGS: Settings = { tagoKey: '', notifyOffsetsMin: [24 * 60, 10, 0] };

export async function loadPlans(): Promise<TripPlan[]> {
  try {
    const raw = await AsyncStorage.getItem(PLANS_KEY);
    return raw ? (JSON.parse(raw) as TripPlan[]) : [];
  } catch {
    return [];
  }
}

export async function savePlans(plans: TripPlan[]): Promise<void> {
  await AsyncStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
