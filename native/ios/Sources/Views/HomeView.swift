import SwiftUI

struct HomeView: View {
    private let devices = ["示例 ESP32", "示例树莓派"]

    var body: some View {
        TabView {
            NavigationStack {
                List(devices, id: \.self) { device in
                    NavigationLink(device) {
                        Text("设备控制将在原生模块中实现")
                            .navigationTitle(device)
                    }
                }
                .navigationTitle("设备")
            }
            .tabItem { Label("设备", systemImage: "cpu") }

            NavigationStack {
                List {
                    Text("场景自动化将在原生模块中实现")
                }
                .navigationTitle("场景")
            }
            .tabItem { Label("场景", systemImage: "bolt") }

            NavigationStack {
                List {
                    Label("家庭连接", systemImage: "house")
                    Label("账号与安全", systemImage: "person")
                    Label("设置", systemImage: "gear")
                }
                .navigationTitle("我的")
            }
            .tabItem { Label("我的", systemImage: "person") }
        }
    }
}
