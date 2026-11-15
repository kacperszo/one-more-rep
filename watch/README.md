# Watch apps: automatic rep counting

Counts reps from the wrist accelerometer for arm push and pull exercises: presses, rows, curls, pulldowns, and also pull-ups, dips and push-ups.

| Where | Code | Status |
| --- | --- | --- |
| Algorithm (reference) | [`src/lib/repCounter.ts`](../src/lib/repCounter.ts) | Unit tested on synthetic signals |
| Phone app, "Auto-count reps" button | `src/services/motion.ts`, `src/lib/useAutoRepCounter.ts` | Tested end to end in the web build with simulated sensor events |
| Apple Watch app (SwiftUI) | [`targets/watch`](../targets/watch) | Target is generated into the Xcode project by `expo prebuild`. **Not compiled or run** (needs macOS + Xcode) |
| Garmin app (Connect IQ, Monkey C) | [`watch/garmin`](garmin) | **Not compiled or run** (needs the Connect IQ SDK) |

Nothing here has been tried on a real wrist yet. The thresholds come from simulated movement and will need tuning against real recordings, especially for pull-ups, dips and push-ups (see "Accuracy").

## How the counting works

Per accelerometer sample, in constant time and without buffers:

1. **Band-pass** each axis (about 0.2 to 3 Hz). This removes gravity, slow posture drift and sensor noise, and keeps both real movement and changes in forearm tilt.
2. **One signal from three axes**: project onto the direction of strongest movement, tracked online (Oja's rule, a streaming PCA). The watch can sit in any orientation, on either wrist.
3. **Count swings**: one rep is a swing above `+threshold` followed by a swing below `-threshold` (or the reverse, whichever came first). The threshold follows the recent movement amplitude.
4. **Reject non-reps**: swings that are too fast, too small, or stalled half-way, and jolts (a big spike with only a small rebound, such as racking the bar).

Two tunings (`REP_PROFILES`):

- `free`: the hand moves (presses, rows, curls, pulldowns). Strong signal.
- `anchored`: the hand is fixed on a bar or the floor and the body moves (pull-ups, dips, push-ups). The wrist barely moves, so the counter relies on the small change in forearm tilt. Lower threshold, weaker signal, less accurate.

The phone app picks the profile from the exercise name (`repProfileFor`). On the watches you pick "Weights" or "Bar & floor".

## Accuracy

`npm run rep:accuracy` runs 500 randomized synthetic sets per profile (random orientation, tempo 1.2 to 4.2 s, amplitude, noise, plus a jolt before and after the set):

| Profile | Exact count | Within ±1 rep |
| --- | --- | --- |
| `free` | 82% | 98% |
| `anchored` | 52% | 86% |

These numbers are from simulated signals, not real wrists. Every screen keeps manual +/- correction for that reason.

## Apple Watch

The watch app is a native SwiftUI target added with [`@bacons/apple-targets`](https://github.com/EvanBacon/expo-apple-targets). It works on its own: pick the exercise type, tap **Start set**, do the set (a tap on the wrist for every rep), tap **Stop**, correct with +/- or the Digital Crown, then **Save set**.

- `RepCounter.swift`: port of the TypeScript algorithm.
- `RepSession.swift`: 25 Hz accelerometer (CoreMotion). It starts a strength-training `HKWorkoutSession`, which is what keeps the app counting when the wrist is lowered and the screen turns off, so the app asks for Health access.
- `PhoneLink.swift`: sends each saved set to the iPhone over WatchConnectivity.

Build (macOS, Xcode 16+):

```bash
npx expo prebuild -p ios --clean
```

```bash
xed ios
```

Set `ios.appleTeamId` in `app.json` first, then select the `OneMoreRepWatch` scheme and run it on a watch or the simulator. The app can no longer run in Expo Go on iOS once you need the watch target; use a development build (`npx expo run:ios`).

## Garmin

A Connect IQ watch app in Monkey C. Same flow with buttons: **START** begins and stops a set, **UP/DOWN** correct the count, **MENU** switches between "Weights" and "Bar & floor", **BACK** saves the set. The watch vibrates on every rep.

Build with the [Connect IQ SDK](https://developer.garmin.com/connect-iq/sdk/) (or the Monkey C extension for VS Code):

```bash
monkeyc -f watch/garmin/monkey.jungle -o OneMoreRep.prg -y developer_key.der -d fenix7
```

Supported devices are listed in `watch/garmin/manifest.xml`; the app needs the accelerometer data listener (Connect IQ 3.2+).

## Not done yet

- **Watch to phone sync.** The Apple Watch app sends `{ "type": "set", "reps": 8, "mode": "free", "at": <unix ms> }` for every saved set, but the phone app does not receive it yet. That needs a small native module on the iOS side (WatchConnectivity) and, for Garmin, the Connect IQ Mobile SDK. Until then the watch apps are standalone counters and the phone has its own "Auto-count reps" button.
- **Tuning on real data.** Record real sets (25 Hz, in g), add them to `watch/fixtures`, and tune `REP_PROFILES`.
- **Port verification.** `watch/fixtures/*.json` contains sample streams and the count the TypeScript reference gives (`npm run rep:fixtures` regenerates them). The Swift and Monkey C ports should be run against these once they can be built.
- **Wear OS** is not covered.
