@Component
export struct Login {
  onLogin: () => void = (): void => {};
  @State email: string = '';
  @State code: string = '';
  @State agreed: boolean = false;

  build() {
    Column({ space: 16 }) {
      Text('NovaForge')
        .fontSize(34)
        .fontWeight(FontWeight.Bold)
      Text('原生鸿蒙客户端')
        .fontColor(Color.Gray)

      TextInput({ text: this.email, placeholder: '邮箱地址' })
        .onChange((value: string) => {
          this.email = value;
        })
      TextInput({ text: this.code, placeholder: '验证码' })
        .onChange((value: string) => {
          this.code = value;
        })

      Row() {
        Checkbox()
          .select(this.agreed)
          .onChange((value: boolean) => {
            this.agreed = value;
          })
        Text('同意《隐私政策》和《用户协议》')
          .fontSize(14)
      }

      Button('登录')
        .width('100%')
        .enabled(this.agreed && this.email.length > 0)
        .onClick(() => {
          this.onLogin();
        })

      Text('Gitee / GitHub 授权将在原生授权流程中接入')
        .fontSize(12)
        .fontColor(Color.Gray)
    }
    .padding(24)
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
  }
}
