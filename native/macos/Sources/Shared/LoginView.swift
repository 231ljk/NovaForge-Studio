import SwiftUI

public struct LoginView: View {
    public var onLogin: () -> Void
    @State private var email = ""
    @State private var code = ""

    public init(onLogin: @escaping () -> Void) {
        self.onLogin = onLogin
    }

    public var body: some View {
        VStack(spacing: 20) {
            Text("NovaForge")
                .font(.system(size: 34, weight: .bold))
            Text("原生 macOS 客户端")
                .foregroundStyle(.secondary)

            TextField("邮箱地址", text: $email)
                .textFieldStyle(.roundedBorder)
                .frame(width: 280)
            SecureField("邮箱验证码", text: $code)
                .textFieldStyle(.roundedBorder)
                .frame(width: 280)

            Button("登录") { onLogin() }
                .buttonStyle(.borderedProminent)
                .disabled(email.isEmpty)

            Text("Gitee / GitHub 授权将在原生授权流程中接入")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(40)
        .frame(minWidth: 520, minHeight: 520)
    }
}
