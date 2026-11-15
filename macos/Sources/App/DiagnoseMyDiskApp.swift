import SwiftUI

@main
struct DiagnoseMyDiskApp: App {
    var body: some Scene {
        WindowGroup {
            MainView()
                .frame(minWidth: 960, minHeight: 620)
        }
        .windowStyle(.hiddenTitleBar)
        .windowToolbarStyle(.unified)
        .commands {
            SidebarCommands()
            CommandGroup(replacing: .newItem) { }
        }
        
        Settings {
            SettingsView()
        }
    }
}
