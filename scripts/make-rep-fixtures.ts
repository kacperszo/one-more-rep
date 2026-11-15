/// <reference types="node" />
/**
 * Writes shared test data for the rep counter ports (Swift, Monkey C).
 * Each fixture has samples as [tMs, x, y, z] in g and the count the reference
 * TypeScript implementation produces. Run: npm run rep:fixtures
 */
import { writeFileSync } from 'node:fs';
import { REP_PROFILES, countReps, type RepProfile } from '../src/lib/repCounter.ts';
import { makeSignal, type Segment, type SignalOptions } from '../src/lib/repSignals.ts';

const rest = (seconds: number): Segment => ({ kind: 'rest', seconds });

const cases: { name: string; profile: RepProfile; reps: number; segments: Segment[]; options?: SignalOptions }[] = [
  { name: 'press-10', profile: 'free', reps: 10, segments: [rest(3), { kind: 'reps', reps: 10, tempo: 2, motion: 0.3 }, rest(3)] },
  {
    name: 'curl-12-uneven',
    profile: 'free',
    reps: 12,
    segments: [rest(2), { kind: 'reps', reps: 12, tempo: 2, motion: 0.3, tempoJitter: 0.3 }, rest(3)],
    options: { seed: 7, gravity: [0.5, 0.5, -0.7], axis: [1, 0, 0] },
  },
  {
    name: 'pullup-8',
    profile: 'anchored',
    reps: 8,
    segments: [rest(3), { kind: 'reps', reps: 8, tempo: 2.5, motion: 0.01, tilt: 0.25 }, rest(3)],
    options: { gravity: [1, 0, 0] },
  },
  { name: 'still-30s', profile: 'free', reps: 0, segments: [rest(30)], options: { noise: 0.015 } },
  {
    name: 'jolts-only',
    profile: 'free',
    reps: 0,
    segments: [rest(3), { kind: 'bump', magnitude: 0.8 }, rest(5), { kind: 'bump', magnitude: 1, seconds: 0.1 }, rest(5)],
  },
];

const round = (n: number) => Math.round(n * 1000) / 1000;

for (const c of cases) {
  // Quantize first, then count, so ports see exactly the same numbers.
  const samples = makeSignal(c.segments, c.options).map((s) => ({ t: s.t, x: round(s.x), y: round(s.y), z: round(s.z) }));
  const count = countReps(samples, REP_PROFILES[c.profile]);
  if (count !== c.reps) throw new Error(`${c.name}: reference counted ${count}, expected ${c.reps}`);
  const fixture = {
    name: c.name,
    profile: c.profile,
    options: REP_PROFILES[c.profile],
    expectedCount: count,
    samples: samples.map((s) => [s.t, s.x, s.y, s.z]),
  };
  writeFileSync(new URL(`../watch/fixtures/${c.name}.json`, import.meta.url), JSON.stringify(fixture) + '\n');
  console.log(`${c.name}: ${samples.length} samples, ${count} reps`);
}
