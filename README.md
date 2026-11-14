# OneMoreRep

A mobile app for tracking gym workouts: count reps, browse an exercise catalog, estimate burned calories and time your rest. Built with React Native (Expo + TypeScript). See [docs/project-description.md](docs/project-description.md) for the full project description.

## Demo

<p align="center">
  <img src="docs/screenshots/demo.gif" width="300" alt="Screencast: starting a workout, adding an exercise, reading the instructions, counting reps, rest timer, history and exercise catalog" />
</p>

<p align="center"><a href="docs/screenshots/demo.mp4">Watch the higher-quality MP4</a></p>

## Screenshots

### Workout

| Home | Active workout | Rest timer | Add exercise |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/home.png" width="190" alt="Home" /> | <img src="docs/screenshots/workout.png" width="190" alt="Active workout" /> | <img src="docs/screenshots/workout-rest-timer.png" width="190" alt="Rest timer" /> | <img src="docs/screenshots/pick-exercise.png" width="190" alt="Add exercise" /> |

| How to do it | Steps during workout | History | Workout details |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/workout-how-to.png" width="190" alt="How to do it" /> | <img src="docs/screenshots/workout-how-to-steps.png" width="190" alt="Steps during workout" /> | <img src="docs/screenshots/history.png" width="190" alt="History" /> | <img src="docs/screenshots/history-details.png" width="190" alt="Workout details" /> |

### Exercise catalog

| Search | Filter: body part | Filter: equipment | Exercise details |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/exercises-search.png" width="190" alt="Search" /> | <img src="docs/screenshots/exercises-filter-chest.png" width="190" alt="Filter: body part" /> | <img src="docs/screenshots/exercises-filter-equipment.png" width="190" alt="Filter: equipment" /> | <img src="docs/screenshots/exercise-details.png" width="190" alt="Exercise details" /> |

| Instructions | Instructions: pullups | Profile | Rest timer settings |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/exercise-instructions.png" width="190" alt="Instructions" /> | <img src="docs/screenshots/exercise-instructions-pullups.png" width="190" alt="Instructions: pullups" /> | <img src="docs/screenshots/profile.png" width="190" alt="Profile" /> | <img src="docs/screenshots/profile-rest-settings.png" width="190" alt="Rest timer settings" /> |

### Dark mode

| Home | Active workout | Exercises | Workout details |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/home-dark.png" width="190" alt="Home" /> | <img src="docs/screenshots/workout-dark.png" width="190" alt="Active workout" /> | <img src="docs/screenshots/exercises-dark.png" width="190" alt="Exercises" /> | <img src="docs/screenshots/history-details-dark.png" width="190" alt="Workout details" /> |

_Screenshots and the screencast were captured from the web build (react-native-web) at phone size, with sample workout data._

## Getting started

```bash
npm install
npm start          # Expo dev server, open in Expo Go or a simulator
npm run android    # or: npm run ios / npm run web
```

Checks:

```bash
npm run typecheck
npm test
```

## Project structure

```
src/
  config/features.ts      Feature flags: switch any screen or feature on/off
  app/                    Expo Router screens
    (tabs)/               Workout (home), Exercises, History, Profile
    workout.tsx           Active workout: stopwatch, rep counter, sets, rest timer
    pick-exercise.tsx     Exercise picker (modal)
    exercise/[id].tsx     Exercise details
    history/[id].tsx      Finished workout details
  components/             UI components (Stepper, RestTimerBar, ExerciseCatalog, ...)
  lib/                    Pure logic: types, MET calories, records, formatting, exercise filtering (+ tests)
  services/
    exerciseApi.ts        The only module that talks to the exercise data source
    storage.ts            AsyncStorage helpers
  state/
    AppStore.tsx          Profile, active workout and history (persisted locally)
    RestTimer.tsx         Rest countdown with sound and vibration
```

## Feature flags

Every screen and feature can be switched on or off in code, in one file: [`src/config/features.ts`](src/config/features.ts). Change a value to `false` and that screen or feature is gone from the app.

```ts
export const FEATURES = {
  history: true,      // History tab, workout details, "Last workout" card
  restTimer: true,    // rest countdown between sets
  calories: false,    // <- no kcal, intensity or body weight anywhere
  // ...
};
```

| Flag | What it controls |
| --- | --- |
| `workout` | Active workout screen and exercise picker |
| `exercises` | Exercises tab (catalog) |
| `exerciseDetails` | Exercise details screen |
| `history` | History tab, workout details, "Last workout" card |
| `profile` | Profile tab |
| `stopwatch` | Workout time and pause/resume (needs `workout`) |
| `restTimer` | Rest countdown and its settings (needs `workout`) |
| `calories` | kcal estimate, intensity, body weight (needs `stopwatch`) |
| `weightTracking` | Weight per set and volume (needs `workout`) |
| `previousPerformance` | "Last time" hint and pre-filled sets (needs `workout`) |
| `personalRecords` | PR badge on record sets (needs `workout`) |
| `repeatWorkout` | "Repeat workout" button (needs `workout` and `history`) |
| `instructions` | "How to do it" steps |
| `exerciseImages` | Thumbnails and demo images |
| `catalogSearch` | Catalog search box |
| `catalogFilters` | Body part / muscle / equipment filters |
| `weeklyStats` | "Last 7 days" card on Home |
| `haptics` | Haptic feedback on the rep counter |
| `darkMode` | Follow the system dark theme |

A flag that needs another flag is off whenever its parent is off (see `REQUIRES` in the same file). Disabled screens are not registered with the router, so they can't be opened by navigation or deep links.

Usage:

```tsx
import { flags } from '@/config/features';

{flags.restTimer && <RestTimerBar />}
```

To add a flag, add it to `FEATURES` (and to `REQUIRES` if it depends on another flag) and gate the UI with `flags.yourFlag`.

## Progress tracking

<p align="center">
  <img src="docs/screenshots/workout-last-time-pr.png" width="220" alt="Last time hint and PR badge during a workout" />
  <img src="docs/screenshots/history-records.png" width="220" alt="Records and Repeat workout in workout details" />
</p>

- **Last time**: each exercise in a workout shows what you did the previous time, and a newly added exercise starts from those reps and weight.
- **Personal records**: a set that beats your previous best for that exercise (more weight, or the same weight for more reps) gets a PR badge, live during the workout and in history.
- **Repeat workout**: start a new workout with the same exercises and sets as a finished one.

## Exercise data

Each exercise comes with step-by-step instructions on how to perform it correctly, demo images (start and end position), target and secondary muscles, equipment and difficulty level. Instructions are shown on the exercise details screen and in a collapsible "How to do it" section for every exercise during a workout.

Exercises come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain, ~870 exercises). The JSON file is downloaded once, cached on the device and refreshed weekly; search and filters run locally, so there are no API keys or rate limits and the catalog works offline.

To self-host the data, put `exercises.json` and the `exercises/` image folder on any static host and set `extra.exerciseData.url` / `extra.exerciseData.imageBaseUrl` in `app.json` (or the `EXPO_PUBLIC_EXERCISES_URL` / `EXPO_PUBLIC_EXERCISE_IMAGES_URL` env vars).

## Calories

`Calories = MET x body weight (kg) x duration (hours)`, with MET 3.5 / 5.0 / 6.0 for light / moderate / vigorous resistance training. Body weight and default intensity are set in the Profile tab; intensity can be changed per workout.
