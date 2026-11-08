import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { newId, refreshStatus, type Station, type TrainCandidate, type TripPlan } from './core/models';
import { openDate } from './core/openingRule';
import { recommend, type Recommendation } from './core/recommender';
import { fetchTrains } from './core/tago';
import { kstDate, type DayKey } from './core/time';
import { removeEvent, upsertEvent } from './services/calendarSync';
import { rescheduleAll, setupNotifications } from './services/notifications';
import { DEFAULT_SETTINGS, loadPlans, loadSettings, savePlans, saveSettings, type Settings } from './services/storage';

interface Store {
  ready: boolean;
  plans: TripPlan[];
  settings: Settings;
  error?: string;
  clearError(): void;
  updateSettings(s: Settings): Promise<void>;
  recommendFor(from: Station, to: Station, day: DayKey, minutes: number, excluding?: string[]): Promise<Recommendation>;
  createPlans(days: DayKey[], from: Station, to: Station, minutes: number): Promise<void>;
  markBooked(id: string, seat: string): Promise<void>;
  markSoldOut(id: string): Promise<TrainCandidate[]>;
  switchTrain(id: string, train: TrainCandidate): Promise<void>;
  remove(id: string): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider 안에서만 사용');
  return s;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [plans, setPlans] = useState<TripPlan[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string>();
  const plansRef = useRef(plans);
  plansRef.current = plans;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  /** 저장 + 알림 재설정을 한 번에 */
  const commit = useCallback(async (next: TripPlan[]) => {
    const sorted = [...next].sort((a, b) => a.travelDay.localeCompare(b.travelDay) || a.preferredMinutes - b.preferredMinutes);
    setPlans(sorted);
    await savePlans(sorted);
    try {
      await rescheduleAll(sorted, settingsRef.current.notifyOffsetsMin);
    } catch (e) {
      setError(`알림을 설정하지 못했습니다: ${String(e)}`);
    }
  }, []);

  const syncCalendar = useCallback(async (p: TripPlan): Promise<TripPlan> => {
    try {
      const id = await upsertEvent(p);
      return id ? { ...p, calendarEventId: id } : p;
    } catch (e) {
      setError(`캘린더에 저장하지 못했습니다: ${String(e)}`);
      return p;
    }
  }, []);

  const refresh = useCallback(async () => {
    const current = plansRef.current;
    let changed = false;
    const next: TripPlan[] = [];
    for (const p of current) {
      const r = refreshStatus(p);
      if (r !== p) {
        changed = true;
        next.push(await syncCalendar(r));
      } else next.push(p);
    }
    if (changed) await commit(next);
  }, [commit, syncCalendar]);

  useEffect(() => {
    (async () => {
      const [p, s] = await Promise.all([loadPlans(), loadSettings()]);
      setSettings(s);
      settingsRef.current = s;
      plansRef.current = p;
      setPlans(p);
      setReady(true);
      try {
        await setupNotifications();
      } catch {}
      await refresh();
    })();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const recommendFor = useCallback(
    async (from: Station, to: Station, day: DayKey, minutes: number, excluding: string[] = []) => {
      try {
        const trains = await fetchTrains(settingsRef.current.tagoKey, from, to, day);
        return recommend(trains, kstDate(day, minutes), excluding);
      } catch (e: any) {
        setError(e?.message ?? String(e));
        return { alternatives: [] };
      }
    },
    [],
  );

  const createPlans = useCallback(
    async (days: DayKey[], from: Station, to: Station, minutes: number) => {
      const seriesId = days.length > 1 ? newId() : undefined;
      const created: TripPlan[] = [];
      for (const day of days) {
        const rec = await recommendFor(from, to, day, minutes);
        let p: TripPlan = refreshStatus({
          id: newId(),
          travelDay: day,
          preferredMinutes: minutes,
          from,
          to,
          openAt: openDate(day).toISOString(),
          status: 'waitingForOpen',
          chosen: rec.best,
          seriesId,
          createdAt: new Date().toISOString(),
        });
        p = await syncCalendar(p);
        created.push(p);
      }
      await commit([...plansRef.current, ...created]);
    },
    [commit, recommendFor, syncCalendar],
  );

  const updatePlan = useCallback(
    async (id: string, fn: (p: TripPlan) => TripPlan) => {
      const next: TripPlan[] = [];
      for (const p of plansRef.current) next.push(p.id === id ? await syncCalendar(fn(p)) : p);
      await commit(next);
    },
    [commit, syncCalendar],
  );

  const store: Store = useMemo(
    () => ({
      ready,
      plans,
      settings,
      error,
      clearError: () => setError(undefined),
      updateSettings: async (s) => {
        setSettings(s);
        settingsRef.current = s;
        await saveSettings(s);
        await commit(plansRef.current);
      },
      recommendFor,
      createPlans,
      markBooked: (id, seat) => updatePlan(id, (p) => ({ ...p, status: 'booked', seat: seat.trim() || p.seat })),
      markSoldOut: async (id) => {
        const p = plansRef.current.find((x) => x.id === id);
        if (!p) return [];
        await updatePlan(id, (x) => ({ ...x, status: 'needsAlternative' }));
        const rec = await recommendFor(p.from, p.to, p.travelDay, p.preferredMinutes, p.chosen ? [p.chosen.trainNo] : []);
        return [rec.best, ...rec.alternatives].filter((t): t is TrainCandidate => !!t);
      },
      switchTrain: (id, train) =>
        updatePlan(id, (p) => refreshStatus({ ...p, chosen: train, status: 'waitingForOpen' })),
      remove: async (id) => {
        const p = plansRef.current.find((x) => x.id === id);
        await removeEvent(p?.calendarEventId);
        await commit(plansRef.current.filter((x) => x.id !== id));
      },
    }),
    [ready, plans, settings, error, commit, recommendFor, createPlans, updatePlan],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
