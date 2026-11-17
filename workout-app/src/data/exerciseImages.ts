import { ImageSourcePropType } from 'react-native';

/**
 * Photos for each exercise, from the free-exercise-db public-domain dataset
 * (https://github.com/yuhonas/free-exercise-db, Unlicense). See
 * assets/exercises/ATTRIBUTION.md.
 *
 * The mapping is hand-checked rather than name-matched: the dataset holds many
 * near-identical names, and automatic matching paired a shrug with a row and a
 * plain bench press with a guillotine press. Each entry below was confirmed
 * against the source exercise's equipment and target muscle.
 *
 * Metro needs a literal path in require(), so this table cannot be generated at
 * runtime -- it is written out rather than built from the exercise list.
 */
const IMAGES: Record<string, ImageSourcePropType[]> = {
  'Barbell Back Squat': [require('../../assets/exercises/barbell_back_squat/0.jpg'), require('../../assets/exercises/barbell_back_squat/1.jpg')],
  'Barbell Bench Press': [require('../../assets/exercises/barbell_bench_press/0.jpg'), require('../../assets/exercises/barbell_bench_press/1.jpg')],
  'Barbell Curl': [require('../../assets/exercises/barbell_curl/0.jpg'), require('../../assets/exercises/barbell_curl/1.jpg')],
  'Barbell Row': [require('../../assets/exercises/barbell_row/0.jpg'), require('../../assets/exercises/barbell_row/1.jpg')],
  'Barbell Shrug': [require('../../assets/exercises/barbell_shrug/0.jpg'), require('../../assets/exercises/barbell_shrug/1.jpg')],
  'Cable Curl': [require('../../assets/exercises/cable_curl/0.jpg'), require('../../assets/exercises/cable_curl/1.jpg')],
  'Cable Fly': [require('../../assets/exercises/cable_fly/0.jpg'), require('../../assets/exercises/cable_fly/1.jpg')],
  'Cable Kickback': [require('../../assets/exercises/cable_kickback/0.jpg'), require('../../assets/exercises/cable_kickback/1.jpg')],
  'Cable Lateral Raise': [require('../../assets/exercises/cable_lateral_raise/0.jpg'), require('../../assets/exercises/cable_lateral_raise/1.jpg')],
  'Cable Rope Crunch': [require('../../assets/exercises/cable_rope_crunch/0.jpg'), require('../../assets/exercises/cable_rope_crunch/1.jpg')],
  'Cable Shrug': [require('../../assets/exercises/cable_shrug/0.jpg'), require('../../assets/exercises/cable_shrug/1.jpg')],
  'Cable Tricep Pushdown': [require('../../assets/exercises/cable_tricep_pushdown/0.jpg'), require('../../assets/exercises/cable_tricep_pushdown/1.jpg')],
  'Deadlift': [require('../../assets/exercises/deadlift/0.jpg'), require('../../assets/exercises/deadlift/1.jpg')],
  'Dips': [require('../../assets/exercises/dips/0.jpg'), require('../../assets/exercises/dips/1.jpg')],
  'Dumbbell Curl': [require('../../assets/exercises/dumbbell_curl/0.jpg'), require('../../assets/exercises/dumbbell_curl/1.jpg')],
  'Dumbbell Lateral Raise': [require('../../assets/exercises/dumbbell_lateral_raise/0.jpg'), require('../../assets/exercises/dumbbell_lateral_raise/1.jpg')],
  'Dumbbell Shrug': [require('../../assets/exercises/dumbbell_shrug/0.jpg'), require('../../assets/exercises/dumbbell_shrug/1.jpg')],
  'Farmer Carry': [require('../../assets/exercises/farmer_carry/0.jpg'), require('../../assets/exercises/farmer_carry/1.jpg')],
  'Glute Bridge': [require('../../assets/exercises/glute_bridge/0.jpg'), require('../../assets/exercises/glute_bridge/1.jpg')],
  'Hanging Leg Raise': [require('../../assets/exercises/hanging_leg_raise/0.jpg'), require('../../assets/exercises/hanging_leg_raise/1.jpg')],
  'Hip Thrust': [require('../../assets/exercises/hip_thrust/0.jpg'), require('../../assets/exercises/hip_thrust/1.jpg')],
  'Incline Dumbbell Press': [require('../../assets/exercises/incline_dumbbell_press/0.jpg'), require('../../assets/exercises/incline_dumbbell_press/1.jpg')],
  'Lat Pulldown': [require('../../assets/exercises/lat_pulldown/0.jpg'), require('../../assets/exercises/lat_pulldown/1.jpg')],
  'Leg Extension': [require('../../assets/exercises/leg_extension/0.jpg'), require('../../assets/exercises/leg_extension/1.jpg')],
  'Leg Press': [require('../../assets/exercises/leg_press/0.jpg'), require('../../assets/exercises/leg_press/1.jpg')],
  'Lying Leg Curl': [require('../../assets/exercises/lying_leg_curl/0.jpg'), require('../../assets/exercises/lying_leg_curl/1.jpg')],
  'Machine Chest Press': [require('../../assets/exercises/machine_chest_press/0.jpg'), require('../../assets/exercises/machine_chest_press/1.jpg')],
  'Machine Crunch': [require('../../assets/exercises/machine_crunch/0.jpg'), require('../../assets/exercises/machine_crunch/1.jpg')],
  'Machine Shoulder Press': [require('../../assets/exercises/machine_shoulder_press/0.jpg'), require('../../assets/exercises/machine_shoulder_press/1.jpg')],
  'Overhead Press': [require('../../assets/exercises/overhead_press/0.jpg'), require('../../assets/exercises/overhead_press/1.jpg')],
  'Overhead Tricep Extension': [require('../../assets/exercises/overhead_tricep_extension/0.jpg'), require('../../assets/exercises/overhead_tricep_extension/1.jpg')],
  'Plank': [require('../../assets/exercises/plank/0.jpg'), require('../../assets/exercises/plank/1.jpg')],
  'Preacher Curl': [require('../../assets/exercises/preacher_curl/0.jpg'), require('../../assets/exercises/preacher_curl/1.jpg')],
  'Pull Up': [require('../../assets/exercises/pull_up/0.jpg'), require('../../assets/exercises/pull_up/1.jpg')],
  'Push Up': [require('../../assets/exercises/push_up/0.jpg'), require('../../assets/exercises/push_up/1.jpg')],
  'Rear Delt Fly': [require('../../assets/exercises/rear_delt_fly/0.jpg'), require('../../assets/exercises/rear_delt_fly/1.jpg')],
  'Romanian Deadlift': [require('../../assets/exercises/romanian_deadlift/0.jpg'), require('../../assets/exercises/romanian_deadlift/1.jpg')],
  'Seated Cable Row': [require('../../assets/exercises/seated_cable_row/0.jpg'), require('../../assets/exercises/seated_cable_row/1.jpg')],
  'Seated Calf Raise': [require('../../assets/exercises/seated_calf_raise/0.jpg'), require('../../assets/exercises/seated_calf_raise/1.jpg')],
  'Seated Leg Curl': [require('../../assets/exercises/seated_leg_curl/0.jpg'), require('../../assets/exercises/seated_leg_curl/1.jpg')],
  'Sit Up': [require('../../assets/exercises/sit_up/0.jpg'), require('../../assets/exercises/sit_up/1.jpg')],
  'Skull Crusher': [require('../../assets/exercises/skull_crusher/0.jpg'), require('../../assets/exercises/skull_crusher/1.jpg')],
  'Standing Calf Raise': [require('../../assets/exercises/standing_calf_raise/0.jpg'), require('../../assets/exercises/standing_calf_raise/1.jpg')],
  'T-Bar Row': [require('../../assets/exercises/t_bar_row/0.jpg'), require('../../assets/exercises/t_bar_row/1.jpg')],
  'Walking Lunge': [require('../../assets/exercises/walking_lunge/0.jpg'), require('../../assets/exercises/walking_lunge/1.jpg')],
  'Wrist Curl': [require('../../assets/exercises/wrist_curl/0.jpg'), require('../../assets/exercises/wrist_curl/1.jpg')],
};

/**
 * Photos for an exercise, or an empty array when there is none -- callers fall
 * back to the drawn diagram. Matching is by name, so a custom exercise a user
 * adds will simply have no photos rather than borrowing someone else's.
 */
export function getExerciseImages(exerciseName: string): ImageSourcePropType[] {
  return IMAGES[exerciseName] ?? [];
}
