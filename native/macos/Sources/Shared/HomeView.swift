import SwiftUI

public struct DeviceItem: Identifiable, Hashable {
    public let id = UUID()
    public let name: String
    public let detail: String

    public init(name: String, detail: String) {
        self.name = name
        self.detail = detail
    }
}

public struct HomeView: View {
    @State private var selection: DeviceItem?
    private let devices = [
        DeviceItem(name: "示例 ESP32", detail: "原生设备列表骨架"),
        DeviceItem(name: "示例树莓派", detail: "等待接入家庭服务")
    ]

    public init() {}

    public var body: some View {
        NavigationView {
            List(devices, selection: $selection) { device in
                VStack(alignment: .leading) {
                    Text(device.name)
                    Text(device.detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("设备")
            .frame(minWidth: 220)

            if let selection {
                VStack(spacing: 16) {
                    Text(selection.name)
                        .font(.largeTitle)
                    Text("设备控制、场景、日志与 AI 功能将在原生模块中实现")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                Text("从左侧选择设备")
                    .foregroundStyle(.secondary)
            }
        }
        .frame(minWidth: 760, minHeight: 520)
    }
}
