/**
 * 主角属性目录。
 *
 * 属性是“工作奇遇”养成系统的核心数值：每次奇遇会对若干属性产生
 * 不同幅度的增减，属性最终影响主角在后续对话里的发展走向。
 * 本模块是纯数据，不依赖运行时服务。
 */

export interface AttributeDef {
  /** 稳定的英文 id，用于持久化和事件效果映射。 */
  readonly id: string
  /** 展示用中文名。 */
  readonly label: string
  /** 一句话说明。 */
  readonly description: string
  /** 新角色的初始值。 */
  readonly initial: number
  /** 允许的最小值。 */
  readonly min: number
  /** 允许的最大值。 */
  readonly max: number
}

export const DEFAULT_ATTRIBUTES: readonly AttributeDef[] = [
  {
    id: 'strength',
    label: '力量',
    description: '体力、武力与意志的体现，影响你在硬碰硬时的底气。',
    initial: 10,
    min: 0,
    max: 100,
  },
  {
    id: 'intelligence',
    label: '智力',
    description: '学识、推理与洞察，决定你能否看破谜局。',
    initial: 10,
    min: 0,
    max: 100,
  },
  {
    id: 'agility',
    label: '敏捷',
    description: '反应、身法与灵活度，关键时刻的应变能力。',
    initial: 10,
    min: 0,
    max: 100,
  },
  {
    id: 'charisma',
    label: '魅力',
    description: '气质、口才与亲和力，影响他人如何对待你。',
    initial: 10,
    min: 0,
    max: 100,
  },
  {
    id: 'luck',
    label: '幸运',
    description: '命运对你的偏爱程度，常常带来意外之喜。',
    initial: 10,
    min: 0,
    max: 100,
  },
  {
    id: 'vitality',
    label: '体魄',
    description: '耐力与生命力的上限，决定你能走多远。',
    initial: 10,
    min: 0,
    max: 100,
  },
]

export const ATTRIBUTE_IDS: readonly string[] = DEFAULT_ATTRIBUTES.map((attribute) => attribute.id)

/** 返回某属性的定义，找不到时回退到第一个属性。 */
export function attributeDef(id: string): AttributeDef {
  return DEFAULT_ATTRIBUTES.find((attribute) => attribute.id === id) ?? DEFAULT_ATTRIBUTES[0]!
}

/** 构造一份初始属性表（所有属性取初始值）。 */
export function initialAttributes(): Record<string, number> {
  return Object.fromEntries(DEFAULT_ATTRIBUTES.map((attribute) => [attribute.id, attribute.initial]))
}

/** 把 delta 应用到属性表上，并夹在 [min, max] 区间内。 */
export function applyAttributeDeltas(
  attributes: Readonly<Record<string, number>>,
  deltas: Readonly<Record<string, number>>,
): Record<string, number> {
  const next = { ...attributes }
  for (const [id, delta] of Object.entries(deltas)) {
    const def = attributeDef(id)
    const base = typeof next[id] === 'number' ? next[id]! : def.initial
    next[id] = Math.min(def.max, Math.max(def.min, base + delta))
  }
  return next
}
