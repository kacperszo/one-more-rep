import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var session: RepSession
    @State private var crown = 0.0

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                if !session.isCounting {
                    Picker("Exercise type", selection: $session.mode) {
                        ForEach(RepMode.allCases) { mode in
                            Text(mode.title).tag(mode)
                        }
                    }
                    .pickerStyle(.navigationLink)
                }

                Text("\(session.reps)")
                    .font(.system(size: 64, weight: .heavy, design: .rounded))
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .foregroundStyle(session.isCounting ? Color.accentColor : .primary)
                    .accessibilityLabel("\(session.reps) reps")

                Text(session.isCounting ? "Counting…" : session.mode.subtitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                if session.isCounting {
                    Button("Stop") { session.stop() }
                        .tint(.red)
                } else {
                    HStack {
                        Button { session.adjust(by: -1) } label: { Image(systemName: "minus") }
                            .accessibilityLabel("One rep less")
                        Button { session.adjust(by: 1) } label: { Image(systemName: "plus") }
                            .accessibilityLabel("One rep more")
                    }
                    Button("Start set") { session.start() }
                        .tint(.accentColor)
                        .disabled(!session.isMotionAvailable)
                    if session.reps > 0 {
                        Button("Save set") { session.finishSet() }
                    }
                }

                if !session.completedSets.isEmpty {
                    Text("Sets: " + session.completedSets.map(String.init).joined(separator: " · "))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    if !session.isCounting {
                        Button("End workout", role: .destructive) { session.endWorkout() }
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("OneMoreRep")
        // Digital Crown corrects the count when not counting.
        .focusable(!session.isCounting)
        .digitalCrownRotation($crown, from: -1000, through: 1000, by: 1, sensitivity: .low, isContinuous: false, isHapticFeedbackEnabled: true)
        .onChange(of: crown) { old, new in
            let delta = Int(new.rounded()) - Int(old.rounded())
            if delta != 0 && !session.isCounting { session.adjust(by: delta) }
        }
    }
}

#Preview {
    ContentView().environmentObject(RepSession())
}
