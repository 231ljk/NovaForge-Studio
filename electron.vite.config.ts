import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // --mode flash → NovaForge Flash；其余（含 dev）→ NovaForge Studio
  const product = mode === 'flash' ? 'flash' : 'studio'
  // 敏感凭据从 .env.local 注入，不进版本库
  const env = loadEnv(mode, process.cwd(), '')
  const define = {
    __NF_PRODUCT__: JSON.stringify(product),
    __NF_GITEE_CLIENT_SECRET__: JSON.stringify(env.NF_GITEE_CLIENT_SECRET || '')
  }

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      define
    },
    renderer: {
      plugins: [react()],
      define
    }
  }
})
