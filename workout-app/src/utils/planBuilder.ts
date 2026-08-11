import { Exercise, MesoDay, MuscleGroup, TargetSet, TemplateExercise } from '../types';
import { genId } from './id';

export type SplitDayType = 'Push' | 'Pull' | 'Legs' | 'Upper' | 'Lower' | 'Full Body';

const DAY_TYPE_MUSCLES: Record<SplitDayType, MuscleGroup[]> = {
  Push: ['Chest', 'Shoulders', 'Triceps'],
  Pull: ['Back', 'Biceps', 'Traps', 'Forearms'],
  Legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  Upper: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Traps'],
  Lower: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  'Full Body': ['Chest', 'Back', 'Quads', 'Shoulders', 'Hamstrings', 'Abs'],
};

const SPLITS: Record<number, SplitDayType[]> = {
  1: ['Full Body'],
  2: ['Full Body', 'Full Body'],
  3: ['Push', 'Pull', 'Legs'],
  4: ['Upper', 'Lower', 'Upper', 'Lower'],
  5: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
  6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
};

const SETS_PER_EXERCISE = 3;
const DEFAULT_REP_RANGE = '8-12';
const DEFAULT_RIR = 3;

export function suggestSplit(daysPerWeek: number): SplitDayType[] {
  return SPLITS[Math.min(6, Math.max(1, daysPerWeek))];
}

function pick<T>(pool: T[], count: number, offset: number): T[] {
  if (pool.length === 0 || count <= 0) return [];
  const n = Math.min(count, pool.length);
  const result: T[] = [];
  for (let i = 0; i < n; i++) {
    result.push(pool[(offset + i) % pool.length]);
  }
  return result;
}

function makeTargetSets(restSeconds: number): TargetSet[] {
  return Array.from({ length: SETS_PER_EXERCISE }, () => ({
    id: genId(),
    repRange: DEFAULT_REP_RANGE,
    rir: DEFAULT_RIR,
    restSeconds,
  }));
}

export function buildSuggestedDays(
  daysPerWeek: number,
  focusMuscles: MuscleGroup[],
  exercises: Exercise[],
  defaultRestSeconds: number
): MesoDay[] {
  const split = suggestSplit(daysPerWeek);
  const occurrenceByType = new Map<SplitDayType, number>();
  const totalByType = split.reduce<Record<string, number>>((acc, t) => {
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  return split.map((dayType) => {
    const occurrence = occurrenceByType.get(dayType) ?? 0;
    occurrenceByType.set(dayType, occurrence + 1);

    const muscles = DAY_TYPE_MUSCLES[dayType];
    const dayExercises: TemplateExercise[] = [];
    const usedMuscles = new Set<MuscleGroup>();

    muscles.forEach((mg, mgIndex) => {
      const pool = exercises.filter((e) => e.muscleGroup === mg);
      if (pool.length === 0) return;
      const count = focusMuscles.includes(mg) ? Math.min(2, pool.length) : 1;
      const offset = occurrence * count + mgIndex;
      const picked = pick(pool, count, offset);
      picked.forEach((ex) => {
        usedMuscles.add(mg);
        dayExercises.push({
          id: genId(),
          exerciseId: ex.id,
          sets: makeTargetSets(defaultRestSeconds),
        });
      });
    });

    const name = totalByType[dayType] > 1 ? `${dayType} Day ${occurrence + 1}` : `${dayType} Day`;

    return {
      id: genId(),
      name,
      muscleGroups: Array.from(usedMuscles),
      exercises: dayExercises,
    };
  });
}
