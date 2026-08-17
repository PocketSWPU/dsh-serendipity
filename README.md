# 工作奇遇（@pocket30/dsh-serendipity）

一个 DeepSeek Harness（dsh）插件：把**用户本人当作主角**来养成。

每次你完成一轮对话，插件都有一定概率触发一次**随机奇遇**。奇遇来自不同主题
（科幻、玄幻、远古、动漫、小说、武侠、都市…），每个主题下都有大量事件，
每个事件会对主角的**力量 / 智力 / 敏捷 / 魅力 / 幸运 / 体魄**等属性产生
不同程度的影响（有增益、有代价、有权衡），并积累经验、升级等级。
属性会持久化，跨会话、跨重启持续养成，并反过来影响你与模型的后续对话走向。

插件还会在 dsh 设置页注册一个**“奇遇设置”页**（参照 DSH-better-sidebar 的
“侧边卡片”交互）：通用参数开关行 + 主题小卡片网格（点击即开关，齿轮弹窗调
二级设置），修改即时生效（写回 `$DSH_HOME/settings.yaml` 的 `serendipity:` 小节）。

---

## 功能一览

- 对话结束自动触发：监听 `turn/end`，只统计**由你发起**的对话轮，插件自己
  注入的剧情轮不会重复触发（不会无限套娃）。
- 概率与冷却：触发概率、两次奇遇之间的最小用户对话轮数均可配置。
- 主题 + 事件库：内置 7 大主题、40+ 事件，支持追加事件/主题、禁用主题；
  题材**单选**（设置页点选一个题材后，奇遇只在该题材内触发，不再跨题材跳转；
  事件权重、主题权重仍可在编排级配置中调整）。
- 属性养成：属性增减带区间夹取（0~100），经验积累自动升级。
- 剧情注入：默认 `followup` 模式，触发后让模型以主角视角把奇遇续写成故事，
  并在对话中交代属性变化。
- 状态可见：设置页「角色档案」分组直接展示等级/经验/六维属性/最近奇遇（可手动刷新）；
  模型也可通过 `serendipity_status` / `serendipity_reset` 工具查看/重置角色档案。
- 设置页可视化配置：dsh 设置 → “奇遇设置”，编辑后实时生效。
- 跨会话持久化：优先使用 storage domain（web 组合自带），重启后角色不丢；
  无 storage 的组合自动降级为进程内内存并告警。

## 安装

### 方式一：npm 包（推荐，含设置页卡片）

发布到 npm 后：

```sh
npx @deepseek-ai/dsh plugin --profile web add @pocket30/dsh-serendipity
```

本仓库内也可直接用打包产物安装：

```sh
dsh plugin --profile web add ./pocket30-dsh-serendipity-0.5.1.tgz
# 或直接安装源码目录（已构建好、依赖齐全）
dsh plugin --profile web add ./dsh-serendipity
```

装完重启 `dsh web`。**设置页卡片依赖 package 安装**（dsh 客户端模块系统
只扫描可解析的包入口，`--patch` 的 file:// 入口只加载宿主逻辑）。

### 方式二：开发模式 `--patch` overlay（仅宿主功能）

```sh
cd dsh-serendipity
npm run build
dsh --profile web --patch ./examples/web-overlay.cordis.yml
```

`examples/web-overlay.cordis.yml` 里给了一组高概率配置便于体验
（触发概率 80%、冷却 1 轮），插件路径是 file:// URL，目录不同时改一下即可。
注意：file:// 入口只加载宿主逻辑（含 /serendipity/api 设置路由），设置页
UI 需要 package 安装。

## 奇遇设置（设置页）

安装后打开 dsh 设置页，导航里会出现 **“奇遇设置”** 页（参照 DSH-better-sidebar
的“侧边卡片”交互）：

- **角色档案** 分组：主角的等级、经验进度、六维属性条与最近奇遇记录（新→旧），
  右上角「刷新」按钮重新拉取（奇遇在对话中触发，页面不会自动刷新）。
- **通用** 分组：逐项开关/输入行 —— 开启奇遇（总开关）、触发概率（百分比）、
  冷却轮数、剧情模式、档案 ID、角色名、奇遇记录条数。
- **主题** 分组：每个主题一张小卡片（科幻 🚀 / 玄幻 🐉 / 远古 🏺 / 动漫 ⭐ /
  小说 📖 / 武侠 ⚔️ / 都市 🏙️ 等），**单选**——点击卡片即选定该题材，其余题材
  自动关闭（避免多题材间跳转、破坏沉浸感）。末尾预留一张「自定义题材」占位卡片
  （敬请期待，后续经 `extraThemes` / `extraEvents` 配置添加）。

所有修改乐观更新并即时写入用户设置层（`$DSH_HOME/settings.yaml` 的
`serendipity:` 小节），带修订号守卫；失败自动回滚并内联报错。

> 实现说明：dsh 官方设置 RPC 只把白名单命名空间暴露给浏览器，第三方命名
> 空间不会下发。因此本插件的设置页走**插件自有路由**（`/serendipity/api`，
> 带与 /api 一致的信任围栏），宿主在进程内调用 settings 服务读写。
> 「角色档案」分组同样走该自有路由（`profile.get`），宿主从 storage domain
> 读取档案后返回等级/属性/最近奇遇视图。

> 主题事件目录（`extraThemes` / `extraEvents`）属于编排级配置，仍在
> `cordis.patch.yml` 的 `config` 里维护，见下文。

## 配置项

在 profile 的 `cordis.patch.yml` 或 `--patch` overlay 里按行覆盖：

```yaml
- insert:
    - id: serendipity
      name: '@pocket30/dsh-serendipity'
      config:
        enabled: true            # 奇遇总开关
        triggerChance: 0.25      # 每次完成一轮用户对话的触发概率（0~1）
        cooldownTurns: 3         # 两次奇遇之间最少间隔的用户对话轮数（>=1）
        narrateMode: followup    # followup | inject | none
        theme: ''                # 单选主题：非空时只从该主题抽事件（'' = 按 disabledThemes 多选）
        profileId: default       # 档案 id，不同 id = 不同角色
        characterName: 无名主角  # 新角色的默认名字
        enableTools: true        # 是否注册 serendipity_* 工具（组合层配置）
        maxAdventureLog: 20      # 档案中保留的奇遇记录条数
```

设置页可改的字段会覆盖入口配置（设置层 > 组合层 > schema 默认值）。

### 自定义主题 / 事件示例

```yaml
config:
  extraThemes:
    detective:
      name: 侦探
      description: 谜案、线索与推理。
      weight: 1
      events:
        - id: locked-room
          title: 密室谜案
          description: 一桩看似不可能的密室案件摆在你面前，唯一的钥匙孔上留着淡淡的蜡痕。
          effects:
            intelligence: 6
            luck: -1
          exp: 15
          weight: 1
  extraEvents:
    xianxia:
      - id: my-custom-event
        title: 自定义事件
        description: 你自己的奇遇。
        effects:
          strength: 3
        exp: 10
        weight: 1
  disabledThemes:
    - urban
```

事件字段：`id`、`title`、`description`、`effects`（属性 id → 增减值）、
`exp`（经验）、`minLevel`（可选，最低等级）、`weight`（权重）。
属性 id：`strength` / `intelligence` / `agility` / `charisma` / `luck` / `vitality`。

## 模型可用工具

- `serendipity_status`：查看角色档案（等级、经验、六维属性、最近奇遇）。
- `serendipity_reset(confirm: true, name?)`：开启一份全新角色档案（需显式确认）。

## 工作原理

```mermaid
flowchart LR
  A[用户消息] --> B[agent 完成一轮 turn/end]
  B --> C{用户轮?}
  C -- 否 --> Z[忽略]
  C -- 是 --> D{间隔 >= cooldownTurns?}
  D -- 否 --> Z
  D -- 是 --> E{random < triggerChance?}
  E -- 否 --> Z
  E -- 是 --> F[按权重选主题 → 选事件]
  F --> G[结算属性/经验/等级]
  G --> H[持久化档案 storage domain]
  H --> I[followup 注入剧情]
  I --> J[模型以主角视角续写奇遇]
```

触发判定完全由**会话日志推导**（`source.kind === 'user'` 的轮次才算用户轮，
插件注入轮次的 `source.kind === 'plugin'` 不算），因此不会自我循环触发。

设置链路：

```mermaid
flowchart LR
  A[设置页 · 奇遇设置] -->|POST /serendipity/api| B[插件自有路由]
  B --> C[宿主 settings 服务（进程内）]
  C --> D[$DSH_HOME/settings.yaml 的 serendipity 小节]
  D --> E[宿主插件实时重读配置]
```

## 目录结构

```text
@pocket30/dsh-serendipity/
├── src/
│   ├── index.ts         # 宿主插件入口：name / Config / apply
│   ├── config.ts        # 配置 schema + 主题目录合并
│   ├── attributes.ts    # 属性目录（六维）
│   ├── themes.ts        # 内置主题与事件库
│   ├── engine.ts        # 抽奖/结算/升级（纯函数，可注入随机源）
│   ├── profile.ts       # 角色档案模型（zod schema）
│   ├── store.ts         # 持久化：storage domain + 内存降级
│   ├── settings.ts      # 设置命名空间注册（serendipity）+ 读写面
│   ├── routes.ts        # /serendipity/api 路由 + 信任围栏
│   ├── runtime.ts       # turn/end 监听、触发判定、剧情注入
│   ├── tools.ts         # serendipity_status / serendipity_reset
│   └── client/          # 浏览器端：奇遇设置页
│       ├── index.ts     #   浏览器插件入口（slots + 注册设置页）
│       ├── api.ts       #   自有路由的 fetch 封装
│       └── section.tsx  #   设置页（角色档案 + 开关行 + 主题卡片 + 齿轮弹窗）
├── tests/               # vitest 单元测试（11 个）
├── examples/            # 本地开发 overlay（仅宿主）
├── tsdown.config.ts     # 客户端 bundle 构建
├── cordis.patch.yml     # bundle 层
└── package.json
```

## 开发

```sh
pnpm install
npm run build   # 宿主 tsc + 客户端类型检查 + tsdown 浏览器 bundle
npm test        # vitest 单测
```

## 发布到 npm

包名是 `@pocket30/dsh-serendipity`（scope 私有），发布时需要 scope 公开：

```sh
npm login --scope=@pocket30
npm publish --access public
```

发布成功后，用户即可用
`npx @deepseek-ai/dsh plugin --profile web add @pocket30/dsh-serendipity`
安装。`prepack` 会自动执行构建（宿主 + 客户端 bundle），tarball 内含
`dist/` 与 `lib/client.js`。

### 发版后流程（每次更新版本号后必须完整执行）

```sh
npm publish --access public          # 1. 上传 npm（prepack 自动构建）
dsh plugin --profile web add "@pocket30/dsh-serendipity@0.5.1"   # 2. 本地 profile 拉取最新版本
# 3. 重启 dsh web：杀掉监听 3080 的进程后重新 `dsh web`，浏览器硬刷新
```

> 注意：本地更新必须带**显式版本号** `add "@pocket30/dsh-serendipity@<版本>"`；
> 无版本号的 `add` 在已有 `^0.x` 范围时只会报 "Already up to date"，`update`
> 也不会跨 `^0.x` minor 拉新版。

## 已知限制

- 依赖 `@deepseek-ai/*` 的 0.1.0-rc.6 家族版本，与 dsh CLI 0.1.0-rc.6 对齐；
  若宿主版本差异过大，请同步升级本插件依赖后重新构建。
- 设置页 UI 依赖 package 安装；`--patch` 的 file:// 入口只加载宿主逻辑
  （含 /serendipity/api 路由，可用 HTTP 直接调用验证）。
- `narrateMode: none` 时，冷却标记只存在于进程内存中，重启后可能立刻再触发一次。
- 跨会话持久化依赖 storage domain（`dsh web` 自带）；纯 headless/TUI 组合会降级为
  内存存储并打印一条告警。

## License

MIT
