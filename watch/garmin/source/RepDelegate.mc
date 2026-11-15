import Toybox.Lang;
import Toybox.WatchUi;

// Buttons:
//   START/STOP (or tap)  start / stop counting
//   UP / DOWN (or swipe) +1 / -1 rep when stopped
//   MENU (hold UP)       switch between "weights" and "bar & floor" tuning
//   BACK                 save the set; with nothing to save, exit the app
class RepDelegate extends WatchUi.BehaviorDelegate {

    private var _view as RepView;

    function initialize(view as RepView) {
        BehaviorDelegate.initialize();
        _view = view;
    }

    function onSelect() as Boolean {
        if (_view.counting) {
            _view.stop();
        } else {
            _view.start();
        }
        return true;
    }

    function onPreviousPage() as Boolean {
        _view.adjust(1);
        return true;
    }

    function onNextPage() as Boolean {
        _view.adjust(-1);
        return true;
    }

    function onMenu() as Boolean {
        _view.toggleMode();
        return true;
    }

    function onBack() as Boolean {
        if (_view.counting) {
            _view.stop();
            return true;
        }
        // false lets the system close the app.
        return _view.finishSet();
    }
}
