/**
 * 主题与事件库：工作奇遇的随机事件内容。
 *
 * 主题覆盖科幻、玄幻、远古、动漫、小说、武侠、都市等方向；
 * 每个事件对主角属性有不同程度的影响（可能是正面、负面或权衡）。
 * 事件按 `minLevel` 划分层级（日常/冒险/史诗/传奇）：等级越高，
 * 越能解锁更宏大的事件；带 `branches` 的事件会根据主角属性值
 * 命中不同的分支线（力量流 / 智力流 / 魅力流……）。
 * 本模块是纯数据，可通过插件配置追加主题、追加事件或调整权重。
 */

/** 分支命中条件：按主角当前属性值决定走哪条分支线。 */
export type EventBranchCondition =
  /** 该属性 >= min 时命中。 */
  | { readonly attribute: string; readonly min: number }
  /** 该属性 <= max 时命中。 */
  | { readonly attribute: string; readonly max: number }
  /** 该属性是六维最高（并列也算）时命中。 */
  | { readonly attribute: string; readonly highest: true }
  /** 该属性是六维最低（并列也算）时命中。 */
  | { readonly attribute: string; readonly lowest: true }
  /** 无条件命中（兜底分支，应放在最后）。 */
  | { readonly always: true }

/** 事件分支线：命中条件 + 专属的标题/描述/属性变化/经验。 */
export interface EventBranch {
  /** 分支在事件内的唯一 id。 */
  readonly id: string
  /** 分支标题（命中后取代事件原标题）。 */
  readonly title: string
  /** 分支描述（命中后取代事件原描述）。 */
  readonly description: string
  /** 分支属性变化：attributeId -> delta。 */
  readonly effects: Readonly<Record<string, number>>
  /** 分支经验（可选，缺省用事件 exp）。 */
  readonly exp?: number
  /** 命中条件。 */
  readonly when: EventBranchCondition
}

/** 事件层级：按 minLevel 划分，等级越高解锁越宏大的事件。 */
export interface EventTier {
  /** 稳定 id。 */
  readonly id: string
  /** 展示名。 */
  readonly label: string
  /** 解锁所需的最低等级。 */
  readonly minLevel: number
  /** 一句话说明层级气质。 */
  readonly description: string
}

/** 内置事件层级（minLevel 越高，事件越宏大）。 */
export const EVENT_TIERS: readonly EventTier[] = [
  {
    id: 'daily',
    label: '日常',
    minLevel: 1,
    description: '平凡日常里的小机缘与小麻烦，细水长流地塑造角色。',
  },
  {
    id: 'quest',
    label: '冒险',
    minLevel: 2,
    description: '小有规模的际遇，考验你的选择与判断。',
  },
  {
    id: 'epic',
    label: '史诗',
    minLevel: 4,
    description: '足以改变格局的宏大事件，风险与收益并存。',
  },
  {
    id: 'legendary',
    label: '传奇',
    minLevel: 7,
    description: '传说级别的机缘与劫难，只有真正的强者才能驾驭。',
  },
]

/** 依据事件的 minLevel 推导其所属层级（无 minLevel 视为日常）。 */
export function eventTierOf(event: { readonly minLevel?: number }): EventTier {
  const minLevel = event.minLevel ?? 1
  let tier = EVENT_TIERS[0]!
  for (const candidate of EVENT_TIERS) {
    if (minLevel >= candidate.minLevel) tier = candidate
  }
  return tier
}

/** 依据角色当前等级返回可解锁的最高层级。 */
export function tierByLevel(level: number): EventTier {
  let tier = EVENT_TIERS[0]!
  for (const candidate of EVENT_TIERS) {
    if (level >= candidate.minLevel) tier = candidate
  }
  return tier
}

/** 层级 id -> 展示名；未知 id 返回 undefined。 */
export function tierLabel(tierId: string | undefined): string | undefined {
  if (tierId === undefined) return undefined
  return EVENT_TIERS.find((tier) => tier.id === tierId)?.label
}

export interface AdventureEvent {
  /** 事件在主题内的唯一 id。 */
  readonly id: string
  /** 事件标题。 */
  readonly title: string
  /** 事件描述（给模型渲染成故事用的素材）。 */
  readonly description: string
  /** 属性变化：attributeId -> delta。 */
  readonly effects: Readonly<Record<string, number>>
  /** 获得的经验值。 */
  readonly exp: number
  /** 触发所需的最低等级（可选，也决定事件层级）。 */
  readonly minLevel?: number
  /** 相对权重，越大越容易被抽中。 */
  readonly weight: number
  /** 属性分支线（可选）：按主角属性值命中不同走向。 */
  readonly branches?: readonly EventBranch[]
}

export interface ThemeDef {
  /** 主题 id。 */
  readonly id: string
  /** 主题展示名。 */
  readonly name: string
  /** 主题一句话介绍。 */
  readonly description: string
  /** 该主题被抽中的相对权重。 */
  readonly weight: number
  /** 该主题下的事件列表。 */
  readonly events: readonly AdventureEvent[]
}

/** 内置主题（默认权重都为 1，可在配置里覆盖）。 */
export const DEFAULT_THEMES: readonly ThemeDef[] = [
  {
    id: 'sci-fi',
    name: '科幻',
    description: '星舰、智械与未知信号，理性与危机并存。',
    weight: 1,
    events: [
      {
        id: 'derelict-signal',
        title: '废弃星舰的求救信号',
        description: '你在巡航途中截获一段来自废弃星舰的加密信号，舰桥残骸里一台老旧的终端机仍在一遍遍重复同一组坐标。',
        effects: { intelligence: 4, luck: 2 },
        exp: 12,
        weight: 1,
      },
      {
        id: 'nanite-cloud',
        title: '吞噬合金的纳米云',
        description: '维修通道里涌出一团灰白色的纳米云，金属地板在它经过后迅速锈蚀剥落。你必须在它封死舱门之前做出选择。',
        effects: { agility: 5, vitality: -2 },
        exp: 14,
        weight: 1,
      },
      {
        id: 'orphan-ai',
        title: '被遗弃的舱载 AI',
        description: '一台拥有孩童语气的舱载 AI 请求你带它离开这艘即将报废的飞船，作为交换，它愿意分享三十年来的航行日志。',
        effects: { intelligence: 3, charisma: 3 },
        exp: 12,
        weight: 1,
      },
      {
        id: 'gravity-well',
        title: '扭曲引力的重力井',
        description: '前方航线出现异常重力井，仪表盘疯狂报警。如果能稳住船体穿过井壁，或许能抄近道抵达目的地。',
        effects: { agility: 4, luck: 3 },
        exp: 13,
        minLevel: 2,
        weight: 1,
      },
      {
        id: 'augment-booth',
        title: '黑市义体改造间',
        description: '霓虹深处的义体改造间承诺给你装上最新的神经加速器，代价是一笔不菲的信用点——以及一点点运气。',
        effects: { agility: 6, luck: -3 },
        exp: 15,
        minLevel: 3,
        weight: 1,
      },
      {
        id: 'first-contact',
        title: '第一次接触',
        description: '一个无法用任何已知语言交流的外星信号突然占据所有频道，对方似乎在模仿你的思维模式，等待你的回应。',
        effects: { intelligence: 5, charisma: 4 },
        exp: 18,
        minLevel: 4,
        weight: 1,
      },
      {
        id: 'dyson-halo',
        title: '戴森球之环',
        description: '你所在的星域被一座环绕恒星的巨构建筑遮住了半边天空，建造者的后裔在光环边缘向你发出信号——他们需要一位外来者裁决一场延续千年的继承之争。',
        effects: { charisma: 3, intelligence: 3 },
        exp: 24,
        minLevel: 6,
        weight: 1,
        branches: [
          {
            id: 'strength',
            title: '以力定序',
            description: '你亲自踏入能源核心，用肉身硬抗恒星风暴，让两支继承派系见识了什么叫做绝对实力。',
            effects: { strength: 8, vitality: 5 },
            exp: 28,
            when: { attribute: 'strength', highest: true },
          },
          {
            id: 'intelligence',
            title: '以智裁决',
            description: '你翻遍巨构的日志与法典，用一条被遗忘的古老律令平息了争端，还赢得了建造者后裔的敬意。',
            effects: { intelligence: 8, luck: 4 },
            exp: 28,
            when: { attribute: 'intelligence', highest: true },
          },
          {
            id: 'charisma',
            title: '以诚服众',
            description: '你没有偏向任何一方，而是让两支派系在谈判桌前握手言和，你的名字从此刻进了巨构的墙壁。',
            effects: { charisma: 8, strength: 3 },
            exp: 27,
            when: { attribute: 'charisma', highest: true },
          },
          {
            id: 'fate',
            title: '顺势而为',
            description: '你既没站队也没裁决，只是恰好出现在最关键的时刻，让一场危机消弭于无形。',
            effects: { agility: 6, luck: 6 },
            exp: 26,
            when: { always: true },
          },
        ],
      },
      {
        id: 'galaxy-forge',
        title: '银河锻造炉',
        description: '传说中能重铸星辰的银河锻造炉在废弃星云深处重新点火，炉火映亮了半个星域。锻造炉的看守者说，只有能承受恒星之重的人，才有资格带走一件造物。',
        effects: { luck: 2, vitality: 4 },
        exp: 34,
        minLevel: 9,
        weight: 1,
        branches: [
          {
            id: 'strength',
            title: '身负星辰',
            description: '你以血肉之躯扛起锻造炉的核心锻锤，每一次落锤都让星云震荡，最终锻造出一柄以你的名字命名的星之武器。',
            effects: { strength: 12, vitality: 8 },
            exp: 40,
            when: { attribute: 'strength', highest: true },
          },
          {
            id: 'intelligence',
            title: '洞悉炉心',
            description: '你看穿了锻造炉的古老算法，用一段自创的星语与炉心共鸣，重铸出一件能改写航线命运的导航秘宝。',
            effects: { intelligence: 12, luck: 6 },
            exp: 40,
            when: { attribute: 'intelligence', highest: true },
          },
          {
            id: 'charisma',
            title: '驯服炉灵',
            description: '你与看守者背后的炉灵缔结了契约，让它自愿为你锻造——它说已经很久没有遇到值得托付的匠主。',
            effects: { charisma: 10, strength: 5 },
            exp: 38,
            when: { attribute: 'charisma', highest: true },
          },
          {
            id: 'fate',
            title: '炉火余烬',
            description: '你没有贪图炉中的宝物，只取走了一捧余烬。这捧余烬此后总在最危急的时刻悄然发亮。',
            effects: { luck: 10, agility: 6 },
            exp: 36,
            when: { always: true },
          },
        ],
      },
    ],
  },
  {
    id: 'xianxia',
    name: '玄幻',
    description: '灵气、秘境与因果，一念可登天，一念可坠渊。',
    weight: 1,
    events: [
      {
        id: 'fox-spirit-temple',
        title: '灵狐引路',
        description: '深山古道上，一只通体雪白的灵狐在云雾缭绕的破庙前驻足回望，似乎想引你进入一处尘封已久的秘境。',
        effects: { luck: 5, intelligence: 2 },
        exp: 12,
        weight: 1,
      },
      {
        id: 'stone-heritage',
        title: '传承石碑',
        description: '断崖下立着一块布满裂纹的石碑，碑文记载着一门失传的功法。你凝神参悟，识海深处传来一声轻叹。',
        effects: { intelligence: 5, vitality: 2 },
        exp: 14,
        weight: 1,
      },
      {
        id: 'thunder-refining',
        title: '天雷淬体',
        description: '渡劫雷云不期而至，第一道天雷已锁定你的位置。若能扛过去，肉身将脱胎换骨。',
        effects: { vitality: 6, strength: 3 },
        exp: 16,
        minLevel: 2,
        weight: 1,
      },
      {
        id: 'karmic-debt',
        title: '前世因果',
        description: '一位邋遢老道拦住你，说你上辈子欠他三枚灵石。你苦笑之余，忽然觉得体内灵力多了一缕熟悉的气息。',
        effects: { luck: -3, intelligence: 4 },
        exp: 11,
        weight: 1,
      },
      {
        id: 'spirit-herb',
        title: '万年灵草',
        description: '悬崖缝隙里长着一株万年灵草，守护它的是一条垂老的蛟龙。蛟龙没有攻击，只是用浑浊的眼睛静静看着你。',
        effects: { vitality: 4, charisma: 3 },
        exp: 15,
        minLevel: 3,
        weight: 1,
      },
      {
        id: 'sealed-demon',
        title: '封印松动',
        description: '你路过的镇子底下封印着一尊古魔，封印符文正在暗淡。镇民们把你当成了最后希望，眼神里满是恳求。',
        effects: { strength: 6, charisma: 3 },
        exp: 18,
        minLevel: 4,
        weight: 1,
      },
      {
        id: 'heavenly-realm',
        title: '天界试炼',
        description: '一道天门在你面前缓缓开启，守门天将奉仙帝之命设下三重试炼，通过者可入天界悟道三日。',
        effects: { intelligence: 3, vitality: 3 },
        exp: 24,
        minLevel: 6,
        weight: 1,
        branches: [
          {
            id: 'strength',
            title: '力撼天门',
            description: '你以肉身硬撼天将的仙兵，一拳碎其护体仙光，天界的大门为你轰然洞开。',
            effects: { strength: 8, vitality: 5 },
            exp: 28,
            when: { attribute: 'strength', highest: true },
          },
          {
            id: 'intelligence',
            title: '智破仙阵',
            description: '你看穿了试炼阵法的运转规律，以凡人之躯反客为主，让天将叹为观止。',
            effects: { intelligence: 8, luck: 4 },
            exp: 28,
            when: { attribute: 'intelligence', highest: true },
          },
          {
            id: 'charisma',
            title: '以诚动天',
            description: '你没有闯关，而是与天将把酒言和。天将说天界缺的正是你这样能交心的道友。',
            effects: { charisma: 8, intelligence: 4 },
            exp: 27,
            when: { attribute: 'charisma', highest: true },
          },
          {
            id: 'fate',
            title: '机缘入界',
            description: '试炼进行到一半，天界恰好降下万年一遇的祥瑞，你顺水推舟踏入天界。',
            effects: { luck: 7, agility: 5 },
            exp: 26,
            when: { always: true },
          },
        ],
      },
      {
        id: 'dao-ascension',
        title: '大道之问',
        description: '一位自称来自上界的仙人向你发问：「何为大道？」回答将决定你此生修行的高度。',
        effects: { luck: 2, charisma: 2 },
        exp: 34,
        minLevel: 9,
        weight: 1,
        branches: [
          {
            id: 'strength',
            title: '我即是道',
            description: '你答：「我身所在，即为大道。」仙人沉默良久，赞你走出了一条以力证道的路。',
            effects: { strength: 12, vitality: 7 },
            exp: 40,
            when: { attribute: 'strength', highest: true },
          },
          {
            id: 'intelligence',
            title: '道法自然',
            description: '你以三千世界的因果推演作答，让仙人都从中悟到新的境界。',
            effects: { intelligence: 12, luck: 6 },
            exp: 40,
            when: { attribute: 'intelligence', highest: true },
          },
          {
            id: 'charisma',
            title: '众生皆道',
            description: '你答：「众生皆可问道。」仙人动容，说这是他在上界都未曾听到过的答案。',
            effects: { charisma: 11, vitality: 5 },
            exp: 39,
            when: { attribute: 'charisma', highest: true },
          },
          {
            id: 'fate',
            title: '道之留白',
            description: '你答：「大道无言。」仙人抚掌而笑，赠你一枚可改一次命数的因果符。',
            effects: { luck: 11, agility: 6 },
            exp: 38,
            when: { always: true },
          },
        ],
      },
    ],
  },
  {
    id: 'ancient',
    name: '远古',
    description: '洪荒、神话与失落文明，时间在这里留下层层叠叠的回声。',
    weight: 1,
    events: [
      {
        id: 'cave-painting',
        title: '洞穴壁画',
        description: '山洞深处的壁画描绘了一场远古狩猎，画中人扛着巨兽的骨角，仿佛在无声邀请你加入这场跨越万年的围猎。',
        effects: { strength: 4, agility: 2 },
        exp: 11,
        weight: 1,
      },
      {
        id: 'ritual-ashes',
        title: '祭坛余烬',
        description: '古祭坛中央的余烬尚未熄灭，石槽里刻满了晦涩的符文。你按照记忆中的传说献上一缕气息，余烬猛地亮起。',
        effects: { luck: 4, intelligence: 3 },
        exp: 13,
        weight: 1,
      },
      {
        id: 'beast-totem',
        title: '兽骨图腾',
        description: '森林深处立着一根巨大的兽骨图腾，图腾上的爪痕深可见骨。附近部落的猎手说，它代表着山神的考验。',
        effects: { strength: 5, vitality: 2 },
        exp: 14,
        minLevel: 2,
        weight: 1,
      },
      {
        id: 'sunken-city',
        title: '沉没之城',
        description: '退潮后的滩涂露出一座沉没古城的尖顶，城门上的海兽浮雕仍睁着碧绿的眼睛，仿佛在辨认来客。',
        effects: { intelligence: 5, agility: -2 },
        exp: 15,
        minLevel: 3,
        weight: 1,
      },
      {
        id: 'elder-wisdom',
        title: '长老的教诲',
        description: '部落最年迈的长老认出你身上的旧伤疤，说那是远古勇士的印记。他教给你几句早已失传的祝福祝词。',
        effects: { charisma: 5, luck: 2 },
        exp: 12,
        weight: 1,
      },
      {
        id: 'dragon-bone',
        title: '龙骨苏醒',
        description: '地脉深处的一截龙骨在你靠近时微微颤动，龙威如潮水般漫过你的身体，也重塑了你的血脉。',
        effects: { vitality: 7, charisma: 2 },
        exp: 18,
        minLevel: 4,
        weight: 1,
      },
      {
        id: 'ancestral-games',
        title: '洪荒擂台',
        description: '远古部落的祖地开启了一场跨越千年的洪荒擂台，胜者将获得祖先留下的神性火种。',
        effects: { strength: 4, agility: 3 },
        exp: 24,
        minLevel: 6,
        weight: 1,
        branches: [
          {
            id: 'strength',
            title: '拳开洪荒',
            description: '你在擂台上连胜九场，最后一拳打碎了擂台中央的神像，火种应声落入你手中。',
            effects: { strength: 9, vitality: 5 },
            exp: 28,
            when: { attribute: 'strength', highest: true },
          },
          {
            id: 'intelligence',
            title: '智取火种',
            description: '你没有硬拼，而是洞悉了擂台规则的漏洞，用一场无人看懂的比试赢下了火种。',
            effects: { intelligence: 8, luck: 5 },
            exp: 28,
            when: { attribute: 'intelligence', highest: true },
          },
          {
            id: 'charisma',
            title: '万灵归心',
            description: '你以言语让各部族化敌为友，火种自愿认你为主——祖先的神性认可了你的胸怀。',
            effects: { charisma: 9, luck: 4 },
            exp: 27,
            when: { attribute: 'charisma', highest: true },
          },
          {
            id: 'fate',
            title: '火种择主',
            description: '你本无意争夺，火种却自行飞到你面前。部落长老说，这是万年以来火种第一次主动择主。',
            effects: { luck: 8, vitality: 5 },
            exp: 26,
            when: { always: true },
          },
        ],
      },
      {
        id: 'primordial-god',
        title: '祖神遗骸',
        description: '你坠入地脉最深处，见到了远古祖神的遗骸——它早已石化，却仍散发着足以扭曲时空的气息。',
        effects: { vitality: 4, luck: 2 },
        exp: 34,
        minLevel: 9,
        weight: 1,
        branches: [
          {
            id: 'strength',
            title: '继承神躯',
            description: '你以凡人之躯吸收祖神残存的力之法则，血脉沸腾，举手投足间已带神威。',
            effects: { strength: 13, vitality: 8 },
            exp: 40,
            when: { attribute: 'strength', highest: true },
          },
          {
            id: 'intelligence',
            title: '解读神忆',
            description: '你以神识触碰祖神遗留的记忆碎片，洞悉了洪荒失落的创世之秘。',
            effects: { intelligence: 13, luck: 6 },
            exp: 40,
            when: { attribute: 'intelligence', highest: true },
          },
          {
            id: 'charisma',
            title: '神性共鸣',
            description: '你没有索取力量，而是为祖神完成了它未了的心愿。石化的遗骸上，竟浮现出一丝欣慰的微笑。',
            effects: { charisma: 11, intelligence: 6 },
            exp: 39,
            when: { attribute: 'charisma', highest: true },
          },
          {
            id: 'fate',
            title: '神恩庇护',
            description: '祖神遗骸化作一道守护印记融入你体内，从此总在你命悬一线时悄然显灵。',
            effects: { luck: 10, vitality: 7 },
            exp: 38,
            when: { always: true },
          },
        ],
      },
    ],
  },
  {
    id: 'anime',
    name: '动漫',
    description: '热血、羁绊与奇迹，画风突变的世界里人人都有主角光环。',
    weight: 1,
    events: [
      {
        id: 'rival-challenge',
        title: '宿敌挑战',
        description: '一个梳着夸张发型的家伙突然拦住你，嘴里喊着“我等这一天很久了”，然后摆出了标准的战斗起手式。',
        effects: { strength: 4, agility: 2 },
        exp: 12,
        weight: 1,
      },
      {
        id: 'school-festival',
        title: '学园祭摊位',
        description: '热闹的学园祭上，一个平时沉默的同学支支吾吾地邀请你帮忙照看女仆咖啡厅的摊位，围观的同学们起哄不断。',
        effects: { charisma: 5, luck: 1 },
        exp: 11,
        weight: 1,
      },
      {
        id: 'mecha-cockpit',
        title: '机甲驾驶舱',
        description: '警报声中，维修仓库里那台尘封的巨型机甲突然亮起驾驶舱灯光，仿佛一直在等待你坐上主驾驶位。',
        effects: { intelligence: 3, strength: 4 },
        exp: 14,
        minLevel: 2,
        weight: 1,
      },
      {
        id: 'friendship-power',
        title: '羁绊之力',
        description: '危急时刻，伙伴们把力量借给了你。你能感到一股温热的力量涌遍全身，连背影都仿佛燃起了光。',
        effects: { charisma: 4, vitality: 3 },
        exp: 13,
        weight: 1,
      },
      {
        id: 'time-loop',
        title: '时间循环',
        description: '你发现自己被困在同一个午后的时间循环里，前几次失败的记忆正慢慢模糊——但这次你记住了关键细节。',
        effects: { intelligence: 6, luck: -2 },
        exp: 16,
        minLevel: 3,
        weight: 1,
      },
      {
        id: 'protagonist-halo',
        title: '主角光环',
        description: '明明已经穷途末路，一道不知从何而来的光却恰好照亮了唯一的生路。围观的人都看呆了。',
        effects: { luck: 6, agility: 2 },
        exp: 15,
        minLevel: 2,
        weight: 1,
      },
      {
        id: 'tournament-arc',
        title: '全国大赛',
        description: '全国大赛的总决赛现场，你的对手是蝉联三届的传奇选手。全场数万人喊的都是他的名字，只有你身边的朋友在喊你的名字。',
        effects: { agility: 3, strength: 3 },
        exp: 24,
        minLevel: 6,
        weight: 1,
        branches: [
          {
            id: 'strength',
            title: '热血决胜',
            description: '你顶着全场嘘声打出绝地反击，最后一球砸穿地板时，整个场馆安静了三秒，然后爆发出你的名字。',
            effects: { strength: 9, agility: 5 },
            exp: 28,
            when: { attribute: 'strength', highest: true },
          },
          {
            id: 'intelligence',
            title: '战术封神',
            description: '你研究透了传奇选手的每一个习惯动作，用一套教科书般的战术让他输得心服口服。',
            effects: { intelligence: 9, agility: 4 },
            exp: 28,
            when: { attribute: 'intelligence', highest: true },
          },
          {
            id: 'charisma',
            title: '羁绊之光',
            description: '你在落后时喊出了队友们的名字，全队气势如虹。传奇选手赛后说，他输给的是一支真正的队伍。',
            effects: { charisma: 9, strength: 5 },
            exp: 27,
            when: { attribute: 'charisma', highest: true },
          },
          {
            id: 'fate',
            title: '奇迹时刻',
            description: '决胜球被篮筐弹起三次后落入网中。裁判反复回看录像，最终判定进球有效——历史会记住这一刻。',
            effects: { luck: 8, agility: 6 },
            exp: 26,
            when: { always: true },
          },
        ],
      },
      {
        id: 'world-arc',
        title: '世界危机',
        description: '天空裂开了一道巨大的缝隙，来自异世界的军团正在涌入。全世界的目光都聚焦在你们这群「被选中的人」身上。',
        effects: { luck: 3, charisma: 2 },
        exp: 34,
        minLevel: 9,
        weight: 1,
        branches: [
          {
            id: 'strength',
            title: '正面击破',
            description: '你化作一道光冲进裂缝，与异界军团的首领正面硬撼，把整个战场打成了你的主场。',
            effects: { strength: 12, vitality: 8 },
            exp: 40,
            when: { attribute: 'strength', highest: true },
          },
          {
            id: 'intelligence',
            title: '釜底抽薪',
            description: '你破解了裂缝的维持法阵，让军团失去了后援。兵不血刃，却比任何战斗都震撼。',
            effects: { intelligence: 12, luck: 6 },
            exp: 40,
            when: { attribute: 'intelligence', highest: true },
          },
          {
            id: 'charisma',
            title: '世界同心',
            description: '你站上废墟高台，向全人类喊话。各国放下了隔阂，把力量汇聚成一道真正的「世界之光」。',
            effects: { charisma: 12, luck: 5 },
            exp: 39,
            when: { attribute: 'charisma', highest: true },
          },
          {
            id: 'fate',
            title: '天选之人',
            description: '裂缝在所有人最绝望的时刻自行崩塌——只有你知道，那是你小时候无意间埋下的一颗「希望的种子」开花了。',
            effects: { luck: 11, agility: 7 },
            exp: 38,
            when: { always: true },
          },
        ],
      },
    ],
  },
  {
    id: 'novel',
    name: '小说',
    description: '书页之间的奇遇：笔下的世界忽然拥有了自己的意志。',
    weight: 1,
    events: [
      {
        id: 'bookshop-whisper',
        title: '旧书店的低语',
        description: '街角旧书店的老板递给你一本没有书名的书，书页翻动时会发出细碎的低语，仿佛在念着与你有关的句子。',
        effects: { intelligence: 5, charisma: 1 },
        exp: 12,
        weight: 1,
      },
      {
        id: 'protagonist-script',
        title: '主角剧本',
        description: '你在废纸堆里捡到一页剧本，主角的名字赫然是你自己。剧本里的下一场戏，恰好是你此刻正在经历的景象。',
        effects: { luck: 5, agility: 2 },
        exp: 13,
        weight: 1,
      },
      {
        id: 'villain-monologue',
        title: '反派独白',
        description: '一个神秘人拦住你，用标准的反派口吻讲述他的计划，最后却说：“给你一个加入我的机会。”',
        effects: { charisma: 3, intelligence: 4 },
        exp: 14,
        minLevel: 2,
        weight: 1,
      },
      {
        id: 'plot-armor',
        title: '剧情护体',
        description: '千钧一发之际，一只飞来的鸽子恰好挡住了射向你的暗器。作者在给你开小灶，你可不能辜负这剧情。',
        effects: { luck: 6, vitality: -1 },
        exp: 15,
        minLevel: 2,
        weight: 1,
      },
      {
        id: 'epilogue-secret',
        title: '终章秘密',
        description: '你在书页夹层里发现一行小字，字迹与全书不同：“终章里活下来的人，才能翻开下一页。”',
        effects: { intelligence: 6, luck: 2 },
        exp: 17,
        minLevel: 3,
        weight: 1,
      },
      {
        id: 'reader-empathy',
        title: '读者共鸣',
        description: '你忽然能听见读者们的心声——他们正为你捏一把汗，也为你的选择争论不休。被期待的感觉让你坚定了许多。',
        effects: { charisma: 5, strength: 2 },
        exp: 13,
        weight: 1,
      },
      {
        id: 'plot-climax',
        title: '高潮章节',
        description: '整本书的剧情在这一刻推向高潮：作者写下了「命运的十字路口」，所有读者都在等你做出抉择。',
        effects: { intelligence: 3, luck: 3 },
        exp: 24,
        minLevel: 6,
        weight: 1,
        branches: [
          {
            id: 'strength',
            title: '掀翻剧本',
            description: '你没有按作者的伏笔行事，而是掀翻了自己这条故事线。作者在后台惊得笔都掉了，读者却沸腾了。',
            effects: { strength: 8, charisma: 5 },
            exp: 28,
            when: { attribute: 'strength', highest: true },
          },
          {
            id: 'intelligence',
            title: '洞悉伏笔',
            description: '你提前识破了全书最大的伏笔，把作者精心埋了二十章的悬念提前引爆，成为读者心中最神的角色。',
            effects: { intelligence: 9, luck: 4 },
            exp: 28,
            when: { attribute: 'intelligence', highest: true },
          },
          {
            id: 'charisma',
            title: '读者之选',
            description: '你在章节末尾向读者发起投票，让他们决定你的命运。这个破次元的操作让全书的热度登顶。',
            effects: { charisma: 9, luck: 4 },
            exp: 27,
            when: { attribute: 'charisma', highest: true },
          },
          {
            id: 'fate',
            title: '神来之笔',
            description: '你随手做的一个小动作，恰好呼应了书里三章前的一句闲笔。作者感叹：这才是真正的「人物活了」。',
            effects: { luck: 8, intelligence: 5 },
            exp: 26,
            when: { always: true },
          },
        ],
      },
      {
        id: 'final-epilogue',
        title: '终章降临',
        description: '作者宣布这是全书的最后一章。所有伏笔、所有人物、所有读者的期待，都要在这一章迎来结局。',
        effects: { luck: 2, vitality: 3 },
        exp: 34,
        minLevel: 9,
        weight: 1,
        branches: [
          {
            id: 'strength',
            title: '史诗结局',
            description: '你与全书最大的反派展开最终决战，用一场足以载入小说史的经典战役为全书画上句号。',
            effects: { strength: 12, vitality: 7 },
            exp: 40,
            when: { attribute: 'strength', highest: true },
          },
          {
            id: 'intelligence',
            title: '真相结局',
            description: '你在最后一章揭开了贯穿全书的世界真相，让所有读者回头重读时恍然大悟——这才是最好的结局。',
            effects: { intelligence: 12, luck: 6 },
            exp: 40,
            when: { attribute: 'intelligence', highest: true },
          },
          {
            id: 'charisma',
            title: '圆满结局',
            description: '你没有选择惊天动地的告别，而是让书中的每个人物都得到了最好的归宿。读者说：这个结局，值了。',
            effects: { charisma: 11, strength: 5 },
            exp: 39,
            when: { attribute: 'charisma', highest: true },
          },
          {
            id: 'fate',
            title: '开放结局',
            description: '最后一页写着一行字：「故事并未结束，它只是翻到了新的一页。」你成了这本书永远的主角。',
            effects: { luck: 10, agility: 6 },
            exp: 38,
            when: { always: true },
          },
        ],
      },
    ],
  },
  {
    id: 'wuxia',
    name: '武侠',
    description: '刀光剑影、恩怨情仇，江湖从来不是讲道理的地方。',
    weight: 1,
    events: [
      {
        id: 'tea-house-duel',
        title: '茶楼论剑',
        description: '茶楼里一位灰衣剑客以茶代酒邀你论剑，围观的江湖人屏息凝神，等着看你如何接招。',
        effects: { agility: 4, charisma: 2 },
        exp: 12,
        weight: 1,
      },
      {
        id: 'secret-manual',
        title: '残缺秘籍',
        description: '雨夜破庙的佛像底下压着一卷残缺的武功秘籍，纸页泛黄，最后几招被人生生撕去。',
        effects: { strength: 5, intelligence: 2 },
        exp: 14,
        weight: 1,
      },
      {
        id: 'beggar-tip',
        title: '丐帮情报',
        description: '一个邋遢乞丐凑过来，说只要请他一顿酒，就告诉你一个天大的秘密——关于你身上那件旧物的来历。',
        effects: { luck: 4, charisma: 2 },
        exp: 11,
        weight: 1,
      },
      {
        id: 'poison-valley',
        title: '毒谷试炼',
        description: '迷雾毒谷的入口立着一块石碑：入谷者需以血为引。谷中奇毒与灵药共生，能走多远全看造化。',
        effects: { vitality: 5, agility: -2 },
        exp: 15,
        minLevel: 2,
        weight: 1,
      },
      {
        id: 'sword-heart',
        title: '剑心通明',
        description: '瀑布下的老剑客说你心不静。他让你盯着飞泻的流水看了三天三夜，直到你在水声里听见自己的心跳。',
        effects: { intelligence: 4, strength: 3 },
        exp: 16,
        minLevel: 3,
        weight: 1,
      },
      {
        id: 'martial-gathering',
        title: '武林大会',
        description: '十年一度的武林大会广发英雄帖，各路高手齐聚，连深居简出的隐世前辈也破例现身。',
        effects: { strength: 4, charisma: 4 },
        exp: 18,
        minLevel: 4,
        weight: 1,
      },
      {
        id: 'sword-saint-legacy',
        title: '剑圣传承',
        description: '剑冢深处，历代剑圣的佩剑齐齐震颤。守墓人告诉你，剑圣临终前留下了一句话：有缘者得之。',
        effects: { agility: 3, intelligence: 3 },
        exp: 24,
        minLevel: 6,
        weight: 1,
        branches: [
          {
            id: 'strength',
            title: '以力御剑',
            description: '你拔出了那柄最重、最钝、无人能举的玄铁重剑。守墓人说，历代剑圣中，只有开派祖师举过它。',
            effects: { strength: 9, agility: 4 },
            exp: 28,
            when: { attribute: 'strength', highest: true },
          },
          {
            id: 'intelligence',
            title: '剑心通悟',
            description: '你没有拔剑，而是用三天三夜参透了剑冢墙上的残缺剑谱。守墓人感叹：你已得剑圣之「意」。',
            effects: { intelligence: 9, agility: 5 },
            exp: 28,
            when: { attribute: 'intelligence', highest: true },
          },
          {
            id: 'charisma',
            title: '万剑归心',
            description: '你向剑冢中的前辈之灵郑重行礼，许下守护江湖的诺言。万剑齐鸣，仿佛在回应你的誓言。',
            effects: { charisma: 9, luck: 4 },
            exp: 27,
            when: { attribute: 'charisma', highest: true },
          },
          {
            id: 'fate',
            title: '宿命之剑',
            description: '你随手捡起的那柄破剑，恰好是剑圣年轻时用过的第一把剑。原来缘分，早在很久以前就写好了。',
            effects: { luck: 8, agility: 6 },
            exp: 26,
            when: { always: true },
          },
        ],
      },
      {
        id: 'heaven-and-earth',
        title: '天地之约',
        description: '魔教教主与武林盟主约战于绝顶之巅，江湖存亡系于这一战。而你，恰好是这场约战唯一的见证者。',
        effects: { luck: 2, charisma: 3 },
        exp: 34,
        minLevel: 9,
        weight: 1,
        branches: [
          {
            id: 'strength',
            title: '一战定乾坤',
            description: '你出手打断了这场两败俱伤的决战，以一己之力同时接下了两大高手的全力一击，从此江湖只知你的名字。',
            effects: { strength: 13, vitality: 6 },
            exp: 40,
            when: { attribute: 'strength', highest: true },
          },
          {
            id: 'intelligence',
            title: '破局之谋',
            description: '你揭开了这场约战背后的惊天阴谋——原来挑起武林纷争的另有其人。你才是真正的破局者。',
            effects: { intelligence: 12, luck: 6 },
            exp: 40,
            when: { attribute: 'intelligence', highest: true },
          },
          {
            id: 'charisma',
            title: '江湖止戈',
            description: '你以三寸不烂之舌劝和了两大势力，让一场浩劫消弭于无形。盟主叹道：江湖缺的不是高手，是能止戈的人。',
            effects: { charisma: 12, strength: 4 },
            exp: 39,
            when: { attribute: 'charisma', highest: true },
          },
          {
            id: 'fate',
            title: '天命见证',
            description: '你什么都没做，只是站在那里。决战落幕时，双方却都说是看在你的面子上才收的手。',
            effects: { luck: 11, agility: 6 },
            exp: 38,
            when: { always: true },
          },
        ],
      },
    ],
  },
  {
    id: 'urban',
    name: '都市',
    description: '写字楼、地铁与深夜便利店，平凡日常里藏着不平凡的选择。',
    weight: 1,
    events: [
      {
        id: 'midnight-convenience',
        title: '深夜便利店',
        description: '加班后的深夜便利店，店员多给你打了一份关东煮，说这是今天最后一锅，浪费可惜。',
        effects: { charisma: 2, vitality: 3 },
        exp: 10,
        weight: 1,
      },
      {
        id: 'elevator-encounter',
        title: '电梯奇遇',
        description: '电梯在两层之间突然停住，身旁的陌生人却气定神闲地掏出手机，开始播放一段与你工作相关的内部录音。',
        effects: { intelligence: 5, luck: 1 },
        exp: 13,
        weight: 1,
      },
      {
        id: 'traffic-hustle',
        title: '早高峰冲刺',
        description: '地铁门即将关闭的瞬间，你在人群中左闪右避，最终在最后一秒挤进车厢——包带断了，但人赶上了。',
        effects: { agility: 4, luck: 2 },
        exp: 11,
        weight: 1,
      },
      {
        id: 'street-critic',
        title: '街头老伯',
        description: '公园长椅上的老伯一眼看出你心事重重，他说自己年轻时走过很多弯路，非要拉着你聊到日落。',
        effects: { charisma: 3, intelligence: 3 },
        exp: 12,
        weight: 1,
      },
      {
        id: 'lottery-ticket',
        title: '刮刮乐',
        description: '路过彩票站，店主热情地推销最后一张刮刮乐。你随手刮开，数字一个接一个对上——可惜差了一个。',
        effects: { luck: -3, strength: 2 },
        exp: 9,
        weight: 1,
      },
      {
        id: 'mystery-letter',
        title: '匿名包裹',
        description: '前台转交给你一个没有寄件人的包裹，里面只有一张老照片，照片背面写着一行地址和一个日期。',
        effects: { intelligence: 4, luck: 4 },
        exp: 14,
        minLevel: 2,
        weight: 1,
      },
      {
        id: 'metropolis-secret',
        title: '都市传说',
        description: '你偶然发现，这座城市的深夜正在发生一件无法用常理解释的事：凌晨三点，全城的路灯会同时闪烁三下。',
        effects: { intelligence: 3, luck: 3 },
        exp: 24,
        minLevel: 6,
        weight: 1,
        branches: [
          {
            id: 'strength',
            title: '直面谜底',
            description: '你没有绕开怪事，而是直接蹲守在路灯下，与「它」正面相遇。从此，你成了这座城市的守夜人。',
            effects: { strength: 8, vitality: 5 },
            exp: 28,
            when: { attribute: 'strength', highest: true },
          },
          {
            id: 'intelligence',
            title: '破解谜团',
            description: '你花了一个月查遍城市档案，终于还原了三十年前那桩被掩埋的悬案。真相揭开时，全城的路灯为你长明了一夜。',
            effects: { intelligence: 9, luck: 4 },
            exp: 28,
            when: { attribute: 'intelligence', highest: true },
          },
          {
            id: 'charisma',
            title: '城市之心',
            description: '你把都市传说的真相告诉了这座城市的人们，大家没有恐慌，反而一起点亮了各自窗台的灯，回应那个信号。',
            effects: { charisma: 9, luck: 4 },
            exp: 27,
            when: { attribute: 'charisma', highest: true },
          },
          {
            id: 'fate',
            title: '被选中的夜',
            description: '凌晨三点，路灯闪烁时你恰好抬头，与整座城市的「目光」对视。它记住了你，你也记住了它。',
            effects: { luck: 8, agility: 5 },
            exp: 26,
            when: { always: true },
          },
        ],
      },
      {
        id: 'city-destiny',
        title: '城市意志',
        description: '一场前所未有的危机笼罩整座城市，而你发现，自己似乎能听见这座城市的「心跳」——它在向你求救。',
        effects: { luck: 2, vitality: 3 },
        exp: 34,
        minLevel: 9,
        weight: 1,
        branches: [
          {
            id: 'strength',
            title: '凡人英雄',
            description: '你以一己之力扛住了危机的第一波冲击，让救援队伍争取到了黄金时间。媒体报道你时，只用了四个字：凡人英雄。',
            effects: { strength: 12, vitality: 7 },
            exp: 40,
            when: { attribute: 'strength', highest: true },
          },
          {
            id: 'intelligence',
            title: '幕后指挥',
            description: '你在危机中化身「最强大脑」，用一套精密到秒的调度方案，让整座城市在混乱中安然无恙。',
            effects: { intelligence: 12, luck: 6 },
            exp: 40,
            when: { attribute: 'intelligence', highest: true },
          },
          {
            id: 'charisma',
            title: '万人同心',
            description: '你在直播中说出那句「这座城市住着的人，就是这座城市本身」，让百万市民自发成为彼此的依靠。',
            effects: { charisma: 12, luck: 5 },
            exp: 39,
            when: { attribute: 'charisma', highest: true },
          },
          {
            id: 'fate',
            title: '城市守护者',
            description: '危机解除后，你发现自己的钥匙串上多了一枚锈迹斑斑的徽章——那是这座城市的「心」，它选择了你。',
            effects: { luck: 11, vitality: 6 },
            exp: 38,
            when: { always: true },
          },
        ],
      },
    ],
  },
]

export function themeById(id: string): ThemeDef | undefined {
  return DEFAULT_THEMES.find((theme) => theme.id === id)
}
