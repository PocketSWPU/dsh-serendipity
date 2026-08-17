/**
 * 奇遇引擎：抽奖、选主题、选事件、结算属性与等级。
 *
 * 纯函数实现，随机源可注入，便于单元测试。
 *
 * 选择机制：
 * - 事件按 `minLevel` 划分层级（日常/冒险/史诗/传奇），等级越高越容易
 *   抽中更宏大的事件（等级偏置权重，见 eventSelectionWeight）；
 * - 带 `branches` 的事件会按主角属性值命中不同的分支线（见 selectBranch）。
 */

import { applyAttributeDeltas } from './attributes.js'
import type { CharacterProfile } from './profile.js'
import {
  EVENT_TIERS,
  eventTierOf,
  type AdventureEvent,
  type EventBranch,
  type EventBranchCondition,
  type ThemeDef,
} from './themes.js'

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

/**
 * 事件的“等级偏置权重”：等级越高，越宏大的事件越容易被抽中。
 *
 * - 未达到事件层级门槛（minLevel）时权重为 0（不可抽中）；
 * - 日常事件（minLevel 1）恒为基准权重；
 * - 冒险/史诗/传奇事件解锁后，权重随等级提升线性放大，
 *   直到达到 1 + 层级序号 × 2 倍封顶（层级序号 0~3）。
 */
export function eventSelectionWeight(event: Readonly<AdventureEvent>, level: number): number {
  const base = Math.max(0, event.weight)
  if (base <= 0) return 0
  const tier = eventTierOf(event)
  if (level < tier.minLevel) return 0
  const index = EVENT_TIERS.findIndex(candidate => candidate.id === tier.id)
  if (index <= 0) return base
  const progress = Math.min(1, (level - tier.minLevel) / 6)
  return base * (1 + index * 2 * progress)
}

/** 判断分支条件是否命中。 */
export function branchMatches(
  attributes: Readonly<Record<string, number>>,
  when: EventBranchCondition,
): boolean {
  if ('always' in when) return true
  const value = attributes[when.attribute]
  if (typeof value !== 'number') return false
  if ('min' in when && value < when.min) return false
  if ('max' in when && value > when.max) return false
  if ('highest' in when) {
    const max = Math.max(...Object.values(attributes))
    if (value < max) return false
  }
  if ('lowest' in when) {
    const min = Math.min(...Object.values(attributes))
    if (value > min) return false
  }
  return true
}

/** 按属性值挑选事件的第一条命中分支；无分支或都不命中时返回 undefined。 */
export function selectBranch(
  profile: Readonly<CharacterProfile>,
  event: Readonly<AdventureEvent>,
): EventBranch | undefined {
  if (event.branches === undefined) return undefined
  for (const branch of event.branches) {
    if (branchMatches(profile.attributes, branch.when)) return branch
  }
  return undefined
}

export interface ResolvedEventCatalog {
  readonly themes: readonly ThemeDef[]
}

export interface PickedAdventure {
  readonly theme: ThemeDef
  readonly event: AdventureEvent
  /** 依据当前属性命中的分支（若事件有分支且命中）。 */
  readonly branch: EventBranch | undefined
}

/**
 * 依据角色等级与属性从事件池中挑选一次奇遇：
 * 先按主题权重选主题，再在主题内按“等级偏置权重”挑选满足层级门槛的事件，
 * 最后按属性值命中分支线。
 */
export function selectAdventure(
  profile: Readonly<CharacterProfile>,
  catalog: ResolvedEventCatalog,
  random: EngineRandom,
): PickedAdventure | undefined {
  const theme = pickWeighted(catalog.themes, random)
  if (theme === undefined) return undefined
  const weighted = theme.events
    .map((event) => ({ event, weight: eventSelectionWeight(event, profile.level) }))
    .filter((entry) => entry.weight > 0)
  const picked = pickWeighted(weighted, random)
  if (picked === undefined) return undefined
  const branch = selectBranch(profile, picked.event)
  return { theme, event: picked.event, branch }
}

export interface AdventureOutcome {
  /** 结算后的档案（应持久化）。 */
  readonly profile: CharacterProfile
  /** 本次奇遇的主题名。 */
  readonly themeName: string
  /** 本次奇遇的事件。 */
  readonly event: AdventureEvent
  /** 命中的分支（若有）。 */
  readonly branch: EventBranch | undefined
  /** 事件层级（按 minLevel 推导）。 */
  readonly tier: ReturnType<typeof eventTierOf>
  /** 实际发生的属性变化。 */
  readonly effects: Readonly<Record<string, number>>
  /** 本次获得的经验。 */
  readonly expGained: number
  /** 升级信息（若有）。 */
  readonly levelUp: { readonly from: number; readonly to: number } | undefined
}

/**
 * 把一次奇遇结算到档案上：
 * 命中分支时用分支的标题/描述/属性变化/经验，否则用事件本体；
 * 属性按 effect 增减并夹取到 [min, max]，经验累加并处理升级。
 */
export function applyAdventure(
  profile: Readonly<CharacterProfile>,
  themeName: string,
  event: Readonly<AdventureEvent>,
  now = Date.now(),
): AdventureOutcome {
  const branch = selectBranch(profile, event)
  const title = branch?.title ?? event.title
  const description = branch?.description ?? event.description
  const effects = branch?.effects ?? event.effects
  const expGained = branch?.exp ?? event.exp
  const tier = eventTierOf(event)

  const attributes = applyAttributeDeltas(profile.attributes, effects)
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
    title,
    description,
    effects: { ...effects },
    exp: expGained,
    time: now,
    ...(branch === undefined ? {} : { branch: branch.id }),
    tier: tier.id,
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
  return { profile: next, themeName, event, branch, tier, effects, expGained, levelUp }
}

/** 裁剪档案的冒险日志，只保留最近的 N 条。 */
export function trimAdventureLog(profile: CharacterProfile, max: number): CharacterProfile {
  if (profile.adventureLog.length <= max) return profile
  return { ...profile, adventureLog: profile.adventureLog.slice(0, max) }
}
