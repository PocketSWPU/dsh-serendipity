import { describe, expect, it } from 'vitest'
import { DEFAULT_ATTRIBUTES } from '../src/attributes.js'
import { resolveCatalog } from '../src/config.js'
import {
  applyAdventure,
  branchMatches,
  eventSelectionWeight,
  expNeededForLevel,
  pickWeighted,
  selectAdventure,
  selectBranch,
} from '../src/engine.js'
import { createProfile } from '../src/profile.js'
import { DEFAULT_THEMES, EVENT_TIERS, eventTierOf, tierByLevel } from '../src/themes.js'
import type { AdventureEvent } from '../src/themes.js'

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

describe('eventTierOf / tierByLevel', () => {
  it('无 minLevel 视为日常，minLevel 越高层级越宏大', () => {
    expect(eventTierOf({}).id).toBe('daily')
    expect(eventTierOf({ minLevel: 1 }).id).toBe('daily')
    expect(eventTierOf({ minLevel: 2 }).id).toBe('quest')
    expect(eventTierOf({ minLevel: 4 }).id).toBe('epic')
    expect(eventTierOf({ minLevel: 9 }).id).toBe('legendary')
  })

  it('tierByLevel 返回当前等级可解锁的最高层级', () => {
    expect(tierByLevel(1).id).toBe('daily')
    expect(tierByLevel(3).id).toBe('quest')
    expect(tierByLevel(6).id).toBe('epic')
    expect(tierByLevel(10).id).toBe('legendary')
  })

  it('层级列表按 minLevel 升序排列', () => {
    const minLevels = EVENT_TIERS.map((tier) => tier.minLevel)
    expect([...minLevels].sort((a, b) => a - b)).toEqual(minLevels)
  })
})

describe('eventSelectionWeight', () => {
  const event = (minLevel: number | undefined, weight = 1): AdventureEvent => ({
    id: 'e',
    title: 't',
    description: 'd',
    effects: {},
    exp: 10,
    ...(minLevel === undefined ? {} : { minLevel }),
    weight,
  })

  it('未达到层级门槛的事件权重为 0', () => {
    expect(eventSelectionWeight(event(4), 1)).toBe(0)
    expect(eventSelectionWeight(event(9), 6)).toBe(0)
  })

  it('日常事件恒为基准权重', () => {
    expect(eventSelectionWeight(event(undefined), 1)).toBe(1)
    expect(eventSelectionWeight(event(undefined), 50)).toBe(1)
  })

  it('等级越高，更宏大的事件权重越大', () => {
    const legendary = event(7)
    const atUnlock = eventSelectionWeight(legendary, 7)
    const atHighLevel = eventSelectionWeight(legendary, 20)
    expect(atHighLevel).toBeGreaterThan(atUnlock)
    // 刚解锁时仍按基准权重参与抽取
    expect(atUnlock).toBe(1)
    // 封顶：1 + 3 * 2 = 7 倍
    expect(atHighLevel).toBeLessThanOrEqual(7)
  })

  it('高等级时传奇事件权重大于日常事件', () => {
    const daily = event(undefined)
    const legendary = event(7)
    expect(eventSelectionWeight(legendary, 50)).toBeGreaterThan(eventSelectionWeight(daily, 50))
  })
})

describe('branchMatches / selectBranch', () => {
  const attributes = { strength: 30, intelligence: 80, agility: 40, charisma: 50, luck: 20, vitality: 10 }

  it('按属性阈值命中', () => {
    expect(branchMatches(attributes, { attribute: 'intelligence', min: 70 })).toBe(true)
    expect(branchMatches(attributes, { attribute: 'intelligence', min: 90 })).toBe(false)
    expect(branchMatches(attributes, { attribute: 'vitality', max: 20 })).toBe(true)
    expect(branchMatches(attributes, { attribute: 'vitality', max: 5 })).toBe(false)
  })

  it('按最高/最低属性命中（并列也算）', () => {
    expect(branchMatches(attributes, { attribute: 'intelligence', highest: true })).toBe(true)
    expect(branchMatches(attributes, { attribute: 'strength', highest: true })).toBe(false)
    expect(branchMatches(attributes, { attribute: 'vitality', lowest: true })).toBe(true)
    expect(branchMatches(attributes, { attribute: 'luck', lowest: true })).toBe(false)
  })

  it('always 兜底恒命中', () => {
    expect(branchMatches(attributes, { always: true })).toBe(true)
  })

  it('selectBranch 返回第一条命中的分支', () => {
    const profile = { ...createProfile('test'), attributes }
    const event: AdventureEvent = {
      id: 'branchy',
      title: '本体',
      description: '本体描述',
      effects: { luck: 1 },
      exp: 5,
      weight: 1,
      branches: [
        { id: 'low-int', title: '低智', description: '', effects: { strength: 1 }, when: { attribute: 'intelligence', max: 40 } },
        { id: 'high-int', title: '高智', description: '', effects: { intelligence: 3 }, when: { attribute: 'intelligence', min: 70 } },
        { id: 'fallback', title: '兜底', description: '', effects: { luck: 2 }, when: { always: true } },
      ],
    }
    expect(selectBranch(profile, event)?.id).toBe('high-int')
  })

  it('无分支或都不命中时返回 undefined', () => {
    const profile = { ...createProfile('test'), attributes }
    const noBranches: AdventureEvent = { id: 'plain', title: 't', description: 'd', effects: {}, exp: 5, weight: 1 }
    expect(selectBranch(profile, noBranches)).toBeUndefined()
    const noMatch: AdventureEvent = {
      id: 'nope',
      title: 't',
      description: 'd',
      effects: {},
      exp: 5,
      weight: 1,
      branches: [{ id: 'x', title: 'x', description: 'x', effects: {}, when: { attribute: 'intelligence', min: 999 } }],
    }
    expect(selectBranch(profile, noMatch)).toBeUndefined()
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
    expect(outcome.profile.adventureLog[0]?.tier).toBe('daily')
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

  it('命中分支时用分支的标题/属性/经验结算，并记录 branch', () => {
    const profile = { ...createProfile('test'), attributes: { ...createProfile('test').attributes, intelligence: 80 } }
    const event: AdventureEvent = {
      id: 'branchy',
      title: '本体的标题',
      description: '本体的描述',
      effects: { luck: 1 },
      exp: 5,
      weight: 1,
      branches: [
        { id: 'smart', title: '智取的标题', description: '智取的描述', effects: { intelligence: 4 }, exp: 9, when: { attribute: 'intelligence', min: 70 } },
        { id: 'fallback', title: '兜底', description: '', effects: { luck: 2 }, when: { always: true } },
      ],
    }
    const outcome = applyAdventure(profile, '测试', event, 2000)
    expect(outcome.branch?.id).toBe('smart')
    expect(outcome.effects).toEqual({ intelligence: 4 })
    expect(outcome.expGained).toBe(9)
    expect(outcome.profile.adventureLog[0]?.title).toBe('智取的标题')
    expect(outcome.profile.adventureLog[0]?.branch).toBe('smart')
    expect(outcome.profile.attributes.intelligence).toBe(84)
    expect(outcome.profile.adventureLog[0]?.tier).toBe('daily')
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

  it('选中事件时附带按属性命中的分支', () => {
    const profile = { ...createProfile('test'), attributes: { ...createProfile('test').attributes, strength: 90 } }
    const theme = {
      id: 'branchy',
      name: '分支',
      description: '',
      weight: 1,
      events: [{
        id: 'e',
        title: 't',
        description: 'd',
        effects: {},
        exp: 10,
        weight: 1,
        branches: [
          { id: 'str', title: 's', description: 's', effects: { strength: 2 }, when: { attribute: 'strength', highest: true } },
          { id: 'any', title: 'a', description: 'a', effects: { luck: 1 }, when: { always: true } },
        ],
      }],
    }
    const picked = selectAdventure(profile, { themes: [theme] }, () => 0.5)
    expect(picked?.event.id).toBe('e')
    expect(picked?.branch?.id).toBe('str')
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
        for (const branch of event.branches ?? []) {
          for (const id of Object.keys(branch.effects)) {
            expect(ids.has(id), `${theme.id}/${event.id} 分支 ${branch.id} 使用了未知属性 ${id}`).toBe(true)
          }
          if ('always' in branch.when) continue
          expect(ids.has(branch.when.attribute), `${theme.id}/${event.id} 分支 ${branch.id} 使用了未知条件属性 ${branch.when.attribute}`)
            .toBe(true)
        }
      }
    }
  })

  it('每个主题都有史诗与传奇层级的宏大事件', () => {
    for (const theme of DEFAULT_THEMES) {
      expect(theme.events.some((event) => eventTierOf(event).id === 'epic'),
        `${theme.id} 缺少史诗层级事件`).toBe(true)
      expect(theme.events.some((event) => eventTierOf(event).id === 'legendary'),
        `${theme.id} 缺少传奇层级事件`).toBe(true)
    }
  })
})
