/**
 * Synthetic wrist-accelerometer signals for testing the rep counter.
 * Deterministic (seeded noise) so tests and the shared fixtures are stable.
 */
import type { Sample } from './repCounter.ts';

export type Segment =
  | { kind: 'rest'; seconds: number }
  | {
      kind: 'reps';
      reps: number;
      /** Seconds per rep. */
      tempo: number;
      /** Peak linear acceleration along the movement axis (g). */
      motion?: number;
      /** Peak forearm tilt change (radians). */
      tilt?: number;
      /** How much the tempo varies from rep to rep (0-1). */
      tempoJitter?: number;
    }
  /** One-off jolt: racking the bar, grabbing the handle. */
  | { kind: 'bump'; magnitude: number; seconds?: number };

export type SignalOptions = {
  hz?: number;
  /** Gaussian-ish sensor noise, standard deviation in g. */
  noise?: number;
  /** Which way gravity points in the sensor frame (any vector). */
  gravity?: [number, number, number];
  /** Movement direction in the sensor frame (any vector). */
  axis?: [number, number, number];
  seed?: number;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const unit = (v: [number, number, number]): [number, number, number] => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};

export function makeSignal(segments: Segment[], options: SignalOptions = {}): Sample[] {
  const hz = options.hz ?? 25;
  const noise = options.noise ?? 0.01;
  const g = unit(options.gravity ?? [0, 0, -1]);
  const axis = unit(options.axis ?? [0, 0, 1]);
  // A direction perpendicular to gravity, to tilt towards.
  const helper: [number, number, number] = Math.abs(g[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const perp = unit([
    g[1] * helper[2] - g[2] * helper[1],
    g[2] * helper[0] - g[0] * helper[2],
    g[0] * helper[1] - g[1] * helper[0],
  ]);
  const rand = mulberry32(options.seed ?? 1);
  const gauss = () => (rand() + rand() + rand() + rand() - 2) * 1.732; // ~N(0,1)

  const out: Sample[] = [];
  const dt = 1000 / hz;
  let t = 0;
  const emit = (motion: number, tilt: number) => {
    const c = Math.cos(tilt);
    const s = Math.sin(tilt);
    out.push({
      t,
      x: g[0] * c + perp[0] * s + axis[0] * motion + gauss() * noise,
      y: g[1] * c + perp[1] * s + axis[1] * motion + gauss() * noise,
      z: g[2] * c + perp[2] * s + axis[2] * motion + gauss() * noise,
    });
    t += dt;
  };

  for (const seg of segments) {
    if (seg.kind === 'rest') {
      for (let i = 0; i < seg.seconds * hz; i++) emit(0, 0);
    } else if (seg.kind === 'bump') {
      const n = Math.max(2, Math.round((seg.seconds ?? 0.3) * hz));
      for (let i = 0; i < n; i++) emit(seg.magnitude * Math.sin((Math.PI * i) / n), 0);
    } else {
      for (let r = 0; r < seg.reps; r++) {
        const tempo = seg.tempo * (1 + (seg.tempoJitter ?? 0) * (rand() * 2 - 1));
        const n = Math.round(tempo * hz);
        for (let i = 0; i < n; i++) {
          const phase = (2 * Math.PI * i) / n;
          // Position follows (1 - cos) / 2, so acceleration follows cos; tilt follows position.
          emit((seg.motion ?? 0) * Math.cos(phase), ((seg.tilt ?? 0) * (1 - Math.cos(phase))) / 2);
        }
      }
    }
  }
  return out;
}
