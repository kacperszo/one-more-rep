/**
 * Feature flags.
 *
 * Every screen and feature of the app can be switched on or off here: change a
 * value to `false` and the screen/feature disappears from the app (disabled
 * screens are not even registered with the router).
 *
 * Use in code:
 *   import { flags } from '@/config/features';
 *   {flags.restTimer && <RestTimerBar />}
 *
 * To add a flag: add it to FEATURES (and to REQUIRES if it depends on another
 * flag), then gate the UI with `flags.yourFlag`.
 */
export const FEATURES = {
  // ---- screens ----
  /** Active workout screen and the exercise picker. */
  workout: true,
  /** Exercises tab with the catalog. */
  exercises: true,
  /** Exercise details screen. */
  exerciseDetails: true,
  /** History tab, workout details and the "Last workout" card on Home. */
  history: true,
  /** Profile tab. */
  profile: true,

  // ---- workout features ----
  /** Workout time with pause/resume. Durations are hidden everywhere when off. */
  stopwatch: true,
  /** Rest countdown between sets (and its settings in Profile). */
  restTimer: true,
  /** MET-based kcal estimate, workout intensity and body weight. */
  calories: true,
  /** Weight per set and total volume. Off = reps only. */
  weightTracking: true,
  /** "Last time: 10 × 60 kg" hint and pre-filled sets when adding an exercise. */
  previousPerformance: true,
  /** Trophy on sets that beat your previous best for that exercise. */
  personalRecords: true,
  /** "Auto-count" button: counts reps from the accelerometer (phone on the arm or in the hand). */
  autoRepCounting: true,
  /** "Repeat workout" button in workout details. */
  repeatWorkout: true,

  // ---- catalog features ----
  /** Step-by-step "How to do it" in exercise details and during a workout. */
  instructions: true,
  /** Thumbnails and demo images. */
  exerciseImages: true,
  /** Search box in the catalog and picker. */
  catalogSearch: true,
  /** Body part / target muscle / equipment filters. */
  catalogFilters: true,

  // ---- general ----
  /** "Last 7 days" card on Home. */
  weeklyStats: true,
  /** Haptic feedback on the rep counter and when completing a set. */
  haptics: true,
  /** Follow the system dark theme. Off = always light. */
  darkMode: true,
} satisfies Record<string, boolean>;

export type FeatureFlag = keyof typeof FEATURES;
export type FlagValues = Record<FeatureFlag, boolean>;

/** A flag is only on when everything it requires is on too. */
export const REQUIRES: Partial<Record<FeatureFlag, FeatureFlag[]>> = {
  stopwatch: ['workout'],
  restTimer: ['workout'],
  calories: ['stopwatch'],
  weightTracking: ['workout'],
  previousPerformance: ['workout'],
  personalRecords: ['workout'],
  autoRepCounting: ['workout'],
  repeatWorkout: ['workout', 'history'],
};

/** Applies REQUIRES (transitively) to the raw values. */
export function resolveFlags(
  values: FlagValues,
  requires: Partial<Record<FeatureFlag, FeatureFlag[]>> = REQUIRES,
): FlagValues {
  const resolved = {} as FlagValues;
  const visit = (name: FeatureFlag, seen: Set<FeatureFlag>): boolean => {
    if (name in resolved) return resolved[name];
    if (seen.has(name)) return false; // dependency cycle: fail closed
    seen.add(name);
    const value = values[name] && (requires[name] ?? []).every((dep) => visit(dep, seen));
    resolved[name] = value;
    return value;
  };
  for (const name of Object.keys(values) as FeatureFlag[]) visit(name, new Set());
  return resolved;
}

/** Effective flag values. This is what the app reads. */
export const flags: Readonly<FlagValues> = resolveFlags(FEATURES);
