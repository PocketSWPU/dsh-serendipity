/**
 * 档案持久化：优先使用 storage domain（跨会话、跨重启），
 * 不可用时回退到进程内内存（仅当前运行期间有效）。
 *
 * storage domain 由 dsh-web 等带 storage 的组合自动挂载；
 * 若所在 profile 没有挂载，插件会打印一次告警并降级运行。
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  defineDomain,
  domainTable,
  type Domain,
  type DomainFacility,
} from '@deepseek-ai/dsh-storage-domain'
import { CharacterProfileSchema, type CharacterProfile } from './profile.js'

/** storage domain 声明：一张 profiles 表，以 profileId 为键。 */
export const SERENDIPITY_DOMAIN = defineDomain({
  name: 'serendipity',
  version: 1,
  tables: {
    profiles: domainTable<string, CharacterProfile>(CharacterProfileSchema),
  },
})

function renderThrown(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * 档案读写门面。所有方法都安全：domain 不可用时自动降级内存。
 */
export class ProfileStore {
  private domainPromise: Promise<Domain<typeof SERENDIPITY_DOMAIN> | undefined> | undefined
  private readonly memory = new Map<string, CharacterProfile>()
  private warned = false

  constructor(
    private readonly ctx: Context,
    private readonly pluginName: string,
  ) {}

  /** 解析（并惰性打开）storage domain；未挂载时返回 undefined。 */
  private async domain(): Promise<Domain<typeof SERENDIPITY_DOMAIN> | undefined> {
    this.domainPromise ??= (async () => {
      const facility = this.ctx.get('storageDomain') as DomainFacility | undefined
      if (facility === undefined) {
        if (!this.warned) {
          this.warned = true
          this.ctx.logger.warn(
            `[${this.pluginName}] storage domain 未挂载，档案仅保存在进程内存中；`
            + '如需跨会话养成，请使用带 storage-json/storage-domain 的组合（如 dsh web）。',
          )
        }
        return undefined
      }
      try {
        const opened = await facility.open(SERENDIPITY_DOMAIN)
        this.ctx.effect(() => () => {
          void opened.close()
        }, `${this.pluginName}.close-domain`)
        return opened
      } catch (error) {
        this.ctx.logger.warn(
          `[${this.pluginName}] 打开 storage domain 失败，降级为内存存储：${renderThrown(error)}`,
        )
        return undefined
      }
    })()
    return this.domainPromise
  }

  /** 读取档案；不存在时返回 undefined。 */
  async load(profileId: string): Promise<CharacterProfile | undefined> {
    const opened = await this.domain()
    if (opened !== undefined) {
      return opened.table('profiles').get(profileId)
    }
    return this.memory.get(profileId)
  }

  /** 保存档案。 */
  async save(profile: CharacterProfile): Promise<void> {
    const opened = await this.domain()
    if (opened !== undefined) {
      await opened.table('profiles').put(profile.profileId, profile)
      return
    }
    this.memory.set(profile.profileId, profile)
  }
}
