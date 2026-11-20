import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // --mode flash → NovaForge Flash；其余（含 dev）→ NovaForge Studio
  const product = mode === 'flash' ? 'flash' : 'studio'
  const define = { __NF_PRODUCT__: JSON.stringify(product) }

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
