import { durationMin, isKTX, type TrainCandidate } from './models';

/** 희망 시각에 가장 맞는 열차와 차선책을 고른다. */
export interface RecommenderOptions {
  nonKTXPenaltyMin: number; // KTX 가 아니면 붙는 감점(분)
  slowerPenaltyPerMin: number; // 가장 빠른 열차보다 1분 느릴 때마다 감점
  earlyWeight: number; // 희망보다 이른 출발 가중치 (1보다 작으면 일찍 가는 쪽 선호)
  maxDeviationMin: number; // 이보다 많이 차이 나면 제외
  alternativeCount: number;
}

export const DEFAULT_OPTIONS: RecommenderOptions = {
  nonKTXPenaltyMin: 60,
  slowerPenaltyPerMin: 0.5,
  earlyWeight: 0.8,
  maxDeviationMin: 180,
  alternativeCount: 3,
};

export interface Recommendation {
  best?: TrainCandidate;
  alternatives: TrainCandidate[];
}

export function score(t: TrainCandidate, preferred: Date, fastestMin: number, o = DEFAULT_OPTIONS): number {
  const diff = (Date.parse(t.departure) - preferred.getTime()) / 60_000;
  const deviation = diff < 0 ? -diff * o.earlyWeight : diff;
  const slower = Math.max(0, durationMin(t) - fastestMin) * o.slowerPenaltyPerMin;
  return deviation + slower + (isKTX(t) ? 0 : o.nonKTXPenaltyMin);
}

export function recommend(
  trains: TrainCandidate[],
  preferred: Date,
  excluding: string[] = [],
  o = DEFAULT_OPTIONS,
): Recommendation {
  const pool = trains.filter(
    (t) =>
      !excluding.includes(t.trainNo) &&
      Math.abs(Date.parse(t.departure) - preferred.getTime()) / 60_000 <= o.maxDeviationMin,
  );
  if (pool.length === 0) return { alternatives: [] };
  const fastest = Math.min(...pool.map(durationMin));
  const ranked = [...pool].sort((a, b) => score(a, preferred, fastest, o) - score(b, preferred, fastest, o));
  return { best: ranked[0], alternatives: ranked.slice(1, 1 + o.alternativeCount) };
}
