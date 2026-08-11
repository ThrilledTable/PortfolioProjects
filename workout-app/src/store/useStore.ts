import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Exercise,
  TemplateExercise,
  Mesocycle,
  MesoDay,
  WorkoutSession,
  SessionExercise,
  LoggedSet,
  SetType,
  ActivePosition,
  Settings,
} from '../types';
import { SEED_EXERCISES } from '../data/seedExercises';
import { genId } from '../utils/id';

interface ExerciseHistoryEntry {
  sessionId: string;
  date: string;
  week: number;
  dayName: string;
  sets: LoggedSet[];
}

export interface BackupData {
  exercises: Exercise[];
  mesocycles: Mesocycle[];
  sessions: WorkoutSession[];
  active: ActivePosition | null;
  settings: Settings;
}

interface StoreState {
  exercises: Exercise[];
  mesocycles: Mesocycle[];
  sessions: WorkoutSession[];
  active: ActivePosition | null;
  settings: Settings;

  addExercise: (data: Omit<Exercise, 'id' | 'custom'>) => Exercise;
  deleteExercise: (id: string) => void;

  addMesocycle: (name: string, weeks: number, days: MesoDay[], deloadWeeks?: number[]) => Mesocycle;
  updateMesocycle: (id: string, patch: Partial<Omit<Mesocycle, 'id'>>) => void;
  deleteMesocycle: (id: string) => void;
  duplicateMesocycle: (id: string) => void;

  setActive: (mesoId: string, week: number, dayIndex: number) => void;
  clearActive: () => void;
  stepDay: (direction: 1 | -1) => void;

  getOrCreateSession: (mesoId: string, week: number, dayIndex: number) => string;
  updateSetField: (
    sessionId: string,
    sessionExerciseId: string,
    setId: string,
    field: 'weight' | 'reps' | 'rir',
    value: string
  ) => void;
  toggleSetLogged: (sessionId: string, sessionExerciseId: string, setId: string) => void;
  setLoggedSetType: (
    sessionId: string,
    sessionExerciseId: string,
    setId: string,
    type: SetType
  ) => void;
  addSet: (sessionId: string, sessionExerciseId: string) => void;
  removeSet: (sessionId: string, sessionExerciseId: string, setId: string) => void;
  completeSession: (sessionId: string) => void;
  updateSessionNotes: (sessionId: string, notes: string) => void;

  getExerciseHistory: (exerciseId: string) => ExerciseHistoryEntry[];
  getPreviousSessionExercise: (
    mesoId: string,
    dayId: string,
    exerciseId: string,
    beforeWeek: number
  ) => SessionExercise | undefined;

  updateSettings: (patch: Partial<Settings>) => void;
  getBackupData: () => BackupData;
  restoreFromBackup: (data: BackupData) => void;
}

const DEFAULT_SETTINGS: Settings = { unit: 'lbs', defaultRestSeconds: 90 };

export function isValidBackupData(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.exercises) &&
    Array.isArray(d.mesocycles) &&
    Array.isArray(d.sessions) &&
    typeof d.settings === 'object' &&
    d.settings !== null
  );
}

const makeLoggedSet = (rir: number): LoggedSet => ({
  id: genId(),
  weight: '',
  reps: '',
  rir: String(rir),
  logged: false,
  type: 'working',
});

const findPreviousSession = (
  sessions: WorkoutSession[],
  mesoId: string,
  dayId: string,
  beforeWeek: number
): WorkoutSession | undefined => {
  const candidates = sessions.filter(
    (s) => s.mesoId === mesoId && s.dayId === dayId && s.week < beforeWeek
  );
  if (candidates.length === 0) return undefined;
  return candidates.reduce((latest, s) => (s.week > latest.week ? s : latest));
};

const buildSessionExercise = (
  te: TemplateExercise,
  prevExercise?: SessionExercise
): SessionExercise => ({
  id: genId(),
  exerciseId: te.exerciseId,
  sets: te.sets.map((ts, i) => {
    const base = makeLoggedSet(ts.rir);
    const prevSet = prevExercise?.sets[i];
    if (prevSet && prevSet.logged && prevSet.reps !== '') {
      return { ...base, weight: prevSet.weight, reps: prevSet.reps };
    }
    return base;
  }),
});

const cloneExercises = (exercises: TemplateExercise[]): TemplateExercise[] =>
  exercises.map((te) => ({
    id: genId(),
    exerciseId: te.exerciseId,
    sets: te.sets.map((s) => ({ ...s, id: genId() })),
  }));

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      exercises: SEED_EXERCISES,
      mesocycles: [],
      sessions: [],
      active: null,
      settings: DEFAULT_SETTINGS,

      addExercise: (data) => {
        const exercise: Exercise = { ...data, id: genId(), custom: true };
        set((s) => ({ exercises: [...s.exercises, exercise] }));
        return exercise;
      },
      deleteExercise: (id) => {
        set((s) => ({ exercises: s.exercises.filter((e) => e.id !== id) }));
      },

      addMesocycle: (name, weeks, days, deloadWeeks = []) => {
        const meso: Mesocycle = { id: genId(), name, weeks, days, deloadWeeks };
        set((s) => ({ mesocycles: [...s.mesocycles, meso] }));
        return meso;
      },
      updateMesocycle: (id, patch) => {
        set((s) => {
          const mesocycles = s.mesocycles.map((m) => (m.id === id ? { ...m, ...patch } : m));
          if (s.active?.mesoId !== id) return { mesocycles };
          const updated = mesocycles.find((m) => m.id === id);
          if (!updated) return { mesocycles };
          if (updated.days.length === 0) {
            return { mesocycles, active: null };
          }
          const week = Math.min(s.active.week, updated.weeks);
          const dayIndex = Math.min(s.active.dayIndex, updated.days.length - 1);
          if (week === s.active.week && dayIndex === s.active.dayIndex) {
            return { mesocycles };
          }
          return { mesocycles, active: { mesoId: id, week, dayIndex } };
        });
      },
      deleteMesocycle: (id) => {
        set((s) => ({
          mesocycles: s.mesocycles.filter((m) => m.id !== id),
          active: s.active?.mesoId === id ? null : s.active,
        }));
      },
      duplicateMesocycle: (id) => {
        set((s) => {
          const source = s.mesocycles.find((m) => m.id === id);
          if (!source) return s;
          const copy: Mesocycle = {
            id: genId(),
            name: `${source.name} Copy`,
            weeks: source.weeks,
            deloadWeeks: [...source.deloadWeeks],
            days: source.days.map((d) => ({
              id: genId(),
              name: d.name,
              muscleGroups: d.muscleGroups,
              exercises: cloneExercises(d.exercises),
            })),
          };
          return { mesocycles: [...s.mesocycles, copy] };
        });
      },

      setActive: (mesoId, week, dayIndex) => {
        set({ active: { mesoId, week, dayIndex } });
      },
      clearActive: () => set({ active: null }),

      stepDay: (direction) => {
        const { active, mesocycles } = get();
        if (!active) return;
        const meso = mesocycles.find((m) => m.id === active.mesoId);
        if (!meso || meso.days.length === 0) return;
        let { week, dayIndex } = active;
        dayIndex += direction;
        if (dayIndex >= meso.days.length) {
          dayIndex = 0;
          week = Math.min(week + 1, meso.weeks);
        } else if (dayIndex < 0) {
          dayIndex = meso.days.length - 1;
          week = Math.max(week - 1, 1);
        }
        set({ active: { mesoId: active.mesoId, week, dayIndex } });
      },

      getOrCreateSession: (mesoId, week, dayIndex) => {
        const { sessions, mesocycles } = get();
        const meso = mesocycles.find((m) => m.id === mesoId);
        if (!meso) throw new Error('Mesocycle not found');
        const day = meso.days[dayIndex];
        if (!day) throw new Error('Day not found');

        const existing = sessions.find(
          (s) => s.mesoId === mesoId && s.week === week && s.dayId === day.id
        );
        if (existing) {
          const missing = day.exercises.filter(
            (te) => !existing.exercises.some((se) => se.exerciseId === te.exerciseId)
          );
          if (missing.length > 0) {
            const prevSession = findPreviousSession(sessions, mesoId, day.id, week);
            const newSessionExercises: SessionExercise[] = missing.map((te) =>
              buildSessionExercise(
                te,
                prevSession?.exercises.find((se) => se.exerciseId === te.exerciseId)
              )
            );
            set((s) => ({
              sessions: s.sessions.map((sess) =>
                sess.id !== existing.id
                  ? sess
                  : { ...sess, exercises: [...sess.exercises, ...newSessionExercises] }
              ),
            }));
          }
          return existing.id;
        }

        const prevSession = findPreviousSession(sessions, mesoId, day.id, week);
        const sessionExercises: SessionExercise[] = day.exercises.map((te) =>
          buildSessionExercise(
            te,
            prevSession?.exercises.find((se) => se.exerciseId === te.exerciseId)
          )
        );

        const session: WorkoutSession = {
          id: genId(),
          mesoId,
          mesoName: meso.name,
          week,
          dayId: day.id,
          dayName: day.name,
          date: new Date().toISOString(),
          exercises: sessionExercises,
        };
        set((s) => ({ sessions: [...s.sessions, session] }));
        return session.id;
      },

      updateSetField: (sessionId, sessionExerciseId, setId, field, value) => {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id !== sessionId
              ? sess
              : {
                  ...sess,
                  exercises: sess.exercises.map((se) =>
                    se.id !== sessionExerciseId
                      ? se
                      : {
                          ...se,
                          sets: se.sets.map((st) =>
                            st.id === setId ? { ...st, [field]: value } : st
                          ),
                        }
                  ),
                }
          ),
        }));
      },

      toggleSetLogged: (sessionId, sessionExerciseId, setId) => {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id !== sessionId
              ? sess
              : {
                  ...sess,
                  exercises: sess.exercises.map((se) =>
                    se.id !== sessionExerciseId
                      ? se
                      : {
                          ...se,
                          sets: se.sets.map((st) =>
                            st.id === setId ? { ...st, logged: !st.logged } : st
                          ),
                        }
                  ),
                }
          ),
        }));
      },

      setLoggedSetType: (sessionId, sessionExerciseId, setId, type) => {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id !== sessionId
              ? sess
              : {
                  ...sess,
                  exercises: sess.exercises.map((se) =>
                    se.id !== sessionExerciseId
                      ? se
                      : {
                          ...se,
                          sets: se.sets.map((st) => (st.id === setId ? { ...st, type } : st)),
                        }
                  ),
                }
          ),
        }));
      },

      addSet: (sessionId, sessionExerciseId) => {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id !== sessionId
              ? sess
              : {
                  ...sess,
                  exercises: sess.exercises.map((se) =>
                    se.id !== sessionExerciseId
                      ? se
                      : {
                          ...se,
                          sets: [
                            ...se.sets,
                            makeLoggedSet(Number(se.sets[se.sets.length - 1]?.rir ?? 3)),
                          ],
                        }
                  ),
                }
          ),
        }));
      },

      removeSet: (sessionId, sessionExerciseId, setId) => {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id !== sessionId
              ? sess
              : {
                  ...sess,
                  exercises: sess.exercises.map((se) =>
                    se.id !== sessionExerciseId
                      ? se
                      : { ...se, sets: se.sets.filter((st) => st.id !== setId) }
                  ),
                }
          ),
        }));
      },

      completeSession: (sessionId) => {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id !== sessionId
              ? sess
              : { ...sess, completedAt: sess.completedAt ? undefined : new Date().toISOString() }
          ),
        }));
      },

      updateSessionNotes: (sessionId, notes) => {
        set((s) => ({
          sessions: s.sessions.map((sess) => (sess.id !== sessionId ? sess : { ...sess, notes })),
        }));
      },

      getPreviousSessionExercise: (mesoId, dayId, exerciseId, beforeWeek) => {
        const prevSession = findPreviousSession(get().sessions, mesoId, dayId, beforeWeek);
        return prevSession?.exercises.find((se) => se.exerciseId === exerciseId);
      },

      updateSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
      },

      getBackupData: () => {
        const s = get();
        return {
          exercises: s.exercises,
          mesocycles: s.mesocycles,
          sessions: s.sessions,
          active: s.active,
          settings: s.settings,
        };
      },

      restoreFromBackup: (data) => {
        set({
          exercises: data.exercises,
          mesocycles: data.mesocycles,
          sessions: data.sessions,
          active: data.active,
          settings: { ...DEFAULT_SETTINGS, ...data.settings },
        });
      },

      getExerciseHistory: (exerciseId) => {
        const { sessions } = get();
        const entries: ExerciseHistoryEntry[] = [];
        for (const session of sessions) {
          const se = session.exercises.find((e) => e.exerciseId === exerciseId);
          if (!se) continue;
          const loggedSets = se.sets.filter((st) => st.logged && st.reps !== '');
          if (loggedSets.length === 0) continue;
          entries.push({
            sessionId: session.id,
            date: session.date,
            week: session.week,
            dayName: session.dayName,
            sets: loggedSets,
          });
        }
        return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      },
    }),
    {
      name: 'workout-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        exercises: s.exercises,
        mesocycles: s.mesocycles,
        sessions: s.sessions,
        active: s.active,
        settings: s.settings,
      }),
    }
  )
);
