/**
 * 插件自有设置 API：通过 /serendipity/api 路由读写宿主设置命名空间。
 *
 * 不用 dsh 的 settings RPC——官方只把白名单命名空间暴露给配置客户端，
 * 第三方命名空间走插件自有路由（宿主进程内调用 settings 服务）。
 */

/** 一次 wire 失败。 */
export class SerendipityApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

/** 设置视图：解析后的值 + 用户层修订号。 */
export interface SettingsView {
  value?: unknown
  revision?: number
}

/** 主题目录条目（设置页“主题”卡片网格用）。 */
export interface ThemeCatalogEntry {
  id: string
  name: string
  weight: number
  enabled: boolean
}

/** 角色档案视图（profile.get，与宿主 statusValue 同构）。 */
export interface ProfileView {
  started: boolean
  profileId: string
  name: string
  level: number
  exp: number
  expToNext: number
  totalAdventures: number
  attributes: { id: string; label: string; value: number }[]
  recentAdventures: {
    tier?: string
    theme: string
    title: string
    effectsText: string
    exp: number
    time: number
  }[]
}

async function call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/serendipity/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    throw new SerendipityApiError('network', error instanceof Error ? error.message : String(error))
  }
  const parsed: { ok?: boolean; value?: unknown; error?: { code?: string; message?: string } } | null
    = await response.json().catch(() => null)
  if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === undefined) {
    throw new SerendipityApiError(
      parsed?.error?.code ?? 'http',
      parsed?.error?.message ?? `HTTP ${response.status}`,
    )
  }
  return parsed.value as T
}

/** 奇遇设置 API 面。 */
export const api = {
  /** 读取当前配置 + 修订号。 */
  settingsGet: () => call<SettingsView>('settings.get', {}),
  /** 合并一个补丁（修订号守卫），返回刷新后的视图。 */
  settingsUpdate: (patch: Record<string, unknown>, expectedRevision?: number) =>
    call<SettingsView>('settings.update', {
      patch,
      ...(expectedRevision === undefined ? {} : { expectedRevision }),
    }),
  /** 主题目录（名称/权重/启用状态）。 */
  settingsCatalog: () => call<{ themes: ThemeCatalogEntry[] }>('settings.catalog', {}),
  /** 角色档案（等级/属性/最近奇遇）。 */
  profileGet: () => call<ProfileView>('profile.get', {}),
}
