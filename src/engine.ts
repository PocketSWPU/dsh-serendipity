/**
 * 奇遇引擎：抽奖、选主题、选事件、结算属性与等级。
 *
 * 纯函数实现，随机源可注入，便于单元测试。
 */

import { applyAttributeDeltas } from './attributes.js'
import type { CharacterProfile } from './profile.js'
import type { AdventureEvent, ThemeDef } from './themes.js'

/** 升到下一级所需的经验：level * 20（1 级需要 20 经验到 2 级）。 */
export function expNeededForLevel(level: number): number {
  return level * 20
}

/** 等级上限。 */
export const MAX_LEVEL = 99

export interface EngineRandom {
  /** 返回 [0, 1) 的随机数。 */
  (): number
}

/** 按权重随机取一项；items 为空或总权重 <= 0 时返回 undefined。 */
export function pickWeighted<T extends { readonly weight: number }>(
  items: readonly T[],
  random: EngineRandom,
): T | undefined {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0)
  if (items.length === 0 || total <= 0) return undefined
  let cursor = random() * total
  for (const item of items) {
    cursor -= Math.max(0, item.weight)
    if (cursor < 0) return item
  }
  return items[items.length - 1]
}

export interface ResolvedEventCatalog {
  readonly themes: readonly ThemeDef[]
}

/**
 * 依据角色等级从事件池中随机挑选一个事件：
 * 先按主题权重选主题，再在主题内按事件权重挑选满足等级门槛的事件。
 */
export function selectAdventure(
  profile: Readonly<CharacterProfile>,
  catalog: ResolvedEventCatalog,
  random: EngineRandom,
): { theme: ThemeDef; event: AdventureEvent } | undefined {
  const theme = pickWeighted(catalog.themes, random)
  if (theme === undefined) return undefined
  const eligible = theme.events.filter((event) =>
    event.minLevel === undefined || profile.level >= event.minLevel)
  const event = pickWeighted(eligible, random)
  if (event === undefined) return undefined
  return { theme, event }
}

export interface AdventureOutcome {
  /** 结算后的档案（应持久化）。 */
  readonly profile: CharacterProfile
  /** 本次奇遇的主题名。 */
  readonly themeName: string
  /** 本次奇遇的事件。 */
  readonly event: AdventureEvent
  /** 实际发生的属性变化。 */
  readonly effects: Readonly<Record<string, number>>
  /** 本次获得的经验。 */
  readonly expGained: number
  /** 升级信息（若有）。 */
  readonly levelUp: { readonly from: number; readonly to: number } | undefined
}

/**
 * 把一次奇遇结算到档案上：
 * 属性按事件 effect 增减并夹取到 [min, max]，经验累加并处理升级。
 */
export function applyAdventure(
  profile: Readonly<CharacterProfile>,
  themeName: string,
  event: Readonly<AdventureEvent>,
  now = Date.now(),
): AdventureOutcome {
  const attributes = applyAttributeDeltas(profile.attributes, event.effects)
  const expGained = event.exp
  let level = profile.level
  let exp = profile.exp + expGained
  let levelUp: AdventureOutcome['levelUp']

  while (level < MAX_LEVEL) {
    const needed = expNeededForLevel(level)
    if (exp < needed) break
    exp -= needed
    level += 1
    levelUp = { from: level - 1, to: level }
  }
  if (level >= MAX_LEVEL) exp = 0

  const record = {
    id: `${themeName}/${event.id}`,
    theme: themeName,
    title: event.title,
    description: event.description,
    effects: { ...event.effects },
    exp: expGained,
    time: now,
    ...(levelUp === undefined ? {} : { levelUp }),
  }

  const next: CharacterProfile = {
    ...profile,
    level,
    exp,
    attributes,
    totalAdventures: profile.totalAdventures + 1,
    adventureLog: [record, ...profile.adventureLog],
    updatedAt: now,
  }
  return { profile: next, themeName, event, effects: event.effects, expGained, levelUp }
}

/** 裁剪档案的冒险日志，只保留最近的 N 条。 */
export function trimAdventureLog(profile: CharacterProfile, max: number): CharacterProfile {
  if (profile.adventureLog.length <= max) return profile
  return { ...profile, adventureLog: profile.adventureLog.slice(0, max) }
}
