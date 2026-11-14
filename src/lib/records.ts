/**
 * Progress helpers built on the workout history: what you did last time for an
 * exercise, and which sets are personal records. Pure functions (unit tested).
 */
import type { Workout, WorkoutSet } from './types.ts';

type SetLike = Pick<WorkoutSet, 'reps' | 'weight'>;

const counts = (s: WorkoutSet) => s.done && s.reps > 0;

/** A set beats another with more weight, or the same weight for more reps. */
export function beats(a: SetLike, b: SetLike): boolean {
  return a.weight > b.weight || (a.weight === b.weight && a.reps > b.reps);
}

/** Completed sets of the most recent workout that included the exercise. `workouts` is newest first. */
export function lastPerformance(workouts: Workout[], exerciseId: string): WorkoutSet[] {
  for (const w of workouts) {
    const sets = w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter(counts));
    if (sets.length) return sets;
  }
  return [];
}

/** Best completed set for the exercise in workouts started before `before`. */
export function bestSet(workouts: Workout[], exerciseId: string, before = Infinity): WorkoutSet | null {
  let best: WorkoutSet | null = null;
  for (const w of workouts) {
    if (w.startedAt >= before) continue;
    for (const e of w.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      for (const s of e.sets) if (counts(s) && (!best || beats(s, best))) best = s;
    }
  }
  return best;
}

/**
 * Ids of the sets in `workout` that were personal records at the time they were
 * done: each one beats the best from earlier workouts and from earlier sets of
 * this workout. The first time an exercise is done nothing counts as a record.
 */
export function recordSetIds(workout: Workout, history: Workout[]): Set<string> {
  const ids = new Set<string>();
  const bestByExercise = new Map<string, SetLike | null>();
  for (const e of workout.exercises) {
    if (!bestByExercise.has(e.exerciseId)) {
      bestByExercise.set(e.exerciseId, bestSet(history, e.exerciseId, workout.startedAt));
    }
    let best = bestByExercise.get(e.exerciseId) ?? null;
    if (!best) continue;
    for (const s of e.sets) {
      if (counts(s) && beats(s, best)) {
        ids.add(s.id);
        best = s;
      }
    }
    bestByExercise.set(e.exerciseId, best);
  }
  return ids;
}

export function formatSet(s: SetLike, withWeight = true): string {
  return withWeight && s.weight > 0 ? `${s.reps} × ${s.weight} kg` : `${s.reps} reps`;
}
