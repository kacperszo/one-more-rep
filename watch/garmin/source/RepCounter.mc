import Toybox.Lang;
import Toybox.Math;

// Counts exercise repetitions from a stream of accelerometer samples.
//
// Monkey C port of src/lib/repCounter.ts. Keep the two in sync: the algorithm,
// constants and state are the same, line for line. watch/fixtures/*.json holds
// sample streams with the count the TypeScript reference produces.
class RepCounter {

    const HIGH_PASS_HZ = 0.2;
    const LOW_PASS_HZ = 3.0;
    const RMS_WINDOW_S = 3.0;
    const PCA_RATE = 4.0;
    const SWING_RATIO = 0.5;
    const MAX_DT_S = 0.2;

    // Options (see REP_PROFILES in repCounter.ts).
    var minAmplitude as Float = 0.04;   // g
    var minRepMs as Float = 700.0;
    var maxRepMs as Float = 8000.0;
    var thresholdRatio as Float = 0.6;

    var count as Number = 0;

    private var _hasLast as Boolean = false;
    private var _lastT as Float = 0.0;
    private var _slow as Array<Float> = [0.0, 0.0, 0.0] as Array<Float>;
    private var _fast as Array<Float> = [0.0, 0.0, 0.0] as Array<Float>;
    private var _dir as Array<Float> = [0.0, 0.0, 0.0] as Array<Float>;
    private var _hasDir as Boolean = false;
    private var _meanSq as Float = 0.0;
    // 0 = waiting, 1 = saw the positive half, -1 = saw the negative half.
    private var _phase as Number = 0;
    private var _firstPhase as Number = 0;
    private var _cycleStart as Float = 0.0;
    private var _lastCrossT as Float = 0.0;
    private var _peak as Float = 0.0;
    private var _lastRepT as Float = -1000000000.0;

    // anchored = hand fixed on a bar or the floor (pull-ups, dips, push-ups).
    function initialize(anchored as Boolean) {
        if (anchored) {
            minAmplitude = 0.02;
            minRepMs = 900.0;
        }
    }

    function reset() as Void {
        count = 0;
        _hasLast = false;
        _hasDir = false;
        _meanSq = 0.0;
        _phase = 0;
        _firstPhase = 0;
        _peak = 0.0;
        _lastRepT = -1000000000.0;
    }

    private function alpha(cutoffHz as Float, dt as Float) as Float {
        var rc = 1.0 / (2.0 * Math.PI * cutoffHz);
        return (dt / (rc + dt)).toFloat();
    }

    private function max(a as Float, b as Float) as Float {
        return a > b ? a : b;
    }

    private function min(a as Float, b as Float) as Float {
        return a < b ? a : b;
    }

    // Feeds one sample (t in milliseconds, acceleration in g).
    // Returns true when this sample completed a rep.
    function push(t as Float, x as Float, y0 as Float, z as Float) as Boolean {
        var raw = [x, y0, z] as Array<Float>;
        if (!_hasLast || t - _lastT > MAX_DT_S * 1000 || t < _lastT) {
            // First sample, or a gap in the stream: restart the filters from here.
            _slow = [x, y0, z] as Array<Float>;
            _fast = [x, y0, z] as Array<Float>;
            _phase = 0;
            _firstPhase = 0;
            _peak = 0.0;
            _lastT = t;
            _hasLast = true;
            return false;
        }
        var dt = (t - _lastT) / 1000.0;
        _lastT = t;
        if (dt <= 0) {
            return false;
        }

        // 1. band-pass
        var aSlow = alpha(HIGH_PASS_HZ, dt);
        var aFast = alpha(LOW_PASS_HZ, dt);
        var v = [0.0, 0.0, 0.0] as Array<Float>;
        for (var i = 0; i < 3; i++) {
            _slow[i] = _slow[i] + aSlow * (raw[i] - _slow[i]);
            _fast[i] = _fast[i] + aFast * (raw[i] - _fast[i]);
            v[i] = _fast[i] - _slow[i];
        }

        // 2. project onto the main movement direction
        var mag = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).toFloat();
        if (!_hasDir) {
            if (mag < minAmplitude) {
                return false;
            }
            _dir = [v[0] / mag, v[1] / mag, v[2] / mag] as Array<Float>;
            _hasDir = true;
        }
        var y = v[0] * _dir[0] + v[1] * _dir[1] + v[2] * _dir[2];
        var gain = min(1.0, (PCA_RATE * dt) / max(_meanSq, 0.0001));
        var norm = 0.0;
        for (var i = 0; i < 3; i++) {
            _dir[i] = _dir[i] + gain * y * (v[i] - y * _dir[i]);
            norm += _dir[i] * _dir[i];
        }
        norm = Math.sqrt(norm).toFloat();
        if (norm == 0) {
            norm = 1.0;
        }
        for (var i = 0; i < 3; i++) {
            _dir[i] = _dir[i] / norm;
        }
        y = v[0] * _dir[0] + v[1] * _dir[1] + v[2] * _dir[2];

        // 3. adaptive threshold + cycle counting
        _meanSq = _meanSq + min(1.0, dt / RMS_WINDOW_S) * (y * y - _meanSq);
        var threshold = max(minAmplitude, thresholdRatio * Math.sqrt(_meanSq).toFloat());

        // A half-finished cycle that stalls is dropped (racking the bar, a single jolt).
        if (_phase != 0 && t - _lastCrossT > maxRepMs / 2) {
            _phase = 0;
            _firstPhase = 0;
            _peak = 0.0;
        }

        // The return swing must be comparable to the swing before it. A jolt is a
        // big spike with only a small rebound, so it fails this.
        var ay = y < 0 ? -y : y;
        var level = max(threshold, SWING_RATIO * _peak);
        var side = 0;
        if (ay > threshold) {
            side = y > 0 ? 1 : -1;
        }
        if (side == _phase) {
            if (ay > _peak) {
                _peak = ay;
            }
            return false;
        }
        if (side == 0 || (_phase != 0 && ay < level)) {
            return false;
        }
        _lastCrossT = t;
        _peak = ay;

        if (_phase == 0) {
            _phase = side;
            _firstPhase = side;
            _cycleStart = t;
            return false;
        }

        _phase = side;
        if (side == _firstPhase) {
            // Back on the starting side: the next rep begins here.
            _cycleStart = t;
            return false;
        }
        // Swung from the starting side to the opposite one: that is one rep, as long
        // as the swing was slow enough to be a movement and not a jolt.
        if (t - _cycleStart < minRepMs / 4 || t - _lastRepT < minRepMs) {
            return false;
        }
        _lastRepT = t;
        count += 1;
        return true;
    }
}
