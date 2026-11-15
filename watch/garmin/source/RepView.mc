import Toybox.Attention;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Sensor;
import Toybox.WatchUi;

// Main screen: big rep count, counts from the accelerometer while a set is running.
class RepView extends WatchUi.View {

    const SAMPLE_HZ = 25;

    var reps as Number = 0;
    var counting as Boolean = false;
    var anchored as Boolean = false;
    var sets as Array<Number> = [] as Array<Number>;

    private var _counter as RepCounter;
    private var _t as Float = 0.0;

    function initialize() {
        View.initialize();
        _counter = new RepCounter(false);
    }

    function start() as Void {
        if (counting) {
            return;
        }
        _counter = new RepCounter(anchored);
        _t = 0.0;
        reps = 0;
        var options = {
            :period => 1,
            :accelerometer => { :enabled => true, :sampleRate => SAMPLE_HZ }
        };
        try {
            Sensor.registerSensorDataListener(method(:onSensorData), options);
            counting = true;
            vibrate(100);
        } catch (e) {
            counting = false;
        }
        WatchUi.requestUpdate();
    }

    function stop() as Void {
        if (!counting) {
            return;
        }
        Sensor.unregisterSensorDataListener();
        counting = false;
        WatchUi.requestUpdate();
    }

    // Manual correction with the up/down buttons or a swipe.
    function adjust(delta as Number) as Void {
        if (counting) {
            return;
        }
        reps = reps + delta;
        if (reps < 0) {
            reps = 0;
        }
        WatchUi.requestUpdate();
    }

    function toggleMode() as Void {
        if (counting) {
            return;
        }
        anchored = !anchored;
        WatchUi.requestUpdate();
    }

    // Saves the set and gets ready for the next one. Returns false if there was nothing to save.
    function finishSet() as Boolean {
        stop();
        if (reps == 0) {
            return false;
        }
        sets.add(reps);
        reps = 0;
        vibrate(200);
        WatchUi.requestUpdate();
        return true;
    }

    // Called about once a second with a batch of samples (milli-g).
    function onSensorData(data as Sensor.SensorData) as Void {
        var acc = data.accelerometerData;
        if (acc == null) {
            return;
        }
        var xs = acc.x;
        var ys = acc.y;
        var zs = acc.z;
        var step = 1000.0 / SAMPLE_HZ;
        var counted = false;
        for (var i = 0; i < xs.size(); i++) {
            _t += step;
            if (_counter.push(_t, xs[i] / 1000.0, ys[i] / 1000.0, zs[i] / 1000.0)) {
                counted = true;
            }
        }
        if (counted) {
            reps = _counter.count;
            vibrate(40);
            WatchUi.requestUpdate();
        }
    }

    private function vibrate(ms as Number) as Void {
        if (Attention has :vibrate) {
            Attention.vibrate([new Attention.VibeProfile(60, ms)]);
        }
    }

    function onHide() as Void {
        stop();
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var center = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;

        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.18, Graphics.FONT_XTINY, anchored ? "BAR & FLOOR" : "WEIGHTS", center);

        dc.setColor(counting ? Graphics.COLOR_ORANGE : Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.45, Graphics.FONT_NUMBER_THAI_HOT, reps.format("%d"), center);

        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        var hint = counting ? "Counting... START = stop" : (reps > 0 ? "BACK = save set" : "START = begin set");
        dc.drawText(w / 2, h * 0.72, Graphics.FONT_XTINY, hint, center);

        if (sets.size() > 0) {
            var text = "";
            var from = sets.size() > 5 ? sets.size() - 5 : 0;
            for (var i = from; i < sets.size(); i++) {
                text = text + (i > from ? " " : "") + sets[i].format("%d");
            }
            dc.drawText(w / 2, h * 0.84, Graphics.FONT_XTINY, text, center);
        }
    }
}
