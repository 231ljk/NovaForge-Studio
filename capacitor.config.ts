import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.novaforge.studio',
  appName: 'NovaForge Studio',
  webDir: 'src/mobile',
  // 原生 HTTP：绕过 WebView 的跨域限制，才能直接向 github.com 授权、
  // 以及访问 http:// 的局域网 Home Assistant
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
}

export default config
