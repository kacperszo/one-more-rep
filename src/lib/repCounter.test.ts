/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REP_PROFILES, RepCounter, countReps, repProfileFor } from './repCounter.ts';
import { makeSignal, type Segment } from './repSignals.ts';

const rest = (seconds: number): Segment => ({ kind: 'rest', seconds });

test('counts clean presses exactly', () => {
  const s = makeSignal([rest(3), { kind: 'reps', reps: 10, tempo: 2, motion: 0.3 }, rest(3)]);
  assert.equal(countReps(s), 10);
});

test('counts nothing while standing still', () => {
  assert.equal(countReps(makeSignal([rest(60)], { noise: 0.015 })), 0);
});

test('a single jolt is not a rep', () => {
  const s = makeSignal([rest(3), { kind: 'bump', magnitude: 0.8 }, rest(5), { kind: 'bump', magnitude: 0.5 }, rest(5)]);
  assert.equal(countReps(s), 0);
  for (const seconds of [0.08, 0.15, 0.3, 0.5]) {
    for (const hz of [25, 50]) {
      const jolt = makeSignal([rest(3), { kind: 'bump', magnitude: 1, seconds }, rest(6)], { hz });
      assert.equal(countReps(jolt), 0, `${seconds}s jolt at ${hz} Hz`);
    }
  }
});

test('works in any sensor orientation and movement direction', () => {
  const orientations: [number, number, number][] = [[0, 0, -1], [1, 0, 0], [0, -1, 0], [0.5, 0.5, -0.7], [-0.3, 0.8, 0.5]];
  for (const gravity of orientations) {
    for (const axis of orientations) {
      const s = makeSignal([rest(2), { kind: 'reps', reps: 8, tempo: 2.2, motion: 0.25 }, rest(2)], { gravity, axis });
      assert.equal(countReps(s), 8, `gravity ${gravity} axis ${axis}`);
    }
  }
});

test('handles slow, fast and uneven tempo', () => {
  for (const tempo of [1.0, 1.5, 3, 4.5]) {
    const s = makeSignal([rest(2), { kind: 'reps', reps: 6, tempo, motion: 0.3 }, rest(3)]);
    assert.equal(countReps(s), 6, `tempo ${tempo}s`);
  }
  const uneven = makeSignal([rest(2), { kind: 'reps', reps: 12, tempo: 2, motion: 0.3, tempoJitter: 0.3 }, rest(3)], { seed: 7 });
  assert.equal(countReps(uneven), 12);
});

test('counts several sets separated by rest and re-racking', () => {
  const s = makeSignal([
    rest(3),
    { kind: 'reps', reps: 8, tempo: 2, motion: 0.3 },
    { kind: 'bump', magnitude: 0.6 },
    rest(40),
    { kind: 'bump', magnitude: 0.6 },
    { kind: 'reps', reps: 6, tempo: 2.4, motion: 0.25 },
    rest(5),
  ]);
  const n = countReps(s);
  assert.ok(Math.abs(n - 14) <= 1, `expected 14 ± 1, got ${n}`);
});

test('stays accurate with sensor noise and different sample rates', () => {
  for (const hz of [10, 25, 50, 100]) {
    for (const seed of [1, 2, 3]) {
      const s = makeSignal([rest(2), { kind: 'reps', reps: 10, tempo: 2, motion: 0.2, tempoJitter: 0.15 }, rest(3)], { hz, noise: 0.03, seed });
      const n = countReps(s);
      assert.ok(Math.abs(n - 10) <= 1, `hz ${hz} seed ${seed}: expected 10 ± 1, got ${n}`);
    }
  }
});

test('anchored profile counts pull-ups from forearm tilt alone', () => {
  // Hand fixed on the bar: almost no linear acceleration at the wrist, only a small tilt change.
  const s = makeSignal([rest(3), { kind: 'reps', reps: 8, tempo: 2.5, motion: 0.01, tilt: 0.25 }, rest(3)], { gravity: [1, 0, 0] });
  assert.equal(countReps(s, REP_PROFILES.anchored), 8);
});

test('reports each rep as it happens and can be reset', () => {
  const counter = new RepCounter();
  const s = makeSignal([rest(2), { kind: 'reps', reps: 5, tempo: 2, motion: 0.3 }, rest(2)]);
  const times = s.filter((sample) => counter.push(sample)).map((sample) => sample.t);
  assert.equal(times.length, 5);
  for (let i = 1; i < times.length; i++) assert.ok(Math.abs(times[i] - times[i - 1] - 2000) < 400, 'reps ~2s apart');
  counter.reset();
  assert.equal(counter.count, 0);
});

test('recovers after a gap in the sample stream', () => {
  const a = makeSignal([rest(2), { kind: 'reps', reps: 5, tempo: 2, motion: 0.3 }]);
  const b = makeSignal([{ kind: 'reps', reps: 5, tempo: 2, motion: 0.3 }, rest(2)]).map((s) => ({ ...s, t: s.t + 60_000 }));
  const n = countReps([...a, ...b]);
  assert.ok(n >= 8 && n <= 10, `got ${n}`);
});

test('picks the anchored profile for bodyweight bar/floor exercises', () => {
  for (const name of ['Pullups', 'Chin-Up', 'Wide-Grip Pull Up', 'Pushups', 'Push-Ups - Close Triceps Position', 'Dips - Chest Version', 'Bench Dips', 'Muscle Up']) {
    assert.equal(repProfileFor(name), 'anchored', name);
  }
  for (const name of ['Barbell Bench Press - Medium Grip', 'Dumbbell Bicep Curl', 'Seated Cable Rows', 'Wide-Grip Lat Pulldown', 'Dumbbell Shoulder Press', 'Triceps Pushdown']) {
    assert.equal(repProfileFor(name), 'free', name);
  }
});
