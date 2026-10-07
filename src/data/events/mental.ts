// 心理健康线（第 113 轮，V7）：情绪低谷的授予与走出。
// 状态承载 = 全局 tag `low_mood`（零数值字段）；授予制（R68 倦怠线同款思路——
// 纯阈值状态判定不可靠，由事件授予/摘除）。与 burnout 的分界：burnout=职业倦怠
// （在职+stress≥90+priority 2 病危层），本线=情绪状态（happiness 门+全身份广谱、
// priority 0）。红线：不做自伤/自杀题材，文案禁说教禁羞辱，「求助=勇气」定调。
import type { GameEvent } from '../../engine/types'

export const MENTAL_EVENTS: GameEvent[] = [
  {
    // 授予事件：连续性的低幸福×高压才有此局；tagsNone 防重复授予（摘除后可复发，cd3 防刷）。
    id: 'mood_low_tide',
    category: 'life',
    title: '看不见抓手的日子',
    text: '说不清是哪天开始的。{name}早上不想睁眼，晚上舍不得关灯——好像只要不睡着，今天就还没结束。朋友的消息堆在锁屏上，一个都没回。不是不想说话，是不知道说什么。',
    minAge: 18,
    maxAge: 70,
    cooldown: 3,
    weight: 12,
    requires: { maxAttr: { happiness: 35 }, minAttr: { stress: 65 }, tagsNone: ['low_mood'] },
    choices: [
      {
        text: '就让它沉着。不想解释，也不想好起来',
        summary: '{name}把「我最近不太好」打了又删，最后只回了句「没事」。有些日子就是这样，先沉着',
        effects: [],
        // low_mood_ever（第 125 轮）：持久「曾入低谷」标记——摘除 low_mood 后仍保留，
        // 供 ach_brave_help（求助的勇气）判定「曾入低谷且已走出」。
        addTags: ['low_mood', 'low_mood_ever'],
      },
      {
        text: '撑一撑，先把今天过完',
        summary: '{name}把闹钟往前调了十分钟，给自己留了点发呆的空。日子紧，但还没断',
        effects: [{ attr: 'stress', delta: 1 }],
      },
    ],
  },
  {
    // 出路一：自我调节——慢路，不摘标记（调回去需要别的东西）。
    id: 'mood_self_care',
    category: 'life',
    title: '一个人待着的下午',
    text: '难得的空档。{name}盯着天花板想了一会儿，决定不刷手机了——哪怕只是把屋子收拾出来一角，或者出门走到天黑。',
    minAge: 18,
    maxAge: 70,
    cooldown: 2,
    weight: 18,
    requires: { tagsAny: ['low_mood'] },
    choices: [
      {
        text: '收拾屋子，睡一个长觉',
        summary: '床单换成了晒过的那套。{name}下午四点躺下，一觉睡到深夜——醒来时屋里很静，静得刚好',
        effects: [{ attr: 'happiness', delta: 2 }],
      },
      {
        text: '出门，一直走到天黑再回来',
        summary: '{name}沿着河走了很远，路灯一盏盏亮起来。腿很酸，但脑子第一次这么安静',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
    ],
  },
  {
    // 出路二：倾诉——需要一段还活着的关系（朋友/恋人/配偶）。摘标记的快路之一。
    id: 'mood_talk',
    category: 'life',
    title: '话到嘴边',
    text: '有人发消息问{name}：「最近怎么样？」就这五个字，{name}盯着看了很久。说，还是不说？',
    minAge: 18,
    maxAge: 70,
    cooldown: 2,
    weight: 18,
    requires: { tagsAny: ['low_mood'], relationKinds: ['friend', 'partner', 'spouse'] },
    choices: [
      {
        text: '说了。把最近的状态，原原本本说了',
        summary: '说完{name}觉得有点傻，对方却只回了句：「谢谢你愿意告诉我。」原来开口本身，就已经是在往回走了',
        effects: [{ attr: 'happiness', delta: 3 }],
        removeTags: ['low_mood'],
      },
      {
        text: '话到嘴边，只是陪着对方坐了坐',
        summary: '{name}最终没说。但那顿饭吃得很慢，有个人在旁边，好像也没那么难熬',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    // 出路三：专业求助——小额花费（800 元<大额隐藏线 3,000，负债年也可见=求助不得因贫穷隐藏）。
    // 摘标记的快路之二。文案定调：预约是勇气，不是软弱。
    id: 'mood_professional',
    category: 'life',
    title: '存下的那个号码',
    text: '{name}其实早就存了那个号码——心理咨询的预约电话。一直没打。今天盯着它看了很久，想：要不，就当是给车子做次保养？',
    minAge: 18,
    maxAge: 70,
    cooldown: 2,
    weight: 18,
    requires: { tagsAny: ['low_mood'] },
    choices: [
      {
        text: '打了。约了第一次咨询',
        tooltip: '800 元/次',
        summary: '电话只响了两声就通了。挂断后{name}长出一口气——最难的一步已经迈出去了。第一次咨询只有一个小时，但那一小时里，{name}说的话比过去半年都多',
        effects: [
          { money: -800 },
          { attr: 'happiness', delta: 4 },
        ],
        removeTags: ['low_mood'],
      },
      {
        text: '又把手机扣下了。还没准备好',
        summary: '{name}把号码又存了一遍，好像这样能更近一点。没关系的，号码在那里，随时可以打',
        effects: [{ attr: 'happiness', delta: -1 }],
      },
    ],
  },
  {
    // 天晴：自然恢复通道——幸福回升到 55+ 时出现，摘标记。摘除后若再入谷可复发（授予 cd3）。
    id: 'mood_clear_sky',
    category: 'life',
    title: '那阵子，好像过去了',
    text: '{name}是在晾衣服的时候发现的：哼了一句歌。不成调，但确实是哼出来的。这种小事最近多起来了——一顿吃得香的饭，一段睡得沉的觉。',
    minAge: 18,
    maxAge: 70,
    cooldown: 4,
    weight: 14,
    requires: { tagsAny: ['low_mood'], minAttr: { happiness: 55 } },
    choices: [
      {
        text: '……好像缓过来了',
        summary: '{name}没有庆祝，只是把窗帘拉开了。那阵子过去了。如果它再来，{name}知道该找谁、该做什么',
        effects: [],
        removeTags: ['low_mood'],
      },
      {
        text: '先别急着翻篇，再稳一稳',
        summary: '{name}把「好了」两个字咽了回去。慢慢来，不着急给这段时间下结论',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
]
