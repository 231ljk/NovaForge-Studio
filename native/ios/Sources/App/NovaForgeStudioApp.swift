import SwiftUI

@main
struct NovaForgeStudioApp: App {
    @State private var loggedIn = false

    var body: some Scene {
        WindowGroup {
            if loggedIn {
                HomeView()
            } else {
                LoginView { loggedIn = true }
            }
        }
    }
}
