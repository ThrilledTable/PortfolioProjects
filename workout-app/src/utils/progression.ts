import { LoggedSet } from '../types';

export type ProgressionSuggestion = 'increase' | 'maintain' | 'decrease';

export interface RepRange {
  low: number;
  high: number;
}

export function parseRepRange(repRange: string, fallback: RepRange = { low: 8, high: 12 }): RepRange {
  const match = repRange.match(/(\d+)\s*-\s*(\d+)/);
  if (match) {
    const lo = Number(match[1]);
    const hi = Number(match[2]);
    if (!Number.isNaN(lo) && !Number.isNaN(hi)) return { low: lo, high: hi };
  }
  const single = Number(repRange);
  if (!Number.isNaN(single) && single > 0) return { low: single, high: single };
  return fallback;
}

export function getAverageLoggedReps(sets: LoggedSet[]): number | null {
  const values = sets
    .filter((s) => s.logged && s.type !== 'warmup' && s.reps !== '')
    .map((s) => Number(s.reps))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

// Standard double-progression: once average reps reach the top of the target
// range, the weight is ready to go up next time; falling below the bottom of
// the range means the weight was too heavy.
export function suggestProgression(
  repRange: RepRange,
  lastWeekAvgReps: number | null
): ProgressionSuggestion | null {
  if (lastWeekAvgReps === null) return null;
  if (lastWeekAvgReps >= repRange.high) return 'increase';
  if (lastWeekAvgReps < repRange.low) return 'decrease';
  return 'maintain';
}
