import Foundation

/// Counts exercise repetitions from a stream of accelerometer samples.
///
/// Swift port of `src/lib/repCounter.ts`. Keep the two in sync: the algorithm,
/// constants and state are the same, line for line. `watch/fixtures/*.json`
/// holds sample streams with the count the TypeScript reference produces.
struct RepCounterOptions {
    /// Smallest oscillation amplitude (g) that can count as a rep.
    var minAmplitude: Double = 0.04
    /// Fastest plausible rep (ms).
    var minRepMs: Double = 700
    /// Slowest plausible rep (ms). A cycle with no progress for half this long is dropped.
    var maxRepMs: Double = 8000
    /// Threshold as a fraction of the recent RMS amplitude.
    var thresholdRatio: Double = 0.6

    /// Hand moves freely: presses, rows, curls, raises, pulldowns.
    static let free = RepCounterOptions()
    /// Hand is fixed and the body moves: pull-ups, chin-ups, dips, push-ups.
    static let anchored = RepCounterOptions(minAmplitude: 0.02, minRepMs: 900)
}

final class RepCounter {
    private static let highPassHz = 0.2
    private static let lowPassHz = 3.0
    private static let rmsWindowS = 3.0
    private static let pcaRate = 4.0
    private static let swingRatio = 0.5
    private static let maxDtS = 0.2

    let options: RepCounterOptions
    private(set) var count = 0

    private var lastT: Double?
    private var slow = [0.0, 0.0, 0.0]
    private var fast = [0.0, 0.0, 0.0]
    private var dir = [0.0, 0.0, 0.0]
    private var hasDir = false
    private var meanSq = 0.0
    /// 0 = waiting, 1 = saw the positive half, -1 = saw the negative half.
    private var phase = 0
    private var firstPhase = 0
    private var cycleStart = 0.0
    private var lastCrossT = 0.0
    private var peak = 0.0
    private var lastRepT = -Double.infinity

    init(options: RepCounterOptions = .free) {
        self.options = options
    }

    func reset() {
        count = 0
        lastT = nil
        hasDir = false
        meanSq = 0
        phase = 0
        firstPhase = 0
        peak = 0
        lastRepT = -Double.infinity
    }

    private static func alpha(_ cutoffHz: Double, _ dt: Double) -> Double {
        let rc = 1 / (2 * Double.pi * cutoffHz)
        return dt / (rc + dt)
    }

    /// Feeds one sample (`t` in milliseconds, acceleration in g).
    /// Returns true when this sample completed a rep.
    @discardableResult
    func push(t: Double, x: Double, y ay0: Double, z: Double) -> Bool {
        let raw = [x, ay0, z]
        guard let previous = lastT, t - previous <= Self.maxDtS * 1000, t >= previous else {
            // First sample, or a gap in the stream: restart the filters from here.
            slow = raw
            fast = raw
            phase = 0
            firstPhase = 0
            peak = 0
            lastT = t
            return false
        }
        let dt = (t - previous) / 1000
        lastT = t
        if dt <= 0 { return false }

        // 1. band-pass
        let aSlow = Self.alpha(Self.highPassHz, dt)
        let aFast = Self.alpha(Self.lowPassHz, dt)
        var v = [0.0, 0.0, 0.0]
        for i in 0..<3 {
            slow[i] += aSlow * (raw[i] - slow[i])
            fast[i] += aFast * (raw[i] - fast[i])
            v[i] = fast[i] - slow[i]
        }

        // 2. project onto the main movement direction
        let mag = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).squareRoot()
        if !hasDir {
            if mag < options.minAmplitude { return false }
            dir = [v[0] / mag, v[1] / mag, v[2] / mag]
            hasDir = true
        }
        var y = v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2]
        let gain = min(1, (Self.pcaRate * dt) / max(meanSq, 1e-4))
        var norm = 0.0
        for i in 0..<3 {
            dir[i] += gain * y * (v[i] - y * dir[i])
            norm += dir[i] * dir[i]
        }
        norm = norm.squareRoot()
        if norm == 0 { norm = 1 }
        for i in 0..<3 { dir[i] /= norm }
        y = v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2]

        // 3. adaptive threshold + cycle counting
        meanSq += min(1, dt / Self.rmsWindowS) * (y * y - meanSq)
        let threshold = max(options.minAmplitude, options.thresholdRatio * meanSq.squareRoot())

        // A half-finished cycle that stalls is dropped (racking the bar, a single jolt).
        if phase != 0 && t - lastCrossT > options.maxRepMs / 2 {
            phase = 0
            firstPhase = 0
            peak = 0
        }

        // The return swing must be comparable to the swing before it. A jolt is a
        // big spike with only a small rebound, so it fails this.
        let ay = abs(y)
        let level = max(threshold, Self.swingRatio * peak)
        let side = ay <= threshold ? 0 : (y > 0 ? 1 : -1)
        if side == phase {
            if ay > peak { peak = ay }
            return false
        }
        if side == 0 || (phase != 0 && ay < level) { return false }
        lastCrossT = t
        peak = ay

        if phase == 0 {
            phase = side
            firstPhase = side
            cycleStart = t
            return false
        }

        phase = side
        if side == firstPhase {
            // Back on the starting side: the next rep begins here.
            cycleStart = t
            return false
        }
        // Swung from the starting side to the opposite one: that is one rep, as long
        // as the swing was slow enough to be a movement and not a jolt.
        if t - cycleStart < options.minRepMs / 4 || t - lastRepT < options.minRepMs { return false }
        lastRepT = t
        count += 1
        return true
    }
}
