import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

class OneMoreRepApp extends Application.AppBase {

    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() {
        var view = new RepView();
        return [view, new RepDelegate(view)];
    }
}
