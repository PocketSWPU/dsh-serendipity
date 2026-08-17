import { describe, expect, it } from 'vitest'
import { DEFAULT_ATTRIBUTES } from '../src/attributes.js'
import { resolveCatalog } from '../src/config.js'
import {
  applyAdventure,
  expNeededForLevel,
  pickWeighted,
  selectAdventure,
} from '../src/engine.js'
import { createProfile } from '../src/profile.js'
import { DEFAULT_THEMES } from '../src/themes.js'

const sequence = (values: number[]) => {
  let index = 0
  return () => values[index++] ?? 0
}

describe('pickWeighted', () => {
  it('按权重挑选项目', () => {
    const items = [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 3 },
    ]
    // random=0.24 落在 b 的区间起点之前（0.24 * 4 = 0.96 < 1 → a）
    expect(pickWeighted(items, sequence([0.24]))?.id).toBe('a')
    // random=0.25 → 1.0 → b
    expect(pickWeighted(items, sequence([0.25]))?.id).toBe('b')
  })

  it('空列表返回 undefined', () => {
    expect(pickWeighted([], Math.random)).toBeUndefined()
  })
})

describe('applyAdventure', () => {
  it('结算属性增减与经验，并记录日志', () => {
    const profile = createProfile('test', '测试主角', 1000)
    const theme = DEFAULT_THEMES[0]!
    const event = theme.events[0]!
    const outcome = applyAdventure(profile, theme.name, event, 2000)

    expect(outcome.profile.totalAdventures).toBe(1)
    expect(outcome.profile.exp).toBe(event.exp)
    expect(outcome.profile.adventureLog[0]?.theme).toBe(theme.name)
    expect(outcome.profile.adventureLog[0]?.title).toBe(event.title)
    for (const [id, delta] of Object.entries(event.effects)) {
      expect(outcome.profile.attributes[id]).toBe(10 + delta)
    }
  })

  it('属性被夹取到 [0, 100] 区间', () => {
    const profile = createProfile('test')
    const event = {
      id: 'overflow',
      title: '极限',
      description: '超出上限',
      effects: { strength: 200, agility: -200 },
      exp: 10,
      weight: 1,
    }
    const outcome = applyAdventure(profile, '测试', event, 2000)
    expect(outcome.profile.attributes.strength).toBe(100)
    expect(outcome.profile.attributes.agility).toBe(0)
  })

  it('经验足够时升级，并扣除所需经验', () => {
    const profile = createProfile('test')
    const event = {
      id: 'huge',
      title: '大机缘',
      description: '获得海量经验',
      effects: {},
      exp: expNeededForLevel(1) + 5,
      weight: 1,
    }
    const outcome = applyAdventure(profile, '测试', event, 2000)
    expect(outcome.levelUp).toEqual({ from: 1, to: 2 })
    expect(outcome.profile.level).toBe(2)
    expect(outcome.profile.exp).toBe(5)
  })
})

describe('selectAdventure', () => {
  it('不选中等级未达标的事件', () => {
    const profile = createProfile('test')
    const theme = {
      id: 'gated',
      name: '门槛',
      description: '',
      weight: 1,
      events: [
        { id: 'low', title: '低级', description: '', effects: {}, exp: 1, weight: 1 },
        { id: 'high', title: '高级', description: '', effects: {}, exp: 1, minLevel: 5, weight: 1 },
      ],
    }
    const picked = selectAdventure(profile, { themes: [theme] }, () => 0.99)
    expect(picked?.event.id).toBe('low')
  })

  it('等级提升后可选中门槛事件', () => {
    const profile = { ...createProfile('test'), level: 6 }
    const theme = {
      id: 'gated',
      name: '门槛',
      description: '',
      weight: 1,
      events: [
        { id: 'low', title: '低级', description: '', effects: {}, exp: 1, weight: 1 },
        { id: 'high', title: '高级', description: '', effects: {}, exp: 1, minLevel: 5, weight: 1 },
      ],
    }
    const picked = selectAdventure(profile, { themes: [theme] }, () => 0.99)
    expect(picked?.event.id).toBe('high')
  })
})

describe('resolveCatalog', () => {
  it('单选主题 theme 非空时只返回该主题（含权重覆盖，忽略 disabledThemes）', () => {
    const themes = resolveCatalog({
      theme: 'wuxia',
      themeWeights: { wuxia: 5 },
      extraThemes: {},
      extraEvents: {},
      disabledThemes: ['wuxia'],
    })
    expect(themes.map(theme => theme.id)).toEqual(['wuxia'])
    expect(themes[0]!.weight).toBe(5)
  })

  it('theme 指向不存在的主题时回退到 disabledThemes 过滤', () => {
    const themes = resolveCatalog({
      theme: 'no-such-theme',
      themeWeights: {},
      extraThemes: {},
      extraEvents: {},
      disabledThemes: ['urban'],
    })
    expect(themes.some(theme => theme.id === 'urban')).toBe(false)
    expect(themes.length).toBe(DEFAULT_THEMES.length - 1)
  })

  it('theme 为空时按 disabledThemes 多选过滤', () => {
    const themes = resolveCatalog({
      theme: '',
      themeWeights: {},
      extraThemes: {},
      extraEvents: {},
      disabledThemes: ['urban', 'wuxia'],
    })
    expect(themes.length).toBe(DEFAULT_THEMES.length - 2)
    expect(themes.every(theme => theme.id !== 'urban' && theme.id !== 'wuxia')).toBe(true)
  })
})

describe('catalog 数据完整性', () => {
  it('每个主题至少包含一个事件，且属性 id 都在目录内', () => {
    const ids = new Set(DEFAULT_ATTRIBUTES.map((attribute) => attribute.id))
    expect(DEFAULT_THEMES.length).toBeGreaterThanOrEqual(5)
    for (const theme of DEFAULT_THEMES) {
      expect(theme.events.length).toBeGreaterThan(0)
      for (const event of theme.events) {
        for (const id of Object.keys(event.effects)) {
          expect(ids.has(id), `${theme.id}/${event.id} 使用了未知属性 ${id}`).toBe(true)
        }
      }
    }
  })
})
