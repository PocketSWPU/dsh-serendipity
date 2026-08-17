/**
 * 角色档案模型：属性、等级、经验与奇遇记录。
 *
 * 档案是纯 JSON 数据，持久化在 storage domain（跨会话）或进程内
 * 内存兜底。zod schema 同时用于存储校验与类型推导。
 */

import { z } from 'zod'
import { initialAttributes } from './attributes.js'

export const AdventureRecordSchema = z.object({
  /** 事件 id（themeId/eventId）。 */
  id: z.string(),
  /** 主题名。 */
  theme: z.string(),
  /** 事件标题。 */
  title: z.string(),
  /** 事件描述。 */
  description: z.string(),
  /** 实际发生的属性变化（已夹取）。 */
  effects: z.record(z.string(), z.number()),
  /** 获得的经验。 */
  exp: z.number().int().nonnegative(),
  /** 发生时间（Unix 毫秒）。 */
  time: z.number().int().nonnegative(),
  /** 升级信息（可选）。 */
  levelUp: z.object({
    from: z.number().int().positive(),
    to: z.number().int().positive(),
  }).optional(),
  /** 命中的分支 id（可选）。 */
  branch: z.string().optional(),
  /** 事件层级 id（日常/冒险/史诗/传奇，可选，兼容旧记录）。 */
  tier: z.string().optional(),
})

export type AdventureRecord = z.infer<typeof AdventureRecordSchema>

export const CharacterProfileSchema = z.object({
  /** 档案 id（即配置里的 profileId）。 */
  profileId: z.string(),
  /** 角色名。 */
  name: z.string(),
  /** 当前等级，最低 1。 */
  level: z.number().int().positive(),
  /** 当前经验。 */
  exp: z.number().int().nonnegative(),
  /** 属性表：attributeId -> 当前值。 */
  attributes: z.record(z.string(), z.number()),
  /** 累计奇遇次数。 */
  totalAdventures: z.number().int().nonnegative(),
  /** 最近的奇遇记录（新→旧）。 */
  adventureLog: z.array(AdventureRecordSchema),
  /** 创建时间（Unix 毫秒）。 */
  createdAt: z.number().int().nonnegative(),
  /** 最后更新时间（Unix 毫秒）。 */
  updatedAt: z.number().int().nonnegative(),
})

export type CharacterProfile = z.infer<typeof CharacterProfileSchema>

/** 创建一份全新档案。 */
export function createProfile(profileId: string, name = '无名主角', now = Date.now()): CharacterProfile {
  return {
    profileId,
    name,
    level: 1,
    exp: 0,
    attributes: initialAttributes(),
    totalAdventures: 0,
    adventureLog: [],
    createdAt: now,
    updatedAt: now,
  }
}
