/**
 * 产品形态（构建期由 electron-vite 的 define 注入 __NF_PRODUCT__）
 *  - flash：NovaForge Flash，专注固件编译、烧录与串口调试
 *  - studio：NovaForge Studio，AI 编写固件/文件、对话与烧录
 */
declare const __NF_PRODUCT__: string | undefined

const raw = typeof __NF_PRODUCT__ === 'undefined' ? 'studio' : __NF_PRODUCT__

export const PRODUCT: 'flash' | 'studio' = raw === 'flash' ? 'flash' : 'studio'
export const IS_FLASH = PRODUCT === 'flash'
export const PRODUCT_NAME = IS_FLASH ? 'NovaForge Flash' : 'NovaForge Studio'
export const PRODUCT_TAGLINE = IS_FLASH ? 'ESP32 / Pi · 烧录与调试' : 'ESP32 / Pi · AI 编程'
