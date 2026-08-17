/**
 * 设置集成：把“奇遇设置”注册为 dsh 的 settings 命名空间，并提供
 * 插件自有的设置读写面（宿主侧）。
 *
 * 关键事实：dsh Web 的设置 RPC（api-proxy）只对白名单命名空间开放
 * （WEB_SETTINGS_NAMESPACES），第三方命名空间不会暴露给浏览器客户端。
 * 因此浏览器端“奇遇设置”页通过插件自有的 /serendipity/api 路由读写，
 * 宿主在进程内调用 settings 服务（不受白名单限制）。
 *
 * 解析顺序：schema 默认值 → 组合入口配置（cordis.yml 的 config）→ 用户设置层
 * （$DSH_HOME/settings.yaml 的 serendipity: 小节）。用户层修改实时生效。
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  settingsNamespace,
  type SettingsNamespace,
  type SettingsProvider,
} from '@deepseek-ai/dsh-settings'
import type { Config } from './config.js'
import { Config as ConfigSchema } from './config.js'
import { registerSerendipityRoutes } from './routes.js'
import type { StatusValue } from './tools.js'

/** 设置命名空间：与插件名一致。 */
export const SERENDIPITY_SETTINGS_NAMESPACE: SettingsNamespace = settingsNamespace('serendipity')

/** 当前生效配置的读取入口（入口配置或设置页解析后的配置）。 */
export type ConfigSource = () => Config

/** 插件自有路由暴露给浏览器端的设置读写面。 */
export interface SettingsFace {
  /** 当前解析后的配置值 + 用户层修订号（settings 服务缺失时返回入口配置）。 */
  get(): { value: unknown; revision: number | undefined }
  /** 合并一个补丁（修订号守卫），返回刷新后的视图。 */
  update(
    patch: Record<string, unknown>,
    expectedRevision?: number,
  ): Promise<{ value: unknown; revision: number | undefined }>
}

function fallbackFace(entry: Config): SettingsFace {
  return {
    get: () => ({ value: entry, revision: undefined }),
    update: async (patch) => ({ value: { ...entry, ...patch }, revision: undefined }),
  }
}

/**
 * 安装设置命名空间、返回配置读取器与设置读写面，并在 Web 组合下挂载
 * 插件自有路由。settings / webServer 服务缺席时降级为入口配置，核心
 * 功能不受影响。
 * @param entry - 组合入口配置（作为设置 base 层）。
 * @param onChange - 用户设置提交后回调（当前无需重建派生状态）。
 */
export function installSerendipitySettings(
  ctx: Context,
  entry: Config,
  onChange: () => void = () => {},
  profile: () => Promise<StatusValue>,
): { source: ConfigSource; face: () => SettingsFace } {
  let source: ConfigSource = () => entry
  let face: SettingsFace = fallbackFace(entry)

  ctx.inject(['settings'], (sctx) => {
    const provider = sctx.settings as SettingsProvider
    const scope = provider.register(SERENDIPITY_SETTINGS_NAMESPACE, ConfigSchema, { base: entry })
    source = () => scope.get()

    const viewOf = (): { value: unknown; revision: number | undefined } => {
      const descriptor = provider.describe({ redactSecrets: true })
        .find(candidate => candidate.ns === SERENDIPITY_SETTINGS_NAMESPACE)
      return descriptor === undefined
        ? { value: undefined, revision: undefined }
        : { value: descriptor.value, revision: descriptor.revision }
    }
    face = {
      get: viewOf,
      update: async (patch, expectedRevision) => {
        await provider.update(SERENDIPITY_SETTINGS_NAMESPACE, patch, expectedRevision)
        return viewOf()
      },
    }

    // Web 组合下挂载插件自有设置路由；headless/TUI 等无 webServer 的组合
    // 跳过（核心触发逻辑照常工作）。
    sctx.inject(['webServer', 'webRuntime'], (wctx) => {
      registerSerendipityRoutes(
        wctx,
        () => face,
        () => source(),
        profile,
      )
    })

    sctx.effect(() => () => {
      source = () => entry
      face = fallbackFace(entry)
    })
    onChange()
    scope.watch(() => onChange())
  })

  return { source: () => source(), face: () => face }
}
