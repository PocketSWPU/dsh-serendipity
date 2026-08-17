/**
 * 工作奇遇（dsh-serendipity）
 *
 * 把用户当成一位主角：每次完成一轮对话都有几率触发一次随机奇遇，
 * 奇遇来自不同主题（科幻/玄幻/远古/动漫/小说/武侠/都市…），
 * 并对主角的力量、智力、敏捷、魅力、幸运、体魄等属性产生不同影响，
 * 持续养成角色、影响后续对话的发展。
 *
 * 事件流：
 *   turn/end（用户轮结束） → 概率命中 → 选主题/事件 → 结算属性与经验
 *   → 持久化档案 → followup 注入剧情，让模型把奇遇续写成故事。
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-tools'
import { Config as ConfigSchema, resolveCatalog } from './config.js'
import type { Config } from './config.js'
import { installSerendipitySettings, SERENDIPITY_SETTINGS_NAMESPACE } from './settings.js'
import type { ConfigSource } from './settings.js'
import { ProfileStore } from './store.js'
import { AdventureRuntime } from './runtime.js'
import { buildResetTool, buildStatusTool, statusValue } from './tools.js'
import type { StatusValue } from './tools.js'

export { Config } from './config.js'
export type { EventConfig, ExtraThemeConfig } from './config.js'
export * from './attributes.js'
export * from './engine.js'
export * from './profile.js'
export * from './runtime.js'
export * from './settings.js'
export * from './store.js'
export * from './themes.js'

/** 插件名（也是注入消息的 source.plugin）。 */
export const name = 'serendipity'

/** 需要的基础服务：agents（按会话找 Agent）、tools（注册 serendipity_* 工具）。 */
export const inject = ['agents', 'tools']

export function apply(ctx: Context, config: Config): void {
  const store = new ProfileStore(ctx, name)
  const catalog = resolveCatalog(config)

  // 「角色档案」读取入口（profile.get 路由 / 设置页展示用）。
  // profileId 可能被用户设置层修改，故经 configSource 取值，而不是直接用入口配置。
  let configSource: ConfigSource = () => config
  const profileGetter = async (): Promise<StatusValue> => {
    const current = configSource()
    return statusValue(await store.load(current.profileId), current)
  }
  const { source } = installSerendipitySettings(ctx, config, () => {}, profileGetter)
  configSource = source

  new AdventureRuntime(ctx, configSource, () => resolveCatalog(configSource()), store)

  if (config.enableTools) {
    ctx.tools.register(buildStatusTool(configSource, store))
    ctx.tools.register(buildResetTool(configSource, store))
  }

  ctx.logger.info(
    `[${name}] 已加载：触发概率 ${Math.round(config.triggerChance * 100)}%，`
    + `冷却 ${config.cooldownTurns} 轮，主题 ${catalog.length} 个，档案 ${config.profileId}`
    + `（${config.narrateMode === 'none' ? '静默记录' : config.narrateMode} 模式，设置命名空间 ${SERENDIPITY_SETTINGS_NAMESPACE}）`,
  )
}
