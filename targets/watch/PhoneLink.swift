import Foundation
import WatchConnectivity

/// Sends finished sets to the iPhone app.
///
/// Message format (also used by the Garmin app):
///   { "type": "set", "reps": 8, "mode": "free" | "anchored", "at": <unix ms> }
/// `transferUserInfo` queues the message, so sets are delivered even if the
/// phone is out of reach when the set ends.
final class PhoneLink: NSObject, WCSessionDelegate {
    static let shared = PhoneLink()

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func sendSet(reps: Int, mode: RepMode) {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
        WCSession.default.transferUserInfo([
            "type": "set",
            "reps": reps,
            "mode": mode.rawValue,
            "at": Int(Date().timeIntervalSince1970 * 1000),
        ])
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
}
