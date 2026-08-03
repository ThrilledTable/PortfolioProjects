import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Exercise,
  Template,
  TemplateExercise,
  Mesocycle,
  MesoDay,
  WorkoutSession,
  SessionExercise,
  LoggedSet,
  ActivePosition,
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

interface StoreState {
  exercises: Exercise[];
  templates: Template[];
  mesocycles: Mesocycle[];
  sessions: WorkoutSession[];
  active: ActivePosition | null;

  addExercise: (data: Omit<Exercise, 'id' | 'custom'>) => Exercise;
  deleteExercise: (id: string) => void;

  addTemplate: (name: string, exercises: TemplateExercise[]) => Template;
  updateTemplate: (id: string, patch: Partial<Omit<Template, 'id'>>) => void;
  deleteTemplate: (id: string) => void;

  addMesocycle: (name: string, weeks: number, days: MesoDay[]) => Mesocycle;
  updateMesocycle: (id: string, patch: Partial<Omit<Mesocycle, 'id'>>) => void;
  deleteMesocycle: (id: string) => void;

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
  addSet: (sessionId: string, sessionExerciseId: string) => void;
  removeSet: (sessionId: string, sessionExerciseId: string, setId: string) => void;

  getExerciseHistory: (exerciseId: string) => ExerciseHistoryEntry[];
}

const makeLoggedSet = (rir: number): LoggedSet => ({
  id: genId(),
  weight: '',
  reps: '',
  rir: String(rir),
  logged: false,
});

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      exercises: SEED_EXERCISES,
      templates: [],
      mesocycles: [],
      sessions: [],
      active: null,

      addExercise: (data) => {
        const exercise: Exercise = { ...data, id: genId(), custom: true };
        set((s) => ({ exercises: [...s.exercises, exercise] }));
        return exercise;
      },
      deleteExercise: (id) => {
        set((s) => ({ exercises: s.exercises.filter((e) => e.id !== id) }));
      },

      addTemplate: (name, exercises) => {
        const template: Template = { id: genId(), name, exercises };
        set((s) => ({ templates: [...s.templates, template] }));
        return template;
      },
      updateTemplate: (id, patch) => {
        set((s) => ({
          templates: s.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
      },
      deleteTemplate: (id) => {
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
      },

      addMesocycle: (name, weeks, days) => {
        const meso: Mesocycle = { id: genId(), name, weeks, days };
        set((s) => ({ mesocycles: [...s.mesocycles, meso] }));
        return meso;
      },
      updateMesocycle: (id, patch) => {
        set((s) => ({
          mesocycles: s.mesocycles.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }));
      },
      deleteMesocycle: (id) => {
        set((s) => ({
          mesocycles: s.mesocycles.filter((m) => m.id !== id),
          active: s.active?.mesoId === id ? null : s.active,
        }));
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
        if (existing) return existing.id;

        const sessionExercises: SessionExercise[] = day.exercises.map((te) => ({
          id: genId(),
          exerciseId: te.exerciseId,
          sets: te.sets.map((ts) => makeLoggedSet(ts.rir)),
        }));

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
        templates: s.templates,
        mesocycles: s.mesocycles,
        sessions: s.sessions,
        active: s.active,
      }),
    }
  )
);
