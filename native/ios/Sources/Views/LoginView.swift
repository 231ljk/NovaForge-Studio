import SwiftUI

struct LoginView: View {
    var onLogin: () -> Void
    @State private var email = ""
    @State private var code = ""
    @State private var agreed = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("NovaForge")
                        .font(.largeTitle.bold())
                    Text("原生 iOS 客户端")
                        .foregroundStyle(.secondary)
                }

                Section("邮箱登录") {
                    TextField("邮箱地址", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                    TextField("验证码", text: $code)
                        .keyboardType(.numberPad)
                }

                Section {
                    Toggle("同意《隐私政策》和《用户协议》", isOn: $agreed)
                    Button("登录") { onLogin() }
                        .disabled(!agreed || email.isEmpty)
                }

                Section {
                    Text("Gitee / GitHub 授权将在原生授权流程中接入")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("登录")
        }
    }
}
