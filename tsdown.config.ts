/**
 * 浏览器端 bundle 构建：产出 lib/client.js（__ModuleLoader__ 工厂包）。
 *
 * 平台模块（react、cordis、客户端共享库等）保持 external，由浏览器
 * shell 的冻结模块表提供；其余依赖内联进 bundle。
 */

import { defineConfig } from 'tsdown'

const ID = '@pocket30/dsh-serendipity'

/** shell 共享的平台模块（与 dsh 官方 clientBundle 预设一致）。 */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
] as const

/** 模块表 external：平台模块 + runtime 快照引擎豁免项。 */
const CLIENT_EXTERNALS: readonly string[] = [
  ...PLATFORM_MODULES,
  '@deepseek-ai/dsh-client-runtime/client',
]

export default defineConfig({
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: true,
  external: [...CLIENT_EXTERNALS],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
