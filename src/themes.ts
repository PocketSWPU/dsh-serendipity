/**
 * 主题与事件库：工作奇遇的随机事件内容。
 *
 * 主题覆盖科幻、玄幻、远古、动漫、小说、武侠、都市等方向；
 * 每个事件对主角属性有不同程度的影响（可能是正面、负面或权衡）。
 * 本模块是纯数据，可通过插件配置追加主题、追加事件或调整权重。
 */

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
  /** 触发所需的最低等级（可选）。 */
  readonly minLevel?: number
  /** 相对权重，越大越容易被抽中。 */
  readonly weight: number
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
    ],
  },
]

export function themeById(id: string): ThemeDef | undefined {
  return DEFAULT_THEMES.find((theme) => theme.id === id)
}
