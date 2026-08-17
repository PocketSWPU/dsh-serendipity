/**
 * 模型可调用的 serendipity_* 工具：查看角色状态、重置角色。
 */

import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool, type InferArgs } from '@deepseek-ai/dsh-tools'
import { attributeDef } from './attributes.js'
import type { Config } from './config.js'
import { expNeededForLevel } from './engine.js'
import type { CharacterProfile } from './profile.js'
import { createProfile } from './profile.js'
import type { ConfigSource } from './settings.js'
import type { ProfileStore } from './store.js'
import { tierLabel } from './themes.js'
import { renderEffects, renderProfileLine } from './runtime.js'

const statusOutput = {
  type: 'object',
  additionalProperties: false,
  properties: {
    started: { type: 'boolean' },
    profileId: { type: 'string' },
    name: { type: 'string' },
    level: { type: 'integer' },
    exp: { type: 'integer' },
    expToNext: { type: 'integer' },
    totalAdventures: { type: 'integer' },
    attributes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          value: { type: 'integer' },
        },
      },
    },
    recentAdventures: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tier: { type: 'string' },
          theme: { type: 'string' },
          title: { type: 'string' },
          effectsText: { type: 'string' },
          exp: { type: 'integer' },
          time: { type: 'integer' },
        },
      },
    },
  },
} as const

const resetOutput = {
  type: 'object',
  additionalProperties: false,
  properties: {
    profileId: { type: 'string' },
    name: { type: 'string' },
    level: { type: 'integer' },
  },
} as const

export function statusValue(profile: CharacterProfile | undefined, config: Config): {
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
} {
  const base = profile ?? createProfile(config.profileId, config.characterName)
  return {
    started: profile !== undefined,
    profileId: base.profileId,
    name: base.name,
    level: base.level,
    exp: base.exp,
    expToNext: expNeededForLevel(base.level),
    totalAdventures: base.totalAdventures,
    attributes: Object.entries(base.attributes).map(([id, value]) => ({
      id,
      label: attributeDef(id).label,
      value,
    })),
    recentAdventures: base.adventureLog.slice(0, 5).map((record) => ({
      ...(record.tier === undefined ? {} : { tier: tierLabel(record.tier) ?? record.tier }),
      theme: record.theme,
      title: record.title,
      effectsText: renderEffects(record.effects),
      exp: record.exp,
      time: record.time,
    })),
  }
}

/** 角色档案视图（serendipity_status 工具、profile.get 路由与设置页共用）。 */
export type StatusValue = ReturnType<typeof statusValue>

function renderStatus(
  _args: InferArgs<typeof statusParameters>,
  value: ReturnType<typeof statusValue>,
): ContentBlock[] {
  const lines: string[] = []
  if (!value.started) {
    lines.push('【工作奇遇】角色尚未开启养成。完成几轮对话，触发第一次奇遇后即可查看成长。')
    lines.push(`（当前档案：${value.profileId} / ${value.name}）`)
  } else {
    lines.push(`【工作奇遇】角色档案 · ${value.name}（${value.profileId}）`)
    lines.push(`等级 ${value.level} · 经验 ${value.exp}/${value.expToNext} · 累计奇遇 ${value.totalAdventures} 次`)
    lines.push(value.attributes.map((attribute) => `${attribute.label} ${attribute.value}`).join(' · '))
    if (value.recentAdventures.length > 0) {
      lines.push('')
      lines.push('最近奇遇：')
      for (const record of value.recentAdventures) {
        const tier = record.tier === undefined ? '' : `${record.tier}·`
        lines.push(`- [${tier}${record.theme}] ${record.title}（${record.effectsText}，经验 +${record.exp}）`)
      }
    }
  }
  return [{ type: 'text', text: lines.join('\n') }]
}

const statusParameters = {}

function renderReset(
  _args: InferArgs<typeof resetParameters>,
  value: { profileId: string; name: string; level: number },
): ContentBlock[] {
  return [{
    type: 'text',
    text: `【工作奇遇】已开启新的角色档案：${value.name}（${value.profileId}），等级 ${value.level}。`
      + ' 之后的奇遇将从这个新角色开始结算。',
  }]
}

const resetParameters = {
  confirm: {
    type: 'boolean',
    required: true,
    description: '确认重置：传入 true 才会真正开启新角色。',
  },
  name: {
    type: 'string',
    description: '新角色名（可选，默认使用配置里的 characterName）。',
  },
} as const

export function buildStatusTool(config: ConfigSource, store: ProfileStore) {
  return defineTool({
    name: 'serendipity_status',
    description: '查看“工作奇遇”主角的角色属性、等级与最近奇遇记录。',
    parameters: statusParameters,
    output: {
      schema: statusOutput,
      render: renderStatus,
    },
    async execute() {
      const current = config()
      const profile = await store.load(current.profileId)
      return statusValue(profile, current)
    },
  })
}

export function buildResetTool(config: ConfigSource, store: ProfileStore) {
  return defineTool({
    name: 'serendipity_reset',
    description: '重置“工作奇遇”主角：开启一份全新的角色档案（属性归零、等级回到 1）。必须显式确认。',
    parameters: resetParameters,
    output: {
      schema: resetOutput,
      render: renderReset,
    },
    async execute(args) {
      if (args.confirm !== true) {
        throw new Error('未确认重置：请传入 confirm: true 后再执行。')
      }
      const current = config()
      const profile = createProfile(current.profileId, args.name?.trim() || current.characterName)
      await store.save(profile)
      return { profileId: profile.profileId, name: profile.name, level: profile.level }
    },
  })
}

export function renderStatusForLog(profile: CharacterProfile): string {
  return `${profile.name}：${renderProfileLine(profile)}`
}
