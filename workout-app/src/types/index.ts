export const MUSCLE_GROUPS = [
  'Traps',
  'Abs',
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Forearms',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT_TYPES = [
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Bodyweight',
  'Other',
] as const;

export type Equipment = (typeof EQUIPMENT_TYPES)[number];

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  custom?: boolean;
}

export interface TargetSet {
  id: string;
  repRange: string;
  rir: number;
}

export interface TemplateExercise {
  id: string;
  exerciseId: string;
  sets: TargetSet[];
}

export interface Template {
  id: string;
  name: string;
  exercises: TemplateExercise[];
}

export interface MesoDay {
  id: string;
  name: string;
  muscleGroups: MuscleGroup[];
  exercises: TemplateExercise[];
}

export interface Mesocycle {
  id: string;
  name: string;
  weeks: number;
  days: MesoDay[];
}

export interface LoggedSet {
  id: string;
  weight: string;
  reps: string;
  rir: string;
  logged: boolean;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  sets: LoggedSet[];
}

export interface WorkoutSession {
  id: string;
  mesoId: string;
  mesoName: string;
  week: number;
  dayId: string;
  dayName: string;
  date: string;
  exercises: SessionExercise[];
}

export interface ActivePosition {
  mesoId: string;
  week: number;
  dayIndex: number;
}
