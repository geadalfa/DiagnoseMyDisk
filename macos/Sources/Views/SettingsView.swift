import SwiftUI

public struct SettingsView: View {
    @AppStorage("app_language") private var appLanguage: String = "en"
    @AppStorage("auto_refresh") private var autoRefresh: Bool = true
    @AppStorage("surface_block_count") private var surfaceBlockCount: Int = 200
    
    public init() {}
    
    public var body: some View {
        Form {
            Section("General Preferences") {
                Picker("Language / Bahasa", selection: $appLanguage) {
                    Text("English (Default)").tag("en")
                    Text("Bahasa Indonesia").tag("id")
                }
                
                Toggle("Auto-refresh disk telemetry on window focus", isOn: $autoRefresh)
                
                Picker("Surface Scanner Block Count", selection: $surfaceBlockCount) {
                    Text("200 Blocks (Standard)").tag(200)
                    Text("100 Blocks (Fast)").tag(100)
                    Text("400 Blocks (High Density)").tag(400)
                }
            }
            
            Section("Privacy & Data Sovereignty Guarantee") {
                VStack(alignment: .leading, spacing: 6) {
                    Label("100% Offline Diagnostic Operations", systemImage: "shield.checkmark.fill")
                        .foregroundStyle(.green)
                        .fontWeight(.semibold)
                    
                    Text("DiagnoseMyDisk operates completely locally on your Mac. It makes zero network requests, contains zero analytics trackers, and complies strictly with Republic of Indonesia Law No. 27 of 2022 on Personal Data Protection (UU PDP).")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }
            
            Section("About DiagnoseMyDisk") {
                LabeledContent("Version", value: "0.3.5 (macOS Edition)")
                LabeledContent("Author", value: "Geadalfa Giyanda")
                LabeledContent("License", value: "CC BY-NC 4.0 (Non-Commercial)")
                LabeledContent("Platform", value: "Apple Silicon (Native arm64)")
            }
        }
        .formStyle(.grouped)
        .frame(width: 480, height: 380)
    }
}
