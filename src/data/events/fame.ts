// 第 93 轮（V5）：自媒体名声线——起号→坚持→爆款→变现→网暴。
// 名声=minor_fame 全局标记（不加 followers 数值字段）；走红窗/网暴窗由
// engine/fame.ts 独立散列确定性重放（事件条件 fameChance 门），主 rng 零消耗。
// 网暴文案非受害者指责化：矛盾指向陌生人与平台生态，不指向「谁让你发」。
import type { GameEvent } from '../../engine/types'

export const FAME_EVENTS: GameEvent[] = [
  {
    id: 'fame_start',
    category: 'career',
    title: '注册了一个账号',
    text: '深夜刷手机的时候，{name}刷到一条「普通人也能做自媒体」的视频。手指在「立即注册」上停了停——白天上班/上学，晚上剪视频，好像……可以试试？',
    minAge: 18,
    maxAge: 45,
    once: true,
    requires: { careerKinds: ['employed', 'student', 'unemployed', 'none'], tagsNone: ['minor_fame', 'creator_started'] },
    choices: [
      {
        text: '认真运营，设备先置办起来',
        tooltip: '设备 2,000 元；压力+2；标记 creator_started（进入走红判定）',
        summary: '{name}下单了支架和麦克风。第一条视频的播放量：27',
        effects: [
          { money: -2000 },
          { attr: 'stress', delta: 2 },
        ],
        addTags: ['creator_started'],
      },
      {
        text: '随手发发，先试试水',
        tooltip: '标记 creator_started（进入走红判定）；更新慢，走红概率不变但节奏随缘',
        summary: '{name}用手机随手注册发了第一条日常。播不播得出圈，随缘',
        effects: [{ attr: 'social', delta: 1 }],
        addTags: ['creator_started'],
      },
    ],
  },
  {
    id: 'fame_update',
    category: 'career',
    title: '周更的坚持',
    text: '账号更新是个磨人的活：白天的事忙完，晚上还得剪片、写文案、盯评论。{name}盯着后台两条刺眼的评论「就这水平也学人做博主」，把下周的选题表又填满了一页。',
    minAge: 18,
    maxAge: 48,
    cooldown: 1,
    requires: { tagsAny: ['creator_started'], tagsNone: ['minor_fame'] },
    choices: [
      {
        text: '继续更，风雨无阻',
        tooltip: 'stress+1；坚持中，走红窗每年 35%',
        summary: '{name}把「就这水平」截图设成了手机壁纸，然后照常更新',
        effects: [{ attr: 'stress', delta: 1 }],
      },
      {
        text: '算了，弃坑',
        tooltip: '移除创作者标记，回到普通生活',
        summary: '{name}卸载了剪辑软件。曾经的热血，变成了账号里最后一条「感谢关注」',
        effects: [
          { attr: 'happiness', delta: 1 },
        ],
        removeTags: ['creator_started'],
      },
    ],
  },
  {
    id: 'fame_viral',
    category: 'career',
    title: '那条视频爆了',
    text: '一条随手发的视频一夜之间冲上了热门。评论区涌进几万人，私信提示红得发烫，还有 MCN 机构发来合作邀请。{name}盯着那条几百万播放的数据，手都在抖。',
    minAge: 18,
    maxAge: 48,
    cooldown: 6,
    weight: 14,
    requires: { tagsAny: ['creator_started'], fameChance: 'viral' },
    choices: [
      {
        text: '接住这泼天的流量，正式做号',
        tooltip: 'minor_fame 标记：后续变现与风浪随之而来',
        summary: '{name}回复了 MCN 的邀约。从这天起，{name}是有粉丝的人了',
        effects: [
          { attr: 'happiness', delta: 4 },
          { attr: 'social', delta: 3 },
        ],
        addTags: ['minor_fame'],
        removeTags: ['creator_started'],
      },
      {
        text: '慌了，连夜删号跑路',
        tooltip: '放弃走红：移除创作者标记',
        summary: '{name}看着涌进来的陌生人和质疑声，手一抖点了注销。热度散得比来得还快',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: -2 },
        ],
        removeTags: ['creator_started'],
      },
    ],
  },
  {
    id: 'fame_cash',
    category: 'career',
    title: '第一条商单',
    text: '品牌方发来的合作邮件写得客客气气，报价也可观。{name}盯着合同里的「品牌调性一致」几个字，第一次认真思考：这条广告，接还是不接？',
    minAge: 18,
    maxAge: 50,
    cooldown: 4,
    requires: { tagsAny: ['minor_fame'] },
    choices: [
      {
        text: '接下商单，认真出片',
        tooltip: '广告收入 8,000 元',
        summary: '{name}拍完了第一条商单。粉丝评论区有人捧有人骂，但账单不会骗人',
        effects: [
          { money: 8000 },
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: 1 },
        ],
      },
      {
        text: '只接真心喜欢的东西，佛系更新',
        tooltip: '零星打赏 2,000 元',
        summary: '{name}回绝了大部分商单，只留下一个真心喜欢的小品牌。钱少，但内容干净',
        effects: [
          { money: 2000 },
          { attr: 'happiness', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'fame_hate',
    category: 'relationship',
    title: '被挂上了热搜',
    text: '一段掐头去尾的视频把{name}挂上了热搜，评论区涌进数万陌生人，最难听的话得了最高赞。没有人在意真相，他们只是需要一个可以攻击的对象。',
    minAge: 18,
    maxAge: 50,
    cooldown: 4,
    requires: { tagsAny: ['minor_fame'], fameChance: 'hate' },
    choices: [
      {
        text: '不回应，让时间过去',
        tooltip: 'stress+3、happiness−4；名声保留',
        summary: '{name}关掉了评论区，删了 App。互联网的记忆很短，但那几天的每一分钟都很长',
        effects: [
          { attr: 'stress', delta: 3 },
          { attr: 'happiness', delta: -4 },
        ],
      },
      {
        text: '发澄清声明，然后停更一阵',
        tooltip: '移除 minor_fame：热度与黑子一起退潮',
        summary: '{name}发了条长文澄清，然后停更了。支持者还在，但{name}需要一段没有镜头的日子',
        effects: [
          { attr: 'stress', delta: -2 },
          { attr: 'happiness', delta: -2 },
        ],
        removeTags: ['minor_fame'],
      },
    ],
  },
  // 第 110 轮（V6）：热度消退向 2 枚——补「minor_fame 只进不退」的缺口。
  //   ① fame_fade_out —— 「主动淡出」的抉择事件：只有一个选项摘标记，
  //      摘不摘由玩家决定（走既有 removeTags，零引擎改动）。
  //   ② fame_past_peak —— 「过气」氛围事件：只做叙事与心情效果，
  //      **全选项不带 removeTags**（自动摘标记 = 引擎语义改动，本轮禁止；
  //      有单测把这条钉死：任一选项结算后 minor_fame 必须仍在册）。
  //   两枚都不挂 fameChance 散列门——只吃既有 minor_fame 标记门，
  //   不引入任何新散列分支（A6 的 18 局零位移因此与主 rng 完全无关）。
  {
    id: 'fame_fade_out',
    category: 'career',
    title: '过气的念头',
    text: '后台的粉丝数停在一个不再变动的数字上很久了。商单邮件上次来还是半年前，评论区最常见的留言从「更新！」变成了「博主还活着吗」。{name}盯着这个自己一手养起来的账号，第一次认真想到那个词：过气。',
    minAge: 40,
    maxAge: 50,
    cooldown: 8,
    weight: 10,
    requires: { tagsAny: ['minor_fame'] },
    choices: [
      {
        text: '体面谢幕，置顶一条告别',
        tooltip: '主动摘除 minor_fame：回到普通生活',
        summary: '{name}写了条长长的告别，置顶。按下发送的那一刻，心里松了一口气',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: -2 },
        ],
        removeTags: ['minor_fame'],
      },
      {
        text: '转型慢更，只记录生活',
        tooltip: '名声保留；不再追热点，压力小了',
        summary: '{name}把简介里的「周更」删掉，改成「想更就更」。掉粉，但睡得着了',
        effects: [
          { attr: 'stress', delta: -1 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '不服，再冲一次',
        tooltip: '投 1,000 元推广；stress+2',
        summary: '{name}研究了一整晚「流量密码」，投了一笔推广。数据涨了一点，又落回去——但至少试过',
        effects: [
          { money: -1000 },
          { attr: 'stress', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'fame_past_peak',
    category: 'life',
    title: '被翻出来的旧视频',
    text: '饭桌前刷手机，{name}刷到一条熟悉的画面——自己几年前爆过的那条视频，被人剪进了「互联网怀旧合集」，弹幕飘过一排「爷青回」。点赞最高的评论问：这位后来去哪了？{name}把手机扣在桌上，饭还是热的。',
    minAge: 42,
    maxAge: 54,
    cooldown: 6,
    weight: 9,
    requires: { tagsAny: ['minor_fame'] },
    choices: [
      {
        text: '在评论区悄悄回一句「过得不错」',
        tooltip: 'happiness+2',
        summary: '那条回复收到三百多个赞。原来还有人记得。{name}关掉手机，自己笑了一会儿',
        effects: [{ attr: 'happiness', delta: 2 }],
      },
      {
        text: '看完就关，不留痕迹',
        tooltip: 'stress−1',
        summary: '{name}看完了整条合集。那阵风早吹过去了，日子是自己的',
        effects: [{ attr: 'stress', delta: -1 }],
      },
      {
        text: '有点不是滋味，那顿饭没怎么说话',
        tooltip: 'happiness−1',
        summary: '「后来去哪了」——去哪了呢。那晚的饭，{name}吃得有点慢',
        effects: [{ attr: 'happiness', delta: -1 }],
      },
    ],
  },
]
