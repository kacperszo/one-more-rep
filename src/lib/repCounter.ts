/**
 * Counts exercise repetitions from a stream of accelerometer samples.
 *
 * Works for arm push/pull movements (presses, rows, curls, pull-ups, dips,
 * push-ups) with the sensor on the wrist, in any orientation. It does not need
 * to know which way is up.
 *
 * How it works, per sample (constant time, no buffers):
 *   1. Band-pass each axis (~0.2-3 Hz). This removes gravity/slow posture drift
 *      and sensor noise, and keeps both real motion and the tilt changes of the
 *      forearm (which is all you get when the hand is fixed on a bar).
 *   2. Reduce the 3 axes to one signal by projecting onto the direction of
 *      strongest movement, tracked online (Oja's rule = streaming PCA).
 *   3. Count one rep per oscillation of that signal: it must swing above
 *      +threshold and then below -threshold (or the other way round, whichever
 *      came first), where the threshold follows the recent movement amplitude.
 *      Swings that are too fast, too slow or too small are ignored.
 *
 * The same algorithm is ported to Swift (watch/apple) and Monkey C
 * (watch/garmin). Keep the three in sync; watch/fixtures has shared test data.
 */

export type Sample = {
  /** Timestamp in milliseconds. */
  t: number;
  /** Acceleration in g. */
  x: number;
  y: number;
  z: number;
};

export type RepCounterOptions = {
  /** Smallest oscillation amplitude (g) that can count as a rep. */
  minAmplitude: number;
  /** Fastest plausible rep (ms). */
  minRepMs: number;
  /** Slowest plausible rep (ms). A cycle with no progress for half this long is dropped. */
  maxRepMs: number;
  /** Threshold as a fraction of the recent RMS amplitude. */
  thresholdRatio: number;
};

export const DEFAULT_OPTIONS: RepCounterOptions = {
  minAmplitude: 0.04,
  minRepMs: 700,
  maxRepMs: 8000,
  thresholdRatio: 0.6,
};

/** Tuning per movement type. Hand fixed on a bar/floor gives a much weaker signal. */
export const REP_PROFILES = {
  /** Hand moves freely: presses, rows, curls, raises, pulldowns. */
  free: DEFAULT_OPTIONS,
  /** Hand is fixed and the body moves: pull-ups, chin-ups, dips, push-ups. */
  anchored: { ...DEFAULT_OPTIONS, minAmplitude: 0.02, minRepMs: 900 },
} satisfies Record<string, RepCounterOptions>;

export type RepProfile = keyof typeof REP_PROFILES;

const ANCHORED_EXERCISES = /pull[\s-]?up|chin[\s-]?up|muscle[\s-]?up|push[\s-]?up|\bdips?\b|inverted row|handstand/i;

/** Picks the tuning for an exercise from its name. */
export function repProfileFor(exerciseName: string): RepProfile {
  return ANCHORED_EXERCISES.test(exerciseName) ? 'anchored' : 'free';
}

const HIGH_PASS_HZ = 0.2;
const LOW_PASS_HZ = 3;
const RMS_WINDOW_S = 3;
const PCA_RATE = 4; // learning rate of the direction tracker, per second per g^2
const SWING_RATIO = 0.5; // return swing must reach this fraction of the previous swing
const MAX_DT_S = 0.2; // longer gaps reset the filters

const alpha = (cutoffHz: number, dt: number) => {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  return dt / (rc + dt);
};

export class RepCounter {
  readonly options: RepCounterOptions;

  /** Reps counted so far. */
  count = 0;

  private lastT: number | null = null;
  private slow = [0, 0, 0]; // low-pass at HIGH_PASS_HZ: gravity + drift
  private fast = [0, 0, 0]; // low-pass at LOW_PASS_HZ: noise removed
  private dir = [0, 0, 0]; // direction of strongest movement (unit vector)
  private hasDir = false;
  private meanSq = 0;
  /** 0 = waiting, 1 = saw the positive half, -1 = saw the negative half. */
  private phase: -1 | 0 | 1 = 0;
  private firstPhase: -1 | 0 | 1 = 0;
  private cycleStart = 0;
  private lastCrossT = 0;
  private peak = 0; // largest |signal| in the current half-cycle
  private lastRepT = -Infinity;

  constructor(options: Partial<RepCounterOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  reset(): void {
    this.count = 0;
    this.lastT = null;
    this.hasDir = false;
    this.meanSq = 0;
    this.phase = 0;
    this.firstPhase = 0;
    this.peak = 0;
    this.lastRepT = -Infinity;
  }

  /** Feeds one sample. Returns true when this sample completed a rep. */
  push(s: Sample): boolean {
    const raw = [s.x, s.y, s.z];
    if (this.lastT === null || s.t - this.lastT > MAX_DT_S * 1000 || s.t < this.lastT) {
      // First sample, or a gap in the stream: restart the filters from here.
      this.slow = raw.slice();
      this.fast = raw.slice();
      this.phase = 0;
      this.firstPhase = 0;
      this.peak = 0;
      this.lastT = s.t;
      return false;
    }
    const dt = (s.t - this.lastT) / 1000;
    this.lastT = s.t;
    if (dt <= 0) return false;

    // 1. band-pass
    const aSlow = alpha(HIGH_PASS_HZ, dt);
    const aFast = alpha(LOW_PASS_HZ, dt);
    const v = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      this.slow[i] += aSlow * (raw[i] - this.slow[i]);
      this.fast[i] += aFast * (raw[i] - this.fast[i]);
      v[i] = this.fast[i] - this.slow[i];
    }

    // 2. project onto the main movement direction
    const mag = Math.hypot(v[0], v[1], v[2]);
    if (!this.hasDir) {
      if (mag < this.options.minAmplitude) return false;
      this.dir = [v[0] / mag, v[1] / mag, v[2] / mag];
      this.hasDir = true;
    }
    let y = v[0] * this.dir[0] + v[1] * this.dir[1] + v[2] * this.dir[2];
    const gain = Math.min(1, (PCA_RATE * dt) / Math.max(this.meanSq, 1e-4));
    let norm = 0;
    for (let i = 0; i < 3; i++) {
      this.dir[i] += gain * y * (v[i] - y * this.dir[i]);
      norm += this.dir[i] * this.dir[i];
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < 3; i++) this.dir[i] /= norm;
    y = v[0] * this.dir[0] + v[1] * this.dir[1] + v[2] * this.dir[2];

    // 3. adaptive threshold + cycle counting
    this.meanSq += Math.min(1, dt / RMS_WINDOW_S) * (y * y - this.meanSq);
    const threshold = Math.max(this.options.minAmplitude, this.options.thresholdRatio * Math.sqrt(this.meanSq));

    // A half-finished cycle that stalls is dropped (racking the bar, a single jolt).
    if (this.phase !== 0 && s.t - this.lastCrossT > this.options.maxRepMs / 2) {
      this.phase = 0;
      this.firstPhase = 0;
      this.peak = 0;
    }

    // The return swing must be comparable to the swing before it. A jolt is a
    // big spike with only a small rebound, so it fails this.
    const ay = Math.abs(y);
    const level = Math.max(threshold, SWING_RATIO * this.peak);
    const side: -1 | 0 | 1 = ay <= threshold ? 0 : y > 0 ? 1 : -1;
    if (side === this.phase) {
      if (ay > this.peak) this.peak = ay;
      return false;
    }
    if (side === 0 || (this.phase !== 0 && ay < level)) return false;
    this.lastCrossT = s.t;
    this.peak = ay;

    if (this.phase === 0) {
      this.phase = side;
      this.firstPhase = side;
      this.cycleStart = s.t;
      return false;
    }

    this.phase = side;
    if (side === this.firstPhase) {
      // Back on the starting side: the next rep begins here.
      this.cycleStart = s.t;
      return false;
    }
    // Swung from the starting side to the opposite one: that is one rep, as long
    // as the swing was slow enough to be a movement and not a jolt.
    if (s.t - this.cycleStart < this.options.minRepMs / 4 || s.t - this.lastRepT < this.options.minRepMs) return false;
    this.lastRepT = s.t;
    this.count += 1;
    return true;
  }
}

/** Convenience for tests and offline analysis. */
export function countReps(samples: Sample[], options: Partial<RepCounterOptions> = {}): number {
  const counter = new RepCounter(options);
  for (const s of samples) counter.push(s);
  return counter.count;
}
