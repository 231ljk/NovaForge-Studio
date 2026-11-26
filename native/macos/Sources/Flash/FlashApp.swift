import AppKit
import SwiftUI

@main
struct FlashApp: App {
    init() {
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    var body: some Scene {
        WindowGroup("NovaForge Flash") {
            FlashView()
        }
    }
}

struct FlashView: View {
    @State private var port = "未选择串口"
    @State private var firmwarePath = ""
    @State private var log = "原生烧录器骨架已启动。\n串口与 esptool 调用将在原生模块中接入。\n"

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("NovaForge Flash")
                .font(.largeTitle)

            Picker("串口", selection: $port) {
                Text("未选择串口").tag("未选择串口")
            }
            .frame(width: 320)

            TextField("固件文件路径", text: $firmwarePath)
                .textFieldStyle(.roundedBorder)

            HStack {
                Button("选择固件") {}
                Button("开始烧录") {}
                    .buttonStyle(.borderedProminent)
                    .disabled(port == "未选择串口" || firmwarePath.isEmpty)
            }

            TextEditor(text: .constant(log))
                .font(.system(.body, design: .monospaced))
                .frame(minHeight: 220)
        }
        .padding(24)
        .frame(minWidth: 640, minHeight: 520)
    }
}
