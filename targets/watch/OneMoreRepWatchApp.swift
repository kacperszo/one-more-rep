import SwiftUI

@main
struct OneMoreRepWatchApp: App {
    @StateObject private var session = RepSession()

    init() {
        PhoneLink.shared.activate()
    }

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                ContentView()
            }
            .environmentObject(session)
        }
    }
}
