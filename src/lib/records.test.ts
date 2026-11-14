/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beats, bestSet, formatSet, lastPerformance, recordSetIds } from './records.ts';
import type { Workout } from './types.ts';

let n = 0;
const set = (reps: number, weight: number, done = true) => ({ id: `s${++n}`, reps, weight, done });
const workout = (startedAt: number, exercises: Record<string, ReturnType<typeof set>[]>): Workout => ({
  id: `w${startedAt}`,
  name: 'w',
  startedAt,
  accumulatedMs: 0,
  resumedAt: null,
  intensity: 'moderate',
  exercises: Object.entries(exercises).map(([exerciseId, sets]) => ({ id: `e${++n}`, exerciseId, name: exerciseId, sets })),
});

// newest first, like the store keeps them
const history = [
  workout(300, { squat: [set(5, 100)] }),
  workout(200, { bench: [set(10, 60), set(8, 70), set(12, 80, false)] }),
  workout(100, { bench: [set(10, 50)] }),
];

test('beats: more weight, or same weight and more reps', () => {
  assert.ok(beats({ reps: 1, weight: 80 }, { reps: 10, weight: 70 }));
  assert.ok(beats({ reps: 9, weight: 70 }, { reps: 8, weight: 70 }));
  assert.ok(!beats({ reps: 8, weight: 70 }, { reps: 8, weight: 70 }));
  assert.ok(!beats({ reps: 20, weight: 60 }, { reps: 8, weight: 70 }));
});

test('lastPerformance: done sets from the most recent workout with the exercise', () => {
  assert.deepEqual(lastPerformance(history, 'bench').map((s) => [s.reps, s.weight]), [[10, 60], [8, 70]]);
  assert.deepEqual(lastPerformance(history, 'curl'), []);
});

test('bestSet ignores skipped sets and respects `before`', () => {
  assert.equal(bestSet(history, 'bench')?.weight, 70);
  assert.equal(bestSet(history, 'bench', 200)?.weight, 50);
  assert.equal(bestSet(history, 'bench', 100), null);
});

test('recordSetIds: only sets that beat the running best', () => {
  const w = workout(400, { bench: [set(8, 70), set(9, 70), set(5, 75), set(5, 75), set(3, 90, false)] });
  const ids = recordSetIds(w, history);
  const sets = w.exercises[0].sets;
  assert.deepEqual([...ids], [sets[1].id, sets[2].id]);
});

test('recordSetIds: first time doing an exercise is not a record', () => {
  assert.equal(recordSetIds(workout(400, { curl: [set(10, 20), set(10, 25)] }), history).size, 0);
});

test('recordSetIds: a workout in history is not compared with itself or later ones', () => {
  assert.equal(recordSetIds(history[2], history).size, 0);
  assert.equal(recordSetIds(history[1], history).size, 2); // 10×60 then 8×70 both beat 10×50
});

test('formatSet', () => {
  assert.equal(formatSet({ reps: 8, weight: 70 }), '8 × 70 kg');
  assert.equal(formatSet({ reps: 12, weight: 0 }), '12 reps');
  assert.equal(formatSet({ reps: 8, weight: 70 }, false), '8 reps');
});
