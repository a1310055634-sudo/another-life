// 性格成长（第 119 轮，V7）：重大经历之后的一次性「你变了」时刻。
// 轻机制裁决：演化=文案层+persona_shifted 标记，特质本体（data/traits.ts）与
// GATE 判定逻辑零改动（A2 钉死）；不做特质替换、不做数值重排——人生改变了你，
// 但你还是你。来源标记（第 126 轮终校裁决：剔除 been_deep_debt——千局 50.4% 授予远超带，
// /divorced（离婚）/biz_failed（创业关门）/marriage_mended（婚姻危机愈合）。
// 文案支分化记录偏差：事件正文为静态模型（不支持按来源标记条件拼接，R118 同款约束），
// 「按来源分化」的断言形式=三种来源标记构造局资格一致性（round119.test）。
import type { GameEvent } from '../../engine/types'

export const PERSONA_EVENTS: GameEvent[] = [
  {
    id: 'persona_shift_moment',
    category: 'life',
    title: '你变了',
    text: '深夜整理旧物，翻出一张多年前的照片。照片里那个人眉眼飞扬，做什么都不管不顾。{name}看了很久，忽然分不清——是那个人走了太远，还是自己走得太远。',
    minAge: 30,
    maxAge: 70,
    once: true,
    weight: 2,
    requires: {
      tagsAny: ['been_deep_debt', 'divorced', 'biz_failed', 'marriage_mended'],
      tagsNone: ['persona_shifted'],
    },
    choices: [
      {
        text: '承认吧，我变了',
        summary: '{name}把照片摆上了架。变了就变了——那个人帮自己扛住了最难的日子，如今换一张更沉得住气的脸，接着走',
        effects: [{ attr: 'happiness', delta: 2 }],
        addTags: ['persona_shifted'],
      },
      {
        text: '我还是我。只是走了段远路',
        summary: '{name}把照片放回了盒子里，扣上盖子时很轻。没变，只是走了段远路——这话对不对，交给往后的日子',
        effects: [],
      },
    ],
  },
  {
    // 回响：他人视角的回望（需老朋友在册——「老朋友说你也变了」）。
    id: 'persona_echo',
    category: 'life',
    title: '老朋友说你也变了',
    text: '老朋友来家里坐，聊到一半忽然说：「你变了，你知道吗？以前你……」TA比了个含糊的手势，没说下去。{name}等TA把话说完。',
    minAge: 30,
    maxAge: 70,
    cooldown: 6,
    weight: 10,
    requires: { tagsAny: ['persona_shifted'], relationKinds: ['friend'] },
    choices: [
      {
        text: '笑着承认：「变了，变多了」',
        summary: '老朋友愣了一下，笑了：「挺好。现在的你，看着踏实。」有些变化，被人看出来的那一刻才算数',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'friend', deltaCloseness: 2 } },
        ],
      },
      {
        text: '嘴硬：「哪有，还是老样子」',
        summary: '老朋友撇撇嘴没拆穿，又给{name}续了茶。嘴上不认，杯子里的热气是诚实的',
        effects: [{ relation: { kind: 'friend', deltaCloseness: 1 } }],
      },
    ],
  },
]
