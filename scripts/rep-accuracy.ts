/// <reference types="node" />
/**
 * Accuracy report for the rep counter on randomized synthetic sets
 * (random orientation, tempo, amplitude, noise, plus jolts before and after).
 * Run: npm run rep:accuracy
 */
import { REP_PROFILES, countReps } from '../src/lib/repCounter.ts';
import { makeSignal } from '../src/lib/repSignals.ts';
let seed = 12345; const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const v3 = (): [number, number, number] => [r() - 0.5, r() - 0.5, r() - 0.5];
for (const mode of ['free', 'anchored'] as const) {
  const errs: Record<string, number> = {}; let n = 0, exact = 0, within1 = 0;
  for (let i = 0; i < 500; i++) {
    const reps = 3 + Math.floor(r() * 13), tempo = 1.2 + r() * 3;
    const seg = mode === 'free'
      ? { kind: 'reps' as const, reps, tempo, motion: 0.12 + r() * 0.4, tilt: r() * 0.3, tempoJitter: r() * 0.25 }
      : { kind: 'reps' as const, reps, tempo: Math.max(1.6, tempo), motion: r() * 0.03, tilt: 0.12 + r() * 0.3, tempoJitter: r() * 0.25 };
    const s = makeSignal([{ kind: 'rest', seconds: 2 + r() * 3 }, { kind: 'bump', magnitude: r() * 0.6, seconds: 0.1 + r() * 0.2 }, { kind: 'rest', seconds: 1 + r() * 2 }, seg, { kind: 'rest', seconds: 1 + r() * 2 }, { kind: 'bump', magnitude: r() * 0.6, seconds: 0.1 + r() * 0.2 }, { kind: 'rest', seconds: 3 }],
      { hz: [25, 50][i % 2], noise: 0.005 + r() * 0.025, gravity: v3(), axis: v3(), seed: i + 1 });
    const e = countReps(s, REP_PROFILES[mode]) - reps;
    errs[e] = (errs[e] ?? 0) + 1; n++; if (e === 0) exact++; if (Math.abs(e) <= 1) within1++;
  }
  console.log(mode, 'exact', (100 * exact / n).toFixed(1) + '%', 'within±1', (100 * within1 / n).toFixed(1) + '%', JSON.stringify(errs));
}
