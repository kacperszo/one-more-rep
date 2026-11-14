/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES, REQUIRES, flags, resolveFlags, type FeatureFlag } from './features.ts';

const allOn = Object.fromEntries(Object.keys(FEATURES).map((k) => [k, true])) as Record<FeatureFlag, boolean>;

test('requirements only reference existing flags', () => {
  for (const [name, deps] of Object.entries(REQUIRES)) {
    assert.ok(name in FEATURES, name);
    for (const dep of deps) assert.ok(dep in FEATURES, `${name} requires unknown ${dep}`);
  }
});

test('with everything on, every flag resolves to on', () => {
  assert.deepEqual(resolveFlags(allOn), allOn);
});

test('a flag is off when something it requires is off (transitively)', () => {
  const r = resolveFlags({ ...allOn, workout: false });
  assert.equal(r.stopwatch, false);
  assert.equal(r.restTimer, false);
  assert.equal(r.calories, false, 'calories -> stopwatch -> workout');
  assert.equal(r.repeatWorkout, false);
  assert.equal(r.exercises, true);
  assert.equal(r.history, true);
});

test('repeatWorkout needs both workout and history', () => {
  assert.equal(resolveFlags({ ...allOn, history: false }).repeatWorkout, false);
});

test('dependency cycles fail closed instead of looping', () => {
  const r = resolveFlags(allOn, { workout: ['history'], history: ['workout'] });
  assert.equal(r.workout, false);
  assert.equal(r.history, false);
});

test('exported flags match the configured values', () => {
  assert.deepEqual(flags, resolveFlags(FEATURES));
});
