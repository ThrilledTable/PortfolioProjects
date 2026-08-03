import { LoggedSet } from '../types';

export type ProgressionSuggestion = 'increase' | 'maintain' | 'decrease';

export function getAverageLoggedRir(sets: LoggedSet[]): number | null {
  const values = sets
    .filter((s) => s.logged && s.type !== 'warmup' && s.reps !== '')
    .map((s) => Number(s.rir))
    .filter((n) => !Number.isNaN(n));
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

export function suggestProgression(
  targetRir: number,
  lastWeekAvgRir: number | null
): ProgressionSuggestion | null {
  if (lastWeekAvgRir === null) return null;
  const diff = lastWeekAvgRir - targetRir;
  if (diff >= 1) return 'increase';
  if (diff <= -1) return 'decrease';
  return 'maintain';
}
