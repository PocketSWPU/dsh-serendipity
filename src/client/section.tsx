/**
 * 奇遇设置页（settings.section）：参照 DSH-better-sidebar 的“侧边卡片”
 * 交互——通用参数开关行 + 主题小卡片网格（单选题材）。所有读写走插件
 * 自有 /serendipity/api 路由。
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  IconCheckOutline16,
  Input,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { api, type ProfileView, type ThemeCatalogEntry } from './api.ts'

/** 注册侧 props：settings.section 的运行时席位（含 owner 的 close）。 */
export type SerendipitySettingsSectionProps = PropsRuntime<'settings.section'>

/** 主题卡片上的小图标（无图标目录时用 emoji 占位）。 */
const THEME_ICONS: Record<string, string> = {
  'sci-fi': '🚀',
  xianxia: '🐉',
  ancient: '🏺',
  anime: '⭐',
  novel: '📖',
  wuxia: '⚔️',
  urban: '🏙️',
  custom: '🎨',
}

/** 预留的自定义题材占位卡片（后续支持，暂不可选）。 */
const CUSTOM_THEME_CARD: ThemeCatalogEntry = {
  id: 'custom',
  name: '自定义题材',
  weight: 1,
  enabled: false,
}

/** 有效配置（解析后）的浏览器侧视图。 */
interface ConfigView {
  enabled: boolean
  triggerChance: number
  cooldownTurns: number
  narrateMode: string
  profileId: string
  characterName: string
  maxAdventureLog: number
  noRepeatWindow: number
  themeWeights: Record<string, number>
  theme: string
  disabledThemes: string[]
}

function viewOf(value: unknown): ConfigView {
  const record = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  return {
    enabled: record.enabled !== false,
    triggerChance: typeof record.triggerChance === 'number' ? record.triggerChance : 0.25,
    cooldownTurns: typeof record.cooldownTurns === 'number' ? record.cooldownTurns : 3,
    narrateMode: typeof record.narrateMode === 'string' ? record.narrateMode : 'followup',
    profileId: typeof record.profileId === 'string' ? record.profileId : 'default',
    characterName: typeof record.characterName === 'string' ? record.characterName : '无名主角',
    maxAdventureLog: typeof record.maxAdventureLog === 'number' ? record.maxAdventureLog : 20,
    noRepeatWindow: typeof record.noRepeatWindow === 'number' ? record.noRepeatWindow : 5,
    themeWeights: typeof record.themeWeights === 'object' && record.themeWeights !== null
      ? record.themeWeights as Record<string, number>
      : {},
    theme: typeof record.theme === 'string' ? record.theme : '',
    disabledThemes: Array.isArray(record.disabledThemes)
      ? (record.disabledThemes as unknown[]).filter((entry): entry is string => typeof entry === 'string')
      : [],
  }
}

/** 自定义开关：真实 checkbox（无障碍）驱动轨道/滑块。 */
function Switch(props: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  const { checked, onChange, label } = props
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
        onChange={event => { onChange(event.currentTarget.checked) }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? 'var(--accent, #4b8bff)' : 'rgba(128,128,128,.3)',
          transition: 'background .15s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: 8,
            background: '#fff',
            transition: 'left .15s',
          }}
        />
      </span>
    </label>
  )
}

/** 一行设置：标题/说明在左，控件在右。 */
function Row(props: { title: string; desc: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '12px 2px',
        borderTop: '1px solid var(--separator, rgba(128,128,128,.18))',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13 }}>{props.title}</span>
        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-weak, rgba(128,128,128,.85))', marginTop: 2 }}>
          {props.desc}
        </span>
      </span>
      <span style={{ flexShrink: 0 }}>{props.children}</span>
    </div>
  )
}

/** 主题小卡片：单选——点击整体即选中该题材。 */
function ThemeCard(props: {
  theme: ThemeCatalogEntry
  enabled: boolean
  onToggle: (next: boolean) => void
}) {
  const { theme, enabled } = props
  return (
    <div
      style={{
        border: `1px solid ${enabled ? 'var(--accent, #4b8bff)' : 'var(--separator, rgba(128,128,128,.25))'}`,
        borderRadius: 10,
        background: enabled ? 'color-mix(in srgb, var(--accent, #4b8bff) 8%, transparent)' : 'transparent',
        padding: 10,
        minWidth: 0,
      }}
    >
      <button
        type="button"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          width: '100%',
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          font: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          padding: 0,
          opacity: enabled ? 1 : 0.55,
        }}
        aria-pressed={enabled}
        onClick={() => { props.onToggle(!enabled) }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              borderRadius: 8,
              background: 'rgba(128,128,128,.12)',
              fontSize: 14,
            }}
          >
            {THEME_ICONS[theme.id] ?? '✨'}
          </span>
          <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {theme.name}
          </span>
          {enabled
            ? <span style={{ marginLeft: 'auto', display: 'inline-flex' }}><IconCheckOutline16 size={12} /></span>
            : null}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-weak, rgba(128,128,128,.85))' }}>{theme.id}</span>
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  intro: { fontSize: 12, color: 'var(--text-weak, rgba(128,128,128,.85))', margin: '0 0 14px' },
  groupHeading: { fontSize: 13, fontWeight: 600, margin: '18px 0 8px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 },
  error: { fontSize: 12, color: '#e5484d', marginTop: 10 },
  suffix: { fontSize: 12, color: 'var(--text-weak, rgba(128,128,128,.85))', marginLeft: 6 },
}

/**
 * 渲染“奇遇设置”页。数据来自宿主自有路由；乐观更新 + 修订号守卫提交，
 * 失败回滚并内联报错。
 */
export function SerendipitySettingsSection(_props: SerendipitySettingsSectionProps): ReactNode {
  const [view, setView] = useState<{ value?: unknown; revision?: number } | null>(null)
  const [catalog, setCatalog] = useState<ThemeCatalogEntry[]>([])
  const [profile, setProfile] = useState<ProfileView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [customHint, setCustomHint] = useState(false)
  const optimisticRef = useRef<{ value?: unknown; revision?: number }>({})
  const revisionRef = useRef<number | undefined>(undefined)
  const inFlightRef = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    let cancelled = false
    void Promise.all([api.settingsGet(), api.settingsCatalog(), api.profileGet()]).then(([settings, cat, prof]) => {
      if (cancelled) return
      revisionRef.current = settings.revision
      setView(settings)
      setCatalog(cat.themes)
      setProfile(prof)
      // 单选模式迁移：theme 未设置且旧配置不是恰好一个主题启用时，自动归一为第一个启用主题。
      const initial = viewOf(settings.value)
      const enabledThemes = cat.themes.filter(theme => !initial.disabledThemes.includes(theme.id))
      if (initial.theme === '' && cat.themes.length > 0 && enabledThemes.length !== 1) {
        commit({ theme: (enabledThemes[0] ?? cat.themes[0]!).id })
      }
    }).catch((caught: unknown) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught))
    })
    return () => { cancelled = true }
  }, [])

  const config = viewOf(view?.value)

  /** 单选模式当前选中的题材 id（theme 非空以它为准；否则兼容旧的 disabledThemes 单选状态）。 */
  const enabledByDisabled = catalog.filter(theme => !config.disabledThemes.includes(theme.id))
  const selectedThemeId = config.theme !== '' ? config.theme : (enabledByDisabled.length === 1 ? enabledByDisabled[0]!.id : '')

  /** 乐观应用一个补丁，然后串行提交（修订号守卫，失败回滚）。 */
  const commit = (patch: Record<string, unknown>): void => {
    const previous = optimisticRef.current
    const next = { ...previous, value: { ...viewOf(previous.value), ...patch } }
    optimisticRef.current = next
    setView(next)
    setError(null)
    const run = inFlightRef.current.then(async () => {
      const fresh = await api.settingsUpdate(patch, revisionRef.current)
      revisionRef.current = fresh.revision
      optimisticRef.current = fresh
      return fresh
    })
    inFlightRef.current = run.then(() => undefined, () => undefined)
    void run.then(
      (fresh) => { setView(fresh) },
      (caught: unknown) => {
        setView(previous)
        optimisticRef.current = previous
        setError(caught instanceof Error ? caught.message : String(caught))
      },
    )
  }

  const toggleEnabled = (next: boolean): void => { commit({ enabled: next }) }
  const commitNumber = (key: string, raw: string, clamp: (value: number) => number): void => {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    commit({ [key]: clamp(parsed) })
  }
  const commitPercent = (raw: string): void => {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    commit({ triggerChance: Math.min(100, Math.max(0, parsed)) / 100 })
  }
  const commitText = (key: string, raw: string): void => {
    const trimmed = raw.trim()
    if (trimmed === '') return
    commit({ [key]: trimmed })
  }

  /** 单选主题：选定一个题材（写入 theme 字段，其余题材全部不参与抽取）。 */
  const selectTheme = (id: string): void => {
    if (selectedThemeId === id) return
    commit({ theme: id })
  }

  /** 重新拉取角色档案（奇遇在对话中触发，设置页需手动刷新）。 */
  const refreshProfile = (): void => {
    void api.profileGet().then(setProfile).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : String(caught))
    })
  }

  return (
    <div>
      <p style={styles.intro}>工作奇遇的触发参数与主题开关；修改即时写入设置文档，宿主实时生效。</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 0 8px' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>角色档案</span>
        <button
          type="button"
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--accent, #4b8bff)',
            cursor: 'pointer',
            fontSize: 12,
            padding: '2px 6px',
          }}
          onClick={refreshProfile}
        >
          刷新
        </button>
      </div>
      {profile === null
        ? <p style={styles.intro}>档案加载中…</p>
        : profile.started
          ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{profile.name}（{profile.profileId}）</span>
              <span style={{ fontSize: 12, color: 'var(--text-weak, rgba(128,128,128,.85))' }}>
                等级 {profile.level} · 经验 {profile.exp}/{profile.expToNext} · 累计奇遇 {profile.totalAdventures} 次
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginTop: 8 }}>
                {profile.attributes.map(attribute => (
                  <div
                    key={attribute.id}
                    style={{ border: '1px solid var(--separator, rgba(128,128,128,.2))', borderRadius: 8, padding: '6px 8px' }}
                  >
                    <span style={{ fontSize: 12 }}>{attribute.label}</span>
                    <span style={{ float: 'right', fontSize: 12, fontWeight: 600 }}>{attribute.value}</span>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(128,128,128,.2)', marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, attribute.value))}%`, background: 'var(--accent, #4b8bff)' }} />
                    </div>
                  </div>
                ))}
              </div>
              {profile.recentAdventures.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-weak, rgba(128,128,128,.85))' }}>最近奇遇</span>
                  {profile.recentAdventures.map((record, index) => (
                    <div
                      key={index}
                      style={{ fontSize: 12, padding: '5px 0', borderTop: '1px solid var(--separator, rgba(128,128,128,.12))' }}
                    >
                      <span>[{record.tier === undefined ? '' : `${record.tier}·`}{record.theme}] {record.title}</span>
                      <span style={{ color: 'var(--text-weak, rgba(128,128,128,.85))' }}>
                        （{record.effectsText}，经验 +{record.exp}） · {new Date(record.time).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
          : (
            <p style={styles.intro}>角色尚未开启养成：完成几轮对话、触发第一次奇遇后，这里会展示等级、属性与奇遇记录。</p>
          )}

      <div style={styles.groupHeading}>通用</div>
      <Row title="开启奇遇" desc="关闭后不再触发任何奇遇（属性保留）。">
        <Switch label="开启奇遇" checked={config.enabled} onChange={toggleEnabled} />
      </Row>
      <Row title="触发概率" desc="每次完成一轮用户对话后触发奇遇的概率。">
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <Input
            type="number"
            style={{ width: 90 }}
            min={0}
            max={100}
            step={5}
            aria-label="触发概率"
            value={String(Math.round(config.triggerChance * 100))}
            onChange={event => { commitPercent(event.currentTarget.value) }}
          />
          <span style={styles.suffix}>%</span>
        </span>
      </Row>
      <Row title="冷却轮数" desc="两次奇遇之间最少间隔的用户对话轮数。">
        <Input
          type="number"
          style={{ width: 90 }}
          min={1}
          step={1}
          aria-label="冷却轮数"
          value={String(config.cooldownTurns)}
          onChange={event => { commitNumber('cooldownTurns', event.currentTarget.value, value => Math.max(1, Math.round(value))) }}
        />
      </Row>
      <Row title="剧情模式" desc="followup=模型续写故事；inject=只注入上下文；none=只记录。">
        <Input
          style={{ width: 150 }}
          aria-label="剧情模式"
          value={config.narrateMode}
          onChange={event => { commitText('narrateMode', event.currentTarget.value) }}
        />
      </Row>
      <Row title="档案 ID" desc="不同 ID 对应不同角色，跨会话按此持久化。">
        <Input
          style={{ width: 150 }}
          aria-label="档案 ID"
          value={config.profileId}
          onChange={event => { commitText('profileId', event.currentTarget.value) }}
        />
      </Row>
      <Row title="角色名" desc="新档案的默认角色名。">
        <Input
          style={{ width: 150 }}
          aria-label="角色名"
          value={config.characterName}
          onChange={event => { commitText('characterName', event.currentTarget.value) }}
        />
      </Row>
      <Row title="防重复窗口" desc="最近 N 次奇遇内出现过的同主题事件不重复触发（0 = 关闭）。">
        <Input
          type="number"
          style={{ width: 90 }}
          min={0}
          step={1}
          aria-label="防重复窗口"
          value={String(config.noRepeatWindow)}
          onChange={event => { commitNumber('noRepeatWindow', event.currentTarget.value, value => Math.max(0, Math.round(value))) }}
        />
      </Row>
      <Row title="奇遇记录条数" desc="档案中最多保留的最近奇遇记录条数。">
        <Input
          type="number"
          style={{ width: 90 }}
          min={1}
          step={1}
          aria-label="奇遇记录条数"
          value={String(config.maxAdventureLog)}
          onChange={event => { commitNumber('maxAdventureLog', event.currentTarget.value, value => Math.max(1, Math.round(value))) }}
        />
      </Row>

      <div style={styles.groupHeading}>
        主题 <span style={{ color: 'var(--text-weak, rgba(128,128,128,.85))', fontWeight: 400 }}>（{catalog.length}，单选）</span>
      </div>
      {catalog.length > 0
        ? (
          <div style={styles.grid}>
            {catalog.map(theme => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                enabled={selectedThemeId === theme.id}
                onToggle={() => { selectTheme(theme.id) }}
              />
            ))}
            <ThemeCard
              key="custom"
              theme={CUSTOM_THEME_CARD}
              enabled={false}
              onToggle={() => { setCustomHint(true) }}
            />
          </div>
        )
        : <p style={styles.intro}>主题目录加载中…</p>}
      {customHint && (
        <p style={styles.intro}>自定义题材即将支持：后续可在入口配置（extraThemes / extraEvents）中添加主题与事件。</p>
      )}

      {error !== null && <p style={styles.error} role="alert">{error}</p>}
    </div>
  )
}
