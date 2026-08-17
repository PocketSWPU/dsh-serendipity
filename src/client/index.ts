/**
 * 工作奇遇 · 浏览器端插件：向 dsh 设置页注册“奇遇设置”页
 * （settings.section，参照 DSH-better-sidebar 的“侧边卡片”交互）。
 *
 * 页面读写走插件自有 /serendipity/api 路由（宿主进程内调用 settings
 * 服务），不依赖官方设置 RPC 的白名单。
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { SerendipitySettingsSection } from './section.tsx'

/** 浏览器端插件名。 */
export const name = 'serendipity-settings'

/** 需要的浏览器服务：slots（注册设置页）。 */
export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    return ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: 'serendipity',
      order: 16,
      label: () => '奇遇设置',
    }, SerendipitySettingsSection))
  }, `${name}: section`)
}
