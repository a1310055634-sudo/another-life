// 第 86 轮（V5）：房产事件线——持有与变卖。购房入口=既有 mid_house_down_payment
// （basic.ts，本轮已补 buyHome 盖章）；置换新房按砍量预案砍（卖旧净额是动态值，
// 静态效果表达不了差价）。语义见 SPEC §6.52。
import type { GameEvent } from '../../engine/types'

export const HOME_EVENTS: GameEvent[] = [
  {
    id: 'home_living',
    category: 'life',
    title: '自己的房子，总要修修补补',
    text: '梅雨季刚过，{name}发现阳台墙角洇出一小片霉斑，浴室的龙头也在夜里滴水。房子是自己的，这些事没人替你操心。',
    minAge: 25,
    maxAge: 70,
    cooldown: 5,
    requires: { homeOwned: true },
    choices: [
      {
        text: '趁周末请人修补，再刷一遍防水',
        tooltip: '维护开支 2,000 元',
        summary: '{name}找了个老师傅把霉斑和龙头一并收拾了，屋子重新干燥踏实起来',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 2 },
        ],
      },
      {
        text: '旧就旧点吧，先住着',
        summary: '{name}拿抹布擦了擦霉斑，龙头用盆接着——日子嘛，凑合也是一种过法',
        effects: [{ attr: 'happiness', delta: -1 }],
      },
    ],
  },
  {
    id: 'home_sell_forced',
    category: 'money',
    title: '挂牌，还是硬撑',
    text: '账户余额转负的那天，中介的电话又来了：「哥，你那房子现在行情不错，挂出来随时能走账。」{name}捏着话筒，半天没说出话。',
    minAge: 30,
    maxAge: 70,
    once: true,
    requires: { homeOwned: true, moneyBelow: 0 },
    choices: [
      {
        text: '挂牌出售，落袋为安',
        tooltip: '净额=现值−未偿房贷，卖房即清贷（现值不足时为负）',
        summary: '{name}签了委托协议。过户那天，房贷两清，卡里多了一笔卖房款——家没了，账也平了',
        effects: [{ sellHome: true }],
      },
      {
        text: '再撑一撑，房子不能卖',
        summary: '{name}回掉了电话。家是最后一条底线，撑不住也得撑',
        effects: [{ attr: 'stress', delta: 1 }],
      },
    ],
  },
]
