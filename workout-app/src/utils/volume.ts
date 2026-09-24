import { Exercise, MesoDay, MuscleGroup } from '../types';

export interface MuscleVolume {
  muscle: MuscleGroup;
  sets: number;
}

export function computeWeeklyVolumeByMuscle(
  days: MesoDay[],
  exercisesById: Map<string, Exercise>
): MuscleVolume[] {
  const counts = new Map<MuscleGroup, number>();
  for (const day of days) {
    for (const te of day.exercises) {
      const exercise = exercisesById.get(te.exerciseId);
      if (!exercise) continue;
      counts.set(exercise.muscleGroup, (counts.get(exercise.muscleGroup) ?? 0) + te.sets.length);
    }
  }
  return Array.from(counts.entries())
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets);
}
