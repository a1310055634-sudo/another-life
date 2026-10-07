// 第 66 轮：挚友线事件——朋友是全类型衰减最快（−2/年）的关系，把它做成可经营的长线。
// 资格全部读真实状态：在册朋友（relationKinds: friend）、亲密阈值线（maxCloseness
// 口角线 ≤35 / 探望修复线 ≤55）、婚姻联动（伴郎须配偶与朋友同在，minCloseness 双键 AND）。
// 朋友关系建立时的具名三级来源不变：事件静态具名（老周/阿凯等）> FRIEND_NICKNAMES
// 池 seed 确定具名（第 66 轮入池）> 泛称兜底。
import type { GameEvent } from '../../engine/types'

export const FRIEND_EVENTS: GameEvent[] = [
  // ── 深夜倾诉：自身情绪低位（happiness ≤40）才有此局；陪伴是挚友的核心场景 ──
  {
    id: 'frd_late_talk',
    category: 'relationship',
    title: '凌晨两点的电话',
    text: '睡不着的那晚，{name}翻遍通讯录，最后停在那个名字上。电话响了一声就接了——「我也没睡，正想找你说说话」。',
    minAge: 20,
    maxAge: 70,
    cooldown: 3,
    weight: 10,
    requires: { relationKinds: ['friend'], maxAttr: { happiness: 40 } },
    choices: [
      {
        text: '打电话聊到天亮',
        summary: '那通电话从凌晨两点聊到了窗外发白',
        effects: [
          { attr: 'happiness', delta: 5 },
          { relation: { kind: 'friend', deltaCloseness: 4 } },
        ],
      },
      {
        text: '约出来，喝一顿',
        tooltip: '大排档的塑料凳上，什么都能说',
        summary: '塑料凳、烤串、两瓶啤酒，话说了一半人就好了一半',
        effects: [
          { money: -300 },
          { attr: 'happiness', delta: 4 },
          { attr: 'health', delta: -1 },
          { relation: { kind: 'friend', deltaCloseness: 3 } },
        ],
      },
      {
        text: '自己扛着，不传染坏情绪',
        summary: '{name}把手机扣在了桌上，那一晚过得很长',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
  // ── 婚礼伴郎：有配偶婚事 + 挚友在册（minCloseness 双键 AND）；once ──
  {
    id: 'frd_bestman',
    category: 'relationship',
    title: '伴郎的人选',
    text: '喜帖印出来那天，{name}在伴郎一栏几乎没有犹豫——这个位置，等了二十多年，也该轮到那个人了。',
    minAge: 22,
    maxAge: 60,
    once: true,
    weight: 12,
    priority: 2,
    requires: { minCloseness: { spouse: 0, friend: 0 } },
    choices: [
      {
        text: '正装出席，致辞讲哭全场',
        summary: '致辞讲到一半，新郎先红了眼眶',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 5 },
          { attr: 'social', delta: 3 },
          { relation: { kind: 'friend', deltaCloseness: 5 } },
        ],
      },
      {
        text: '前后操办，里外张罗',
        summary: '从接亲车队到敬酒顺序，{name}排了一整周',
        effects: [
          { money: -1000 },
          { attr: 'stress', delta: 2 },
          { attr: 'social', delta: 2 },
          { relation: { kind: 'friend', deltaCloseness: 4 } },
        ],
      },
      {
        text: '人不到，红包加倍到',
        summary: '红包厚了一倍，缺席的遗憾也是',
        effects: [
          { money: -3000 },
          { relation: { kind: 'friend', deltaCloseness: 1 } },
        ],
      },
    ],
  },
  // ── 跨城探望：亲密度走低（≤55）的修复向；见面永远比视频重 ──
  {
    id: 'frd_cross_city',
    category: 'relationship',
    title: '隔着三百公里的老朋友',
    text: '聊天记录停在两个月前的一句「改天聚聚」。{name}盯着那三个字看了一会儿，打开了购票软件——有些「改天」，是等不得的。',
    minAge: 25,
    maxAge: 70,
    cooldown: 4,
    weight: 9,
    requires: { relationKinds: ['friend'], maxCloseness: { friend: 55 } },
    choices: [
      {
        text: '请个假，跨城去一趟',
        tooltip: '见面永远比视频重',
        summary: '{name}在他乡的街头见到了那个熟悉的身影，一切如旧',
        effects: [
          { money: -1500 },
          { attr: 'happiness', delta: 3 },
          { relation: { kind: 'friend', deltaCloseness: 8 } },
        ],
      },
      {
        text: '约个视频，聊上两小时',
        summary: '屏幕两端聊了两小时，挂断前约好了下次见面',
        effects: [
          { relation: { kind: 'friend', deltaCloseness: 2 } },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '忙完这阵就去',
        summary: '「忙完这阵」——这句话今年已经说过三遍了',
        effects: [{ relation: { kind: 'friend', deltaCloseness: -2 } }],
      },
    ],
  },
  // ── 争吵与和好：亲密跌破 35 才有此局；先约面谈是修复出口 ──
  {
    id: 'frd_quarrel_reconcile',
    category: 'relationship',
    title: '那句说重了的话',
    text: '聚会上的话越说越冲，最后不欢而散。回家路上{name}想：认识这么多年，怎么就为了这点事伤了和气。',
    minAge: 20,
    maxAge: 68,
    cooldown: 3,
    weight: 9,
    requires: { relationKinds: ['friend'], maxCloseness: { friend: 35 } },
    choices: [
      {
        text: '约出来当面把话说开',
        summary: '当面说完，才发现不过是两句话的事',
        effects: [
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'friend', deltaCloseness: 9 } },
        ],
      },
      {
        text: '找个共同朋友说和',
        summary: '老朋友牵线，台阶就有了',
        effects: [
          { money: -500 },
          { attr: 'social', delta: 1 },
          { relation: { kind: 'friend', deltaCloseness: 5 } },
        ],
      },
      {
        text: '冷战到底，谁也别理谁',
        summary: '那段时间，聚会都刻意错开了',
        effects: [
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'friend', deltaCloseness: -5 } },
        ],
      },
    ],
  },
  // ── 第 102 轮：代际友情（撞题扫描零命中：全池「代际友情/忘年交」0 命中）──
  {
    id: 'frd_generation_friend',
    category: 'relationship',
    title: '孩子带回来的那个朋友',
    text: '饭桌上TA一直低着头，夹菜都挑最便宜的那盘。{name}问了两句学校的事，答得又短又硬。饭后TA主动留下来洗碗——「我以后还想来。」',
    minAge: 38,
    maxAge: 62,
    cooldown: 5,
    weight: 8,
    requires: { relationKinds: ['friend'] },
    choices: [
      {
        text: '留TA吃下一顿正经饭',
        summary: '第二顿饭端上了红烧肉，TA终于自己夹了三块',
        effects: [
          { money: -400 },
          { attr: 'happiness', delta: 3 },
          { attr: 'social', delta: 1 },
        ],
      },
      {
        text: '塞点钱和几本书给TA',
        tooltip: '不问用途，TA拿去就是自己的事',
        summary: 'TA走的时候把书抱得很紧，钱包按了一下没打开',
        effects: [
          { money: -600 },
          { attr: 'happiness', delta: 2 },
          { attr: 'social', delta: 2 },
        ],
      },
      {
        text: '客气两句，让TA以后别来了',
        summary: 'TA在门口应了一声「好」，那把伞也没再来还',
        effects: [
          { attr: 'stress', delta: 1 },
          { attr: 'social', delta: -1 },
        ],
      },
    ],
  },
  // ── 第 102 轮：老友住院陪床（与 friends 既有探望线互斥：本局写的是「你去守别人的夜」）──
  {
    id: 'frd_care_watch',
    category: 'relationship',
    title: '陪床的那一夜',
    text: '病房走廊的灯有一半坏了。{name}把陪护椅往后挪了挪，看着监护仪上的数字一格一格往上爬，TA的家人从外地赶来的火车还要四个小时。',
    minAge: 35,
    maxAge: 68,
    cooldown: 6,
    weight: 7,
    requires: { relationKinds: ['friend'] },
    choices: [
      {
        text: '守到家人来再走',
        summary: '四天三夜，第五天TA拎着水果站在门口，眼睛是红的',
        effects: [
          { attr: 'health', delta: -2 },
          { attr: 'happiness', delta: 1 },
          { attr: 'social', delta: 2 },
        ],
      },
      {
        text: '请个护工，钱我来出',
        summary: '护工很专业，TA的家人到的时候事情已经办妥了',
        effects: [
          { money: -2000 },
          { attr: 'health', delta: -1 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '转笔钱就走',
        summary: '钱转过去了，消息也回得客气，就是越来越客气',
        effects: [
          { money: -1500 },
          { attr: 'happiness', delta: -1 },
          { attr: 'social', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'frd_old_wall',
    category: 'relationship',
    title: '老友的相片墙',
    text: '整理旧屋时翻出一面相片墙：毕业照、婚礼合影、每年一聚的的大合照——全有TA。{name}拍了张照片发给TA，回信只有三个字：「聚。」',
    minAge: 40,
    maxAge: 70,
    cooldown: 5,
    weight: 9,
    requires: { relationKinds: ['friend'] },
    choices: [
      {
        text: '约在老照片里的那家馆子重聚',
        summary: '馆子换了三次老板，菜还是那个味。两个人对着照片墙数年头，数到最后都笑出了声',
        effects: [
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'friend', deltaCloseness: 3 } },
        ],
      },
      {
        text: '来一场云聚会，开着视频各喝各的',
        summary: '一个在南方一个在北方，视频里碰了杯。距离没挡住的，是那声「老地方见」',
        effects: [{ relation: { kind: 'friend', deltaCloseness: 2 } }],
      },
    ],
  },
  {
    id: 'frd_half_marathon',
    category: 'relationship',
    title: '半马之约',
    text: '体检报告出来，老朋友在群里@{name}：「报名了城市半马，剩俩月，一起？」——一起流汗的老友情，比一起吃饭的更深一层。',
    minAge: 30,
    maxAge: 55,
    cooldown: 4,
    weight: 9,
    requires: { relationKinds: ['friend'] },
    choices: [
      {
        text: '一起训练，一起站上起跑线',
        tooltip: '报名装备 300 元',
        summary: '清晨的公园多了两个影子。冲线那天两个人互相搀着，奖牌挂在脖子上晃——第一次为健康干的糊涂事，不亏',
        effects: [
          { money: -300 },
          { attr: 'health', delta: 1 },
          { relation: { kind: 'friend', deltaCloseness: 2 } },
        ],
      },
      {
        text: '当TA的补给站，终点接应',
        summary: '{name}拎着水和毛巾守在 18 公里处。TA冲过终点第一个动作是把奖牌挂{name}脖子上：「有你守着，我才跑得完。」',
        effects: [{ relation: { kind: 'friend', deltaCloseness: 2 } }],
      },
    ],
  }
]
