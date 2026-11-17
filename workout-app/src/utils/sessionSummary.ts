import { Exercise, LoggedSet, MuscleGroup, SessionExercise, WorkoutSession } from '../types';

export interface SessionSummary {
  totalSets: number;
  totalVolume: number;
  muscleCount: number;
}

export function computeSessionSummary(
  session: WorkoutSession,
  exerciseById: Map<string, Exercise>
): SessionSummary {
  let totalSets = 0;
  let totalVolume = 0;
  const muscles = new Set<MuscleGroup>();
  for (const se of session.exercises) {
    const exercise = exerciseById.get(se.exerciseId);
    for (const s of se.sets) {
      if (!s.logged || s.type === 'warmup') continue;
      totalSets += 1;
      totalVolume += (Number(s.weight) || 0) * (Number(s.reps) || 0);
      if (exercise) muscles.add(exercise.muscleGroup);
    }
  }
  return { totalSets, totalVolume, muscleCount: muscles.size };
}

/**
 * A set needs no further action: it was logged, it was deliberately skipped, or
 * it is a warm-up, which never gated completion. Skipped sets are never
 * `logged`, so everything that measures work done ignores them for free.
 */
export function isSetSettled(set: LoggedSet): boolean {
  return set.logged || !!set.skipped || set.type === 'warmup';
}

/** Every set accounted for, on an exercise that has sets at all. */
export function isExerciseComplete(sessionExercise: SessionExercise): boolean {
  return sessionExercise.sets.length > 0 && sessionExercise.sets.every(isSetSettled);
}

/**
 * A session is in progress once it exists and has not been finished. Note that
 * `completeSession` toggles, so a session can return here after being marked
 * complete -- anything gated on this (keep-awake, the elapsed-time tick) has to
 * cope with being switched back on.
 */
export function isSessionInProgress(session: WorkoutSession | undefined): boolean {
  return !!session && !session.completedAt;
}
