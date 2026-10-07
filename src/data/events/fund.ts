// 第 87 轮（V5）：基金定投事件线——开户、止盈、割肉。定投的年度划扣与市值结算
// 在 lifecycle 3.7 步（独立支流牛熊序列）；赎回走 redeemFund 效果（全额入袋销户）。
// 市场态事件条件（fundBull/fundBear）由 marketAt 确定性重放，与文案互证。
import type { GameEvent } from '../../engine/types'

export const FUND_EVENTS: GameEvent[] = [
  {
    id: 'fin_fund_start',
    category: 'money',
    title: '定投的格子',
    text: '银行 App 里那个「基金定投」的格子，{name}每次都划过去又划回来。同事说这叫「懒人理财」，行情好坏都往里放，摊平了看长期。',
    minAge: 25,
    maxAge: 50,
    once: true,
    requires: { moneyAtLeast: 6000 },
    choices: [
      {
        text: '设一年 6,000 的定投，当强制储蓄',
        tooltip: '每年年结自动划扣 6,000 买入，市值随行情起伏',
        summary: '{name}设了年投 6,000 的定投，扣款日定在发薪那天——眼不见为净',
        effects: [{ ensureFund: { annualContribution: 6000 } }],
      },
      {
        text: '狠一点，一年 12,000',
        tooltip: '每年年结自动划扣 12,000 买入，市值随行情起伏',
        summary: '{name}一咬牙设了年投 12,000——反正攒下来也不知道会花在哪',
        effects: [{ ensureFund: { annualContribution: 12000 } }],
      },
      {
        text: '看不懂的东西不碰',
        summary: '{name}退出了页面。看不懂的钱，赚了也不踏实',
        effects: [{ attr: 'smarts', delta: 1 }],
      },
    ],
  },
  {
    id: 'fin_fund_take_profit',
    category: 'money',
    title: '账户飘红的那天',
    text: '{name}随手点开基金账户——绿了那么久，居然红了，收益率是入职第一年那次调薪都比不上的数字。心脏咚咚跳：是落袋，还是再等等？',
    minAge: 25,
    maxAge: 60,
    cooldown: 4,
    requires: { fundOwned: true, fundMarket: 'bull' },
    choices: [
      {
        text: '全部赎回，落袋为安',
        tooltip: '市值全额入袋，基金账户注销',
        summary: '{name}按下了赎回。钱到账那一刻，红彤彤的数字变成了实实在在的余额',
        effects: [{ redeemFund: true }],
      },
      {
        text: '拿住，长期主义者不眨眼',
        summary: '{name}把 App 划走，告诫自己：拿住。至于拿不拿得住，是以后的事',
        effects: [{ attr: 'stress', delta: 1 }],
      },
    ],
  },
  {
    id: 'fin_fund_cut_loss',
    category: 'money',
    title: '深绿的悬崖边',
    text: '连着半年，{name}的基金账户绿得像一片被踩过的草坪。群里有人说「破净了」、有人说「历史大底」。{name}盯着那串数字，指头悬在卖出键上。',
    minAge: 25,
    maxAge: 60,
    cooldown: 4,
    requires: { fundOwned: true, fundMarket: 'bear' },
    choices: [
      {
        text: '清仓离场，从此只存定期',
        tooltip: '市值全额入袋（含亏损），基金账户注销',
        summary: '{name}含着泪点了清仓。到账的钱比投进去的少了一截，但睡得着觉了',
        effects: [
          { redeemFund: true },
          { attr: 'stress', delta: -2 },
        ],
      },
      {
        text: '跌出来的都是机会，继续定投',
        summary: '{name}不但没卖，还把定投档位在心里又确认了一遍——别人恐惧我贪婪',
        effects: [{ attr: 'smarts', delta: 1 }],
      },
    ],
  },
]
