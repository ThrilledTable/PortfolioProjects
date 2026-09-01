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
  restSeconds: number;
}

export interface TemplateExercise {
  id: string;
  exerciseId: string;
  sets: TargetSet[];
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
  deloadWeeks: number[];
}

export type SetType = 'warmup' | 'working' | 'drop';

export interface LoggedSet {
  id: string;
  weight: string;
  reps: string;
  rir: string;
  logged: boolean;
  type: SetType;
}

export type PainFlag = 'none' | 'mild' | 'sharp';
export type PumpLevel = 'low' | 'medium' | 'high';
export type EffortLevel = 'easy' | 'moderate' | 'hard' | 'max';

export interface MuscleFeedback {
  pump: PumpLevel;
  effort: EffortLevel;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  sets: LoggedSet[];
  painFlag?: PainFlag;
}

export interface WorkoutSession {
  id: string;
  mesoId: string;
  mesoName: string;
  week: number;
  dayId: string;
  dayName: string;
  date: string;
  completedAt?: string;
  notes?: string;
  exercises: SessionExercise[];
  muscleFeedback?: Partial<Record<MuscleGroup, MuscleFeedback>>;
}

export interface ActivePosition {
  mesoId: string;
  week: number;
  dayIndex: number;
}

export type WeightUnit = 'lbs' | 'kg';

export interface Settings {
  unit: WeightUnit;
  defaultRestSeconds: number;
}
