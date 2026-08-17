/**
 * 奇遇运行时：监听 turn/end，按概率触发奇遇并注入对话。
 *
 * 触发条件（全部满足才触发）：
 * 1. 刚结束的一轮对话由“用户消息”发起（插件自身注入的轮次不算）；
 * 2. 距上次奇遇至少间隔了 cooldownTurns 轮用户对话；
 * 3. 随机数命中 triggerChance。
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Session, SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import { attributeDef } from './attributes.js'
import { applyAdventure, expNeededForLevel, selectAdventure, trimAdventureLog } from './engine.js'
import type { CharacterProfile } from './profile.js'
import { createProfile } from './profile.js'
import type { ConfigSource } from './settings.js'
import type { ProfileStore } from './store.js'
import type { ThemeDef } from './themes.js'

/** 插件标识，也用作注入消息的 source.plugin。 */
export const PLUGIN_NAME = 'serendipity'

export interface TurnAnalysis {
  /** 已完成的用户对话轮数。 */
  readonly completedUserTurns: number
  /** 最近一次奇遇发生时对应的用户轮序号；从未触发则为 undefined。 */
  readonly lastAdventureUserTurnIndex: number | undefined
}

/**
 * 扫描会话日志，统计已完成的用户轮数与最近奇遇标记。
 * 奇遇标记来自本插件注入的 user/message（source.kind === 'plugin'）。
 */
export function analyzeSession(session: Session, pluginName: string): TurnAnalysis {
  let currentTurn: number | undefined
  let completedUserTurns = 0
  let lastAdventureUserTurnIndex: number | undefined
  const userTurns = new Set<number>()
  const adventureTurns = new Set<number>()

  for (const event of session.events) {
    switch (event.type) {
      case 'turn/start':
        currentTurn = event.data.turn
        break
      case 'user/message': {
        if (currentTurn === undefined) break
        const source = event.data.source
        if (source.kind === 'user') {
          userTurns.add(currentTurn)
        } else if (source.kind === 'plugin' && source.plugin === pluginName) {
          adventureTurns.add(currentTurn)
        }
        break
      }
      case 'turn/end': {
        if (event.data.reason.kind !== 'completed') break
        const turn = event.data.turn
        if (userTurns.has(turn)) {
          completedUserTurns += 1
        }
        // 奇遇轮次本身不是用户轮：其索引记为“在此之前已完成的用户轮数”。
        if (adventureTurns.has(turn)) {
          lastAdventureUserTurnIndex = completedUserTurns
        }
        break
      }
      default:
        break
    }
  }
  return { completedUserTurns, lastAdventureUserTurnIndex }
}

/** 渲染“属性变化”一行。 */
export function renderEffects(effects: Readonly<Record<string, number>>): string {
  const parts = Object.entries(effects)
    .filter(([, delta]) => delta !== 0)
    .map(([id, delta]) => {
      const sign = delta > 0 ? '+' : ''
      return `${attributeDef(id).label} ${sign}${delta}`
    })
  return parts.length === 0 ? '无属性变化' : parts.join(' · ')
}

/** 渲染角色状态一行。 */
export function renderProfileLine(profile: Readonly<CharacterProfile>): string {
  const attrs = Object.entries(profile.attributes)
    .map(([id, value]) => `${attributeDef(id).label} ${value}`)
    .join(' · ')
  return `等级 ${profile.level} · 经验 ${profile.exp}/${expNeededForLevel(profile.level)} · ${attrs}`
}

export interface AdventurePromptResult {
  readonly text: string
  readonly summary: string
}

/** 组装注入给模型的消息文案。 */
export function renderAdventurePrompt(
  profile: Readonly<CharacterProfile>,
  outcome: ReturnType<typeof applyAdventure>,
): AdventurePromptResult {
  const { themeName, event, branch, tier, effects, expGained, levelUp } = outcome
  const title = branch?.title ?? event.title
  const description = branch?.description ?? event.description
  const levelLine = levelUp === undefined
    ? ''
    : `\n🎉 等级提升：${levelUp.from} 级 → ${levelUp.to} 级！`
  const text = [
    `【工作奇遇】${tier.label}奇遇触发 · ${themeName}`,
    `${title}：${description}`,
    `属性变化：${renderEffects(effects)} · 经验 +${expGained}`,
    `当前状态：${renderProfileLine(profile)}${levelLine}`,
    `累计奇遇：${profile.totalAdventures} 次`,
    '',
    '请以主角的视角把这次奇遇自然地融入当前对话，并在合适的位置交代属性变化；不要跳出角色。',
  ].join('\n')
  const summary = `工作奇遇触发：${themeName}·${title}（${renderEffects(effects)}）`
  return { text, summary }
}

interface SessionAdventureState {
  completedUserTurns: number
  lastAdventureUserTurnIndex: number | undefined
}

/**
 * 每个运行实例一份：全局监听 session/event，为每个根会话维护触发状态。
 * 通过 ctx.effect 注册监听与清理，插件卸载时自动释放。
 */
export class AdventureRuntime {
  private readonly states = new Map<SessionId, SessionAdventureState>()

  constructor(
    private readonly ctx: Context,
    private readonly config: ConfigSource,
    private readonly catalogSource: () => readonly ThemeDef[],
    private readonly store: ProfileStore,
    private readonly random: () => number = Math.random,
  ) {
    ctx.effect(() => {
      ctx.on('session/event', this.onSessionEvent)
      return () => {
        this.states.clear()
      }
    }, `${PLUGIN_NAME}.runtime`)
  }

  private stateFor(session: Session): SessionAdventureState {
    let state = this.states.get(session.id)
    if (state === undefined) {
      const analysis = analyzeSession(session, PLUGIN_NAME)
      state = {
        completedUserTurns: analysis.completedUserTurns,
        lastAdventureUserTurnIndex: analysis.lastAdventureUserTurnIndex,
      }
      this.states.set(session.id, state)
    }
    return state
  }

  private readonly onSessionEvent = (session: Session, event: SessionEvent): void => {
    if (event.type !== 'turn/end' || event.data.reason.kind !== 'completed') return
    const agent = this.ctx.agents.get(session.id)
    if (agent === undefined || agent.session !== session) return
    if (!this.ctx.agents.roots().includes(agent)) return
    void this.handleTurnEnd(agent, session).catch((error: unknown) => {
      this.ctx.logger.warn(`[${PLUGIN_NAME}] 触发奇遇失败: ${renderThrown(error)}`)
    })
  }

  private async handleTurnEnd(agent: Agent, session: Session): Promise<void> {
    const config = this.config()
    if (!config.enabled) return
    const state = this.stateFor(session)
    const analysis = analyzeSession(session, PLUGIN_NAME)
    if (analysis.completedUserTurns === state.completedUserTurns) return

    // 刚结束的轮次是一次新的用户对话轮。
    state.completedUserTurns = analysis.completedUserTurns
    if (analysis.lastAdventureUserTurnIndex !== undefined) {
      state.lastAdventureUserTurnIndex = analysis.lastAdventureUserTurnIndex
    }

    const sinceLast = state.completedUserTurns - (state.lastAdventureUserTurnIndex ?? 0)
    if (sinceLast < config.cooldownTurns) return
    if (this.random() >= config.triggerChance) return

    let profile = await this.store.load(config.profileId)
    if (profile === undefined) {
      profile = createProfile(config.profileId, config.characterName)
    }
    const picked = selectAdventure(profile, { themes: this.catalogSource() }, this.random)
    if (picked === undefined) return

    const outcome = applyAdventure(profile, picked.theme.name, picked.event)
    const saved = trimAdventureLog(outcome.profile, config.maxAdventureLog)
    await this.store.save(saved)
    state.lastAdventureUserTurnIndex = state.completedUserTurns

    if (config.narrateMode === 'none') return
    const prompt = renderAdventurePrompt(saved, outcome)
    const message = createUserMessage({
      content: [{ type: 'text', text: prompt.text }],
      source: {
        kind: 'plugin',
        plugin: PLUGIN_NAME,
        form: 'notice',
        summary: prompt.summary,
      },
    })
    if (config.narrateMode === 'inject') {
      agent.inject(message)
    } else {
      agent.followup(message)
    }
  }
}

function renderThrown(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
