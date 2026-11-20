export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/scenes/index',
    'pages/ai/index',
    'pages/me/index',
    'pages/login/index',
    'pages/add-device/index'
  ],
  window: {
    backgroundTextStyle: 'dark',
    backgroundColor: '#f5f6f7',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'NovaForge',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#86909c',
    selectedColor: '#00b3a4',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '设备',
        iconPath: 'assets/tabbar/home.svg',
        selectedIconPath: 'assets/tabbar/home-selected.svg'
      },
      {
        pagePath: 'pages/scenes/index',
        text: '场景',
        iconPath: 'assets/tabbar/scenes.svg',
        selectedIconPath: 'assets/tabbar/scenes-selected.svg'
      },
      {
        pagePath: 'pages/ai/index',
        text: 'AI 助手',
        iconPath: 'assets/tabbar/ai.svg',
        selectedIconPath: 'assets/tabbar/ai-selected.svg'
      },
      {
        pagePath: 'pages/me/index',
        text: '我的',
        iconPath: 'assets/tabbar/me.svg',
        selectedIconPath: 'assets/tabbar/me-selected.svg'
      }
    ]
  }
})
