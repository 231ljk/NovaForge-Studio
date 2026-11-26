import AppKit
import SwiftUI
import Shared

@main
struct StudioApp: App {
    @State private var loggedIn = false

    init() {
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    var body: some Scene {
        WindowGroup("NovaForge Studio") {
            if loggedIn {
                HomeView()
            } else {
                LoginView { loggedIn = true }
            }
        }
    }
}
