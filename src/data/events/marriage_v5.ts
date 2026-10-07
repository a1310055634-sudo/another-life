// 第 91 轮（V5）：婚恋多元化——离婚（R67 最小语义恢复）、单身岁月、再婚窗口、
// 丁克、不婚主义。离婚效果=引擎侧 Effect.divorce（配偶移出+现金减半+child 保留）；
// 再婚复用求婚链的 convertFrom 模式；丁克 tag 压制生育入口（rel_child_question）。
import type { GameEvent } from '../../engine/types'

export const MARRIAGE_V5_EVENTS: GameEvent[] = [
  {
    id: 'div_sign_papers',
    category: 'relationship',
    title: '离婚协议书',
    text: '冷战第 N 个月，两本结婚证并排放在餐桌上。{name}和TA都清楚：签了，这段日子就翻篇了；不签，日子还得这样耗着。',
    minAge: 30,
    maxAge: 50,
    once: true,
    priority: 2,
    weight: 14,
    requires: { tagsAll: ['married', 'marriage_crisis'], relationKinds: ['spouse'] },
    choices: [
      {
        text: '签。好聚好散',
        tooltip: '现金 50% 分割（负资产同担）；子女抚养共同承担；恢复单身',
        summary: '{name}在协议书上签了字。走出民政局的时候，天特别亮，风特别冷',
        effects: [{ divorce: true }],
      },
      {
        text: '再给这半年一次机会',
        summary: '{name}把协议书推了回去。也许熬过这个冬天，会不一样',
        effects: [{ attr: 'stress', delta: 1 }],
      },
    ],
  },
  {
    id: 'div_single_life',
    category: 'relationship',
    title: '一个人的日子',
    text: '离婚后的第 N 个周末，{name}把家里重新布置了一遍——所有东西都只放自己够得着的位置。原来一个人过，也可以过得很讲究。',
    minAge: 30,
    maxAge: 55,
    cooldown: 4,
    requires: { divorced: true },
    choices: [
      {
        text: '把钱和时间都花给自己',
        summary: '{name}给自己买了那件一直舍不得的东西——取悦自己这件事，不用等谁',
        effects: [
          { money: -1000 },
          { attr: 'happiness', delta: 2 },
        ],
      },
      {
        text: '相亲角转转，不设防的那种',
        summary: '{name}去了趟相亲角。没遇上合适的，倒是从大爷大妈的报价里看懂了不少人间',
        effects: [
          { attr: 'social', delta: 2 },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'div_remarry',
    category: 'relationship',
    title: '第二次说什么',
    text: '和现在的TA在一起一年多了，{name}比任何时候都确定。婚礼很简单——经历过一次的人都知道，重要的不是仪式，是那个人。',
    minAge: 35,
    maxAge: 60,
    once: true,
    requires: { divorced: true, relationKinds: ['partner'], relationKindsNone: ['spouse'] },
    choices: [
      {
        text: '领证。这次是真的',
        tooltip: '花销 8,000 元；恢复已婚',
        summary: '{name}和TA领了证，没有仪式，只有两本红色的本子和一顿家常饭',
        effects: [
          { money: -8000 },
          { attr: 'happiness', delta: 6 },
          { relation: { kind: 'spouse', convertFrom: 'partner' } },
        ],
        requires: { moneyAtLeast: 8000 },
        addTags: ['married'],
        removeTags: ['divorced'],
      },
      {
        text: '再处一段时间，不急',
        summary: '{name}觉得现在这样刚刚好。名分这种事，急不来',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    id: 'fam_dink',
    category: 'relationship',
    title: '两个人，也很好',
    text: '亲戚的「什么时候要孩子」问了一年又一年。这一次，{name}和TA认真地谈了一个晚上——两个人把日子过成想要的样子，也是一种完整。',
    minAge: 28,
    maxAge: 35,
    once: true,
    requires: { tagsAll: ['married'], relationKinds: ['spouse'], relationKindsNone: ['child'] },
    choices: [
      {
        text: '说好了，做丁克',
        tooltip: '丁克约定：不再被生育议题打扰',
        summary: '{name}和TA达成了共识——两个人的世界，自有两个人的丰盛',
        effects: [
          { attr: 'happiness', delta: 2 },
        ],
        addTags: ['dink'],
      },
      {
        text: '顺其自然，不刻意',
        summary: '{name}和TA决定不把话说死。日子往前走，走到哪算哪',
        effects: [{ attr: 'stress', delta: -1 }],
      },
    ],
  },
  {
    id: 'life_childfree',
    category: 'relationship',
    title: '想明白了',
    text: '又一场同学婚礼散场。{name}在回家路上把这件事想透了——结婚不是人生的必答题，把一个人的日子过明白，比什么都强。',
    minAge: 30,
    maxAge: 45,
    once: true,
    requires: { relationKindsNone: ['partner', 'spouse'] },
    choices: [
      {
        text: '就这样，把自己活明白',
        tooltip: '不婚约定：不再被催婚议题左右',
        summary: '{name}给生活做了减法——想要的自然而然，不想求的敬而远之',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: -1 },
        ],
        addTags: ['childfree_will'],
      },
      {
        text: '话不说死，缘分随缘',
        summary: '{name}想归想，还是留了一扇窗。谁说得准呢',
        effects: [{ attr: 'happiness', delta: -1 }],
      },
    ],
  },
]
