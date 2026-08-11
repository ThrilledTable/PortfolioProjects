import { LoggedSet } from '../types';
import { ProgressionSuggestion } from './progression';

const ROUND_INCREMENT_LBS = 2.5;
const DELOAD_FACTOR = 0.7;
const INCREASE_FACTOR = 1.025;
const DECREASE_FACTOR = 0.95;
const MIN_REPS = 1;
const MAX_REPS = 30;

export interface SuggestedTarget {
  weight: number;
  reps: number;
  oneRepMax: number;
}

export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

export function weightForReps(oneRepMax: number, reps: number): number {
  if (reps <= 0) return oneRepMax;
  return oneRepMax / (1 + reps / 30);
}

export function repsForWeight(oneRepMax: number, weight: number): number {
  if (weight <= 0) return MIN_REPS;
  const reps = 30 * (oneRepMax / weight - 1);
  return Math.max(MIN_REPS, Math.min(MAX_REPS, Math.round(reps)));
}

export function roundToIncrement(value: number, increment = ROUND_INCREMENT_LBS): number {
  return Math.max(increment, Math.round(value / increment) * increment);
}

export function parseRepRangeMidpoint(repRange: string, fallback = 10): number {
  const match = repRange.match(/(\d+)\s*-\s*(\d+)/);
  if (match) {
    const lo = Number(match[1]);
    const hi = Number(match[2]);
    if (!Number.isNaN(lo) && !Number.isNaN(hi)) return Math.round((lo + hi) / 2);
  }
  const single = Number(repRange);
  return Number.isNaN(single) ? fallback : single;
}

export function bestSetOf(sets: LoggedSet[]): { weight: number; reps: number } | null {
  let best: { weight: number; reps: number } | null = null;
  for (const s of sets) {
    if (!s.logged || s.type === 'warmup') continue;
    const weight = Number(s.weight);
    const reps = Number(s.reps);
    if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) continue;
    if (!best || weight > best.weight) best = { weight, reps };
  }
  return best;
}

export function computeSuggestedTarget(
  prevBestSet: { weight: number; reps: number } | null,
  direction: ProgressionSuggestion | null,
  repTarget: number,
  isDeload: boolean
): SuggestedTarget | null {
  if (!prevBestSet) return null;
  const prevOneRM = estimate1RM(prevBestSet.weight, prevBestSet.reps);
  if (prevOneRM <= 0) return null;

  let targetOneRM = prevOneRM;
  if (isDeload) {
    targetOneRM = prevOneRM * DELOAD_FACTOR;
  } else if (direction === 'increase') {
    targetOneRM = prevOneRM * INCREASE_FACTOR;
  } else if (direction === 'decrease') {
    targetOneRM = prevOneRM * DECREASE_FACTOR;
  }

  const weight = roundToIncrement(weightForReps(targetOneRM, repTarget));
  return { weight, reps: repTarget, oneRepMax: targetOneRM };
}

export function repsForAlternateWeight(oneRepMax: number, availableWeight: number): number {
  return repsForWeight(oneRepMax, availableWeight);
}
