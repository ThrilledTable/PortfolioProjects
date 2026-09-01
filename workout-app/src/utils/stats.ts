import { Exercise, WorkoutSession } from '../types';
import { computeSessionSummary } from './sessionSummary';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function weekBucket(date: Date): number {
  return Math.floor(date.getTime() / WEEK_MS);
}

export function computeTotalWorkouts(sessions: WorkoutSession[]): number {
  return sessions.filter((s) => !!s.completedAt).length;
}

export function computeThisWeekVolume(
  sessions: WorkoutSession[],
  exerciseById: Map<string, Exercise>
): number {
  const currentBucket = weekBucket(new Date());
  let total = 0;
  for (const s of sessions) {
    if (!s.completedAt) continue;
    if (weekBucket(new Date(s.completedAt)) !== currentBucket) continue;
    total += computeSessionSummary(s, exerciseById).totalVolume;
  }
  return total;
}

export function computeStreak(sessions: WorkoutSession[]): number {
  const buckets = new Set(
    sessions.filter((s) => s.completedAt).map((s) => weekBucket(new Date(s.completedAt!)))
  );
  if (buckets.size === 0) return 0;
  let streak = 0;
  let cursor = weekBucket(new Date());
  while (buckets.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}
