import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { analyzeSession, renderAdventurePrompt } from '../src/runtime.js'
import { applyAdventure } from '../src/engine.js'
import { createProfile } from '../src/profile.js'
import { DEFAULT_THEMES } from '../src/themes.js'

interface TurnSpec {
  turn: number
  user: boolean
  adventure?: boolean
  completed?: boolean
}

function buildSession(turns: TurnSpec[]): { events: SessionEvent[] } {
  const events: SessionEvent[] = []
  let seq = 0
  const source = (kind: 'user' | 'plugin', adventure: boolean) => ({
    kind,
    ...(adventure ? { plugin: 'serendipity' } : {}),
  } as const)
  for (const spec of turns) {
    events.push({
      type: 'turn/start',
      seq: seq++,
      time: 0,
      data: { turn: spec.turn },
    } as SessionEvent)
    events.push({
      type: 'user/message',
      seq: seq++,
      time: 0,
      data: {
        id: `msg-${seq}`,
        role: 'user',
        content: [{ type: 'text', text: 'test' }],
        source: source(spec.user ? 'user' : 'plugin', spec.adventure === true),
      },
    } as unknown as SessionEvent)
    events.push({
      type: 'turn/end',
      seq: seq++,
      time: 0,
      data: {
        turn: spec.turn,
        reason: { kind: spec.completed === false ? 'aborted' : 'completed' },
      },
    } as SessionEvent)
  }
  return { events }
}

describe('analyzeSession', () => {
  it('统计完成的用户轮次', () => {
    const session = buildSession([
      { turn: 1, user: true },
      { turn: 2, user: true },
      { turn: 3, user: true, completed: false },
    ])
    expect(analyzeSession(session as never, 'serendipity')).toEqual({
      completedUserTurns: 2,
      lastAdventureUserTurnIndex: undefined,
    })
  })

  it('插件注入的轮次不计为用户轮，并作为奇遇标记', () => {
    const session = buildSession([
      { turn: 1, user: true },
      { turn: 2, user: false, adventure: true },
      { turn: 3, user: true },
    ])
    expect(analyzeSession(session as never, 'serendipity')).toEqual({
      completedUserTurns: 2,
      lastAdventureUserTurnIndex: 1,
    })
  })
})

describe('renderAdventurePrompt', () => {
  it('文案包含主题、标题与属性变化', () => {
    const profile = createProfile('test', '主角')
    const theme = DEFAULT_THEMES[0]!
    const outcome = applyAdventure(profile, theme.name, theme.events[0]!, 1000)
    const { text, summary } = renderAdventurePrompt(outcome.profile, outcome)
    expect(text).toContain('奇遇触发')
    expect(text).toContain(theme.name)
    expect(text).toContain(theme.events[0]!.title)
    expect(text).toContain('属性变化')
    expect(summary.length).toBeLessThanOrEqual(120)
  })
})
