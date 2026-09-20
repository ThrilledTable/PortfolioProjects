import { MuscleGroup } from '../types';

export interface ProgramExercise {
  /** Matched against the exercise library by name; unknown names are skipped. */
  name: string;
  sets: number;
  repRange: string;
  restSeconds: number;
  /** Runs back to back with the next entry carrying the same tag. */
  supersetTag?: string;
}

export interface ProgramDay {
  name: string;
  muscleGroups: MuscleGroup[];
  exercises: ProgramExercise[];
}

export interface StarterProgram {
  id: string;
  name: string;
  daysPerWeek: number;
  weeks: number;
  /** Which week of the block is the deload. */
  deloadWeek: number;
  summary: string;
  bestFor: string;
  days: ProgramDay[];
}

// Rep ranges and rest follow the usual split: heavy compounds low and long,
// isolation higher and short. Nothing here is exotic -- these are the shapes
// most intermediate lifters end up running anyway, written out so a new user
// does not have to assemble one from an empty screen.
const HEAVY = { repRange: '5-8', restSeconds: 180 };
const MAIN = { repRange: '6-10', restSeconds: 150 };
const ACCESSORY = { repRange: '10-15', restSeconds: 75 };
const ISOLATION = { repRange: '12-15', restSeconds: 60 };

export const STARTER_PROGRAMS: StarterProgram[] = [
  {
    id: 'full-body-3',
    name: 'Full Body',
    daysPerWeek: 3,
    weeks: 5,
    deloadWeek: 5,
    summary: 'Three full-body days. Every major movement pattern, three times a week.',
    bestFor: 'Starting out, or coming back after time off',
    days: [
      {
        name: 'Full Body A',
        muscleGroups: ['Quads', 'Chest', 'Back', 'Abs'],
        exercises: [
          { name: 'Barbell Back Squat', sets: 3, ...HEAVY },
          { name: 'Barbell Bench Press', sets: 3, ...MAIN },
          { name: 'Seated Cable Row', sets: 3, ...MAIN },
          { name: 'Plank', sets: 3, ...ISOLATION },
        ],
      },
      {
        name: 'Full Body B',
        muscleGroups: ['Hamstrings', 'Shoulders', 'Back', 'Abs'],
        exercises: [
          { name: 'Romanian Deadlift', sets: 3, ...HEAVY },
          { name: 'Overhead Press', sets: 3, ...MAIN },
          { name: 'Lat Pulldown', sets: 3, ...MAIN },
          { name: 'Hanging Leg Raise', sets: 3, ...ISOLATION },
        ],
      },
      {
        name: 'Full Body C',
        muscleGroups: ['Quads', 'Chest', 'Back', 'Biceps'],
        exercises: [
          { name: 'Leg Press', sets: 3, ...MAIN },
          { name: 'Incline Dumbbell Press', sets: 3, ...MAIN },
          { name: 'Barbell Row', sets: 3, ...MAIN },
          { name: 'Dumbbell Curl', sets: 2, ...ISOLATION },
        ],
      },
    ],
  },
  {
    id: 'upper-lower-4',
    name: 'Upper / Lower',
    daysPerWeek: 4,
    weeks: 5,
    deloadWeek: 5,
    summary: 'Two upper days and two lower days, each muscle trained twice a week.',
    bestFor: 'The reliable middle ground once three days is not enough',
    days: [
      {
        name: 'Upper A',
        muscleGroups: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'],
        exercises: [
          { name: 'Barbell Bench Press', sets: 4, ...HEAVY },
          { name: 'Barbell Row', sets: 4, ...MAIN },
          { name: 'Overhead Press', sets: 3, ...MAIN },
          { name: 'Lat Pulldown', sets: 3, ...ACCESSORY },
          { name: 'Dumbbell Curl', sets: 3, ...ISOLATION, supersetTag: 'arms' },
          { name: 'Cable Tricep Pushdown', sets: 3, ...ISOLATION, supersetTag: 'arms' },
        ],
      },
      {
        name: 'Lower A',
        muscleGroups: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
        exercises: [
          { name: 'Barbell Back Squat', sets: 4, ...HEAVY },
          { name: 'Romanian Deadlift', sets: 3, ...MAIN },
          { name: 'Leg Press', sets: 3, ...ACCESSORY },
          { name: 'Lying Leg Curl', sets: 3, ...ISOLATION },
          { name: 'Standing Calf Raise', sets: 4, ...ISOLATION },
        ],
      },
      {
        name: 'Upper B',
        muscleGroups: ['Back', 'Chest', 'Shoulders', 'Biceps', 'Triceps'],
        exercises: [
          { name: 'Pull Up', sets: 4, ...MAIN },
          { name: 'Incline Dumbbell Press', sets: 4, ...MAIN },
          { name: 'Seated Cable Row', sets: 3, ...ACCESSORY },
          { name: 'Dumbbell Lateral Raise', sets: 3, ...ISOLATION },
          { name: 'Preacher Curl', sets: 3, ...ISOLATION, supersetTag: 'arms' },
          { name: 'Skull Crusher', sets: 3, ...ISOLATION, supersetTag: 'arms' },
        ],
      },
      {
        name: 'Lower B',
        muscleGroups: ['Hamstrings', 'Quads', 'Glutes', 'Abs'],
        exercises: [
          { name: 'Deadlift', sets: 3, ...HEAVY },
          { name: 'Walking Lunge', sets: 3, ...ACCESSORY },
          { name: 'Leg Extension', sets: 3, ...ISOLATION },
          { name: 'Seated Leg Curl', sets: 3, ...ISOLATION },
          { name: 'Cable Rope Crunch', sets: 3, ...ISOLATION },
        ],
      },
    ],
  },
  {
    id: 'ppl-6',
    name: 'Push / Pull / Legs',
    daysPerWeek: 6,
    weeks: 5,
    deloadWeek: 5,
    summary: 'The push-pull-legs rotation run twice through the week.',
    bestFor: 'Six days you can actually make, and recover from',
    days: [
      {
        name: 'Push A',
        muscleGroups: ['Chest', 'Shoulders', 'Triceps'],
        exercises: [
          { name: 'Barbell Bench Press', sets: 4, ...HEAVY },
          { name: 'Overhead Press', sets: 3, ...MAIN },
          { name: 'Incline Dumbbell Press', sets: 3, ...ACCESSORY },
          { name: 'Dumbbell Lateral Raise', sets: 3, ...ISOLATION },
          { name: 'Cable Tricep Pushdown', sets: 3, ...ISOLATION },
        ],
      },
      {
        name: 'Pull A',
        muscleGroups: ['Back', 'Biceps', 'Traps'],
        exercises: [
          { name: 'Barbell Row', sets: 4, ...MAIN },
          { name: 'Pull Up', sets: 3, ...MAIN },
          { name: 'Seated Cable Row', sets: 3, ...ACCESSORY },
          { name: 'Barbell Shrug', sets: 3, ...ISOLATION },
          { name: 'Barbell Curl', sets: 3, ...ISOLATION },
        ],
      },
      {
        name: 'Legs A',
        muscleGroups: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
        exercises: [
          { name: 'Barbell Back Squat', sets: 4, ...HEAVY },
          { name: 'Romanian Deadlift', sets: 3, ...MAIN },
          { name: 'Leg Extension', sets: 3, ...ISOLATION, supersetTag: 'legs' },
          { name: 'Lying Leg Curl', sets: 3, ...ISOLATION, supersetTag: 'legs' },
          { name: 'Standing Calf Raise', sets: 4, ...ISOLATION },
        ],
      },
      {
        name: 'Push B',
        muscleGroups: ['Shoulders', 'Chest', 'Triceps'],
        exercises: [
          { name: 'Machine Shoulder Press', sets: 4, ...MAIN },
          { name: 'Machine Chest Press', sets: 3, ...MAIN },
          { name: 'Cable Fly', sets: 3, ...ISOLATION },
          { name: 'Cable Lateral Raise', sets: 3, ...ISOLATION },
          { name: 'Overhead Tricep Extension', sets: 3, ...ISOLATION },
        ],
      },
      {
        name: 'Pull B',
        muscleGroups: ['Back', 'Biceps', 'Shoulders'],
        exercises: [
          { name: 'Lat Pulldown', sets: 4, ...MAIN },
          { name: 'T-Bar Row', sets: 3, ...MAIN },
          { name: 'Rear Delt Fly', sets: 3, ...ISOLATION },
          { name: 'Cable Curl', sets: 3, ...ISOLATION },
          { name: 'Wrist Curl', sets: 2, ...ISOLATION },
        ],
      },
      {
        name: 'Legs B',
        muscleGroups: ['Hamstrings', 'Glutes', 'Quads', 'Abs'],
        exercises: [
          { name: 'Deadlift', sets: 3, ...HEAVY },
          { name: 'Hip Thrust', sets: 3, ...ACCESSORY },
          { name: 'Walking Lunge', sets: 3, ...ACCESSORY },
          { name: 'Seated Calf Raise', sets: 4, ...ISOLATION },
          { name: 'Machine Crunch', sets: 3, ...ISOLATION },
        ],
      },
    ],
  },
];
