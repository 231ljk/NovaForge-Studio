@Component
export struct Home {
  @State currentTab: number = 0;
  private devices: string[] = ['示例 ESP32', '示例树莓派'];

  build() {
    Tabs({ barPosition: BarPosition.End, index: this.currentTab }) {
      TabContent() {
        List({ space: 12 }) {
          ForEach(this.devices, (device: string) => {
            ListItem() {
              Text(device)
                .fontSize(18)
                .padding(20)
                .width('100%')
            }
          }, (device: string) => device)
        }
        .padding(16)
        .width('100%')
        .height('100%')
      }
      .tabBar('设备')

      TabContent() {
        Text('场景自动化将在原生模块中实现')
          .padding(24)
      }
      .tabBar('场景')

      TabContent() {
        Text('家庭连接、账号与安全、设置')
          .padding(24)
      }
      .tabBar('我的')
    }
    .width('100%')
    .height('100%')
    .onChange((index: number) => {
      this.currentTab = index;
    })
  }
}
