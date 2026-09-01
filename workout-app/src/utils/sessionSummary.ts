import { Exercise, MuscleGroup, WorkoutSession } from '../types';

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
