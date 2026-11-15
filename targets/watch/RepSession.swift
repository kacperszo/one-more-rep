import CoreMotion
import Foundation
import HealthKit
import WatchKit

/// Movement type, which selects the rep counter tuning.
enum RepMode: String, CaseIterable, Identifiable {
    /// Hand moves freely: presses, rows, curls, pulldowns.
    case free
    /// Hand is fixed on a bar or the floor: pull-ups, dips, push-ups.
    case anchored

    var id: String { rawValue }
    var title: String { self == .free ? "Weights" : "Bar & floor" }
    var subtitle: String { self == .free ? "Presses, rows, curls" : "Pull-ups, dips, push-ups" }
    var options: RepCounterOptions { self == .free ? .free : .anchored }
}

/// Runs a set: reads the accelerometer at 25 Hz, counts reps and taps the wrist on each one.
@MainActor
final class RepSession: NSObject, ObservableObject {
    @Published private(set) var reps = 0
    @Published private(set) var isCounting = false
    @Published private(set) var completedSets: [Int] = []
    @Published var mode: RepMode = .free

    private static let sampleHz = 25.0

    private let motion = CMMotionManager()
    private let queue = OperationQueue()
    private var counter = RepCounter()
    private var startUptime: TimeInterval = 0

    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?

    var isMotionAvailable: Bool { motion.isAccelerometerAvailable }

    func start() {
        guard !isCounting, motion.isAccelerometerAvailable else { return }
        counter = RepCounter(options: mode.options)
        reps = 0
        startWorkoutSession()

        motion.accelerometerUpdateInterval = 1 / Self.sampleHz
        startUptime = ProcessInfo.processInfo.systemUptime
        let counter = self.counter
        let start = startUptime
        queue.maxConcurrentOperationCount = 1
        motion.startAccelerometerUpdates(to: queue) { [weak self] data, _ in
            guard let data else { return }
            // CoreMotion reports acceleration in g, and timestamps in seconds since boot.
            let t = (data.timestamp - start) * 1000
            let a = data.acceleration
            if counter.push(t: t, x: a.x, y: a.y, z: a.z) {
                let count = counter.count
                Task { @MainActor in self?.didCountRep(count) }
            }
        }
        isCounting = true
    }

    /// Stops counting and keeps the current count on screen for correction.
    func stop() {
        guard isCounting else { return }
        motion.stopAccelerometerUpdates()
        isCounting = false
    }

    /// Manual correction with the +/- buttons or the Digital Crown.
    func adjust(by delta: Int) {
        reps = max(0, reps + delta)
    }

    /// Saves the set, sends it to the phone and gets ready for the next one.
    func finishSet() {
        stop()
        guard reps > 0 else { return }
        completedSets.append(reps)
        PhoneLink.shared.sendSet(reps: reps, mode: mode)
        reps = 0
        WKInterfaceDevice.current().play(.success)
    }

    func endWorkout() {
        stop()
        workoutSession?.end()
        workoutSession = nil
        completedSets = []
        reps = 0
    }

    private func didCountRep(_ count: Int) {
        guard isCounting else { return }
        reps = count
        WKInterfaceDevice.current().play(.click)
    }

    /// An active workout session keeps the app running with the screen off.
    private func startWorkoutSession() {
        guard workoutSession == nil, HKHealthStore.isHealthDataAvailable() else { return }
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor
        healthStore.requestAuthorization(toShare: [HKObjectType.workoutType()], read: []) { [weak self] granted, _ in
            guard granted else { return }
            Task { @MainActor in
                guard let self, self.workoutSession == nil else { return }
                do {
                    let session = try HKWorkoutSession(healthStore: self.healthStore, configuration: configuration)
                    session.startActivity(with: Date())
                    self.workoutSession = session
                } catch {
                    // Counting still works while the screen is on.
                }
            }
        }
    }
}
