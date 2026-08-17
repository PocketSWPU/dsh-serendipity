/**
 * 插件配置：schemastery schema + 默认值 + 主题目录的合并构建。
 */

import Schema from '@deepseek-ai/schemastery'
import type { AdventureEvent, EventBranch, EventBranchCondition, ThemeDef } from './themes.js'
import { DEFAULT_THEMES } from './themes.js'

export interface EventConfig {
  id: string
  title: string
  description: string
  effects: Record<string, number>
  exp: number
  minLevel?: number
  weight: number
  /** 属性分支线（可选）：按主角属性值命中不同走向。 */
  branches?: EventBranch[]
}

export interface ExtraThemeConfig {
  name: string
  description: string
  weight: number
  events: EventConfig[]
}

export interface Config {
  /** 奇遇总开关。 */
  enabled: boolean
  /** 每次用户完成一轮对话后触发奇遇的概率（0~1）。 */
  triggerChance: number
  /** 连续两次奇遇之间至少间隔的用户对话轮数（>=1）。 */
  cooldownTurns: number
  /** 奇遇如何呈现：followup=让模型把奇遇续写成故事；inject=仅注入上下文；none=只记录不展示。 */
  narrateMode: 'followup' | 'inject' | 'none'
  /** 档案 id：不同 id 就是不同的角色，跨会话共享同一档案。 */
  profileId: string
  /** 新角色的默认名字。 */
  characterName: string
  /** 主题权重覆盖：themeId -> 权重。 */
  themeWeights: Record<string, number>
  /** 单选主题：非空时只从该主题抽事件（空字符串 = 按 disabledThemes 过滤多选）。 */
  theme: string
  /** 追加新主题。 */
  extraThemes: Record<string, ExtraThemeConfig>
  /** 向既有主题追加新事件：themeId -> 事件列表。 */
  extraEvents: Record<string, EventConfig[]>
  /** 禁用的主题 id 列表。 */
  disabledThemes: string[]
  /** 是否注册 serendipity_* 工具。 */
  enableTools: boolean
  /** 档案里最多保留的奇遇记录条数。 */
  maxAdventureLog: number
}

const BranchConditionSchema = Schema.union([
  Schema.object({
    attribute: Schema.string().required(),
    min: Schema.number().required(),
  }),
  Schema.object({
    attribute: Schema.string().required(),
    max: Schema.number().required(),
  }),
  Schema.object({
    attribute: Schema.string().required(),
    highest: Schema.const(true).required(),
  }),
  Schema.object({
    attribute: Schema.string().required(),
    lowest: Schema.const(true).required(),
  }),
  Schema.object({
    always: Schema.const(true).required(),
  }),
])

const EventBranchSchema = Schema.object({
  id: Schema.string().required(),
  title: Schema.string().required(),
  description: Schema.string().required(),
  effects: Schema.dict(Schema.number()).default({}),
  exp: Schema.natural(),
  when: BranchConditionSchema,
})

const EventSchema = Schema.object({
  id: Schema.string().required(),
  title: Schema.string().required(),
  description: Schema.string().required(),
  effects: Schema.dict(Schema.number()).default({}),
  exp: Schema.natural().default(10),
  minLevel: Schema.natural().min(1),
  weight: Schema.number().min(0).default(1),
  branches: Schema.array(EventBranchSchema).default([]),
})

const ExtraThemeSchema = Schema.object({
  name: Schema.string().required(),
  description: Schema.string().default(''),
  weight: Schema.number().min(0).default(1),
  events: Schema.array(EventSchema).default([]),
})

export const Config: Schema<Config> = Schema.object({
  enabled: Schema.boolean().default(true),
  triggerChance: Schema.percent().default(0.25),
  cooldownTurns: Schema.natural().min(1).default(3),
  narrateMode: Schema.union(['followup', 'inject', 'none']).default('followup'),
  profileId: Schema.string().default('default'),
  characterName: Schema.string().default('无名主角'),
  themeWeights: Schema.dict(Schema.number().min(0)).default({}),
  theme: Schema.string().default(''),
  extraThemes: Schema.dict(ExtraThemeSchema).default({}),
  extraEvents: Schema.dict(Schema.array(EventSchema)).default({}),
  disabledThemes: Schema.array(Schema.string()).default([]),
  enableTools: Schema.boolean().default(true),
  maxAdventureLog: Schema.natural().min(1).default(20),
})

function normalizeEvent(event: EventConfig, themeId: string): AdventureEvent {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    effects: event.effects,
    exp: event.exp,
    ...(event.minLevel === undefined ? {} : { minLevel: event.minLevel }),
    weight: event.weight,
    ...(event.branches === undefined || event.branches.length === 0
      ? {}
      : { branches: event.branches }),
  }
}

/**
 * 把内置主题与用户配置合并成运行时目录：
 * 1) 追加 extraThemes；2) 向既有主题追加 extraEvents；
 * 3) 单选主题 theme 非空且存在时，只返回该主题（忽略 disabledThemes）；
 * 4) 应用 themeWeights 覆盖；5) 剔除 disabledThemes。
 */
export function resolveCatalog(config: Pick<
  Config,
  'themeWeights' | 'extraThemes' | 'extraEvents' | 'disabledThemes' | 'theme'
>): readonly ThemeDef[] {
  const byId = new Map<string, ThemeDef>()
  for (const theme of DEFAULT_THEMES) {
    byId.set(theme.id, theme)
  }
  for (const [themeId, extra] of Object.entries(config.extraThemes)) {
    byId.set(themeId, {
      id: themeId,
      name: extra.name,
      description: extra.description,
      weight: extra.weight,
      events: extra.events.map((event) => normalizeEvent(event, themeId)),
    })
  }
  for (const [themeId, events] of Object.entries(config.extraEvents)) {
    const theme = byId.get(themeId)
    if (theme === undefined) continue
    byId.set(themeId, {
      ...theme,
      events: [...theme.events, ...events.map((event) => normalizeEvent(event, themeId))],
    })
  }

  // 单选主题：非空且存在时只保留该主题（用户的显式选择，忽略 disabledThemes）。
  if (config.theme !== '') {
    const single = byId.get(config.theme)
    if (single !== undefined) {
      const weight = config.themeWeights[single.id]
      return [weight === undefined ? single : { ...single, weight }]
    }
  }

  const disabled = new Set(config.disabledThemes)
  return [...byId.values()]
    .filter((theme) => !disabled.has(theme.id))
    .map((theme) => {
      const weight = config.themeWeights[theme.id]
      return weight === undefined ? theme : { ...theme, weight }
    })
}
