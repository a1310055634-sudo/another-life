// 创业事件族（第 116 轮，V7）：辞职去试试——纯事件链，不建持久经营状态
// （business 字段留给 V8 评估）。撞题差异化：family_backed 链=家里出钱开店
// （career.ts，家里出资）；rel_old_friend_success=朋友的生意拉你入伙（relationship.ts）。
// 本线=自己辞职、自己攒钱、自负盈亏的独立创业。身份承载=entrepreneur tag；
// 失败=biz_failed tag（供「重新上班」与 R125 成就钩子）。成败支流走 venture.ts
// 双散列（0.5 进账/0.4 风险），主 rng 零消耗。红线：成败叙事不与赌博隐喻挂钩。
import type { GameEvent } from '../../engine/types'

export const VENTURE_EVENTS: GameEvent[] = [
  {
    // 链头：辞职下海。once（一次性创业决策；重开归「重新上班」后的既有求职链）。
    id: 'ven_quit_resign',
    category: 'career',
    title: '辞职去创业',
    text: '那个想法{name}养了三年——夜里睡不着的时候，它就在脑子里发光。银行卡里的数字，第一次够得上「试试」的门槛。桌上的辞职信，打印好了，就差签名。',
    minAge: 25,
    maxAge: 45,
    once: true,
    weight: 14,
    requires: { careerKinds: ['employed'], moneyAtLeast: 30000 },
    choices: [
      {
        text: '签了。从今天起，给自己打工',
        tooltip: '投入全部积蓄 30,000 元；没有退路，也没有天花板',
        summary: '交辞职信那天手有点抖，走出办公楼却觉得天特别大。{name}给自己的小店想了个名字，注册那天，字签得又慢又用力',
        effects: [
          { loseJob: true },
          { money: -30000 },
        ],
        addTags: ['entrepreneur'],
      },
      {
        text: '再攒攒，还没到时候',
        summary: '辞职信锁回了抽屉最底层。夜里那个想法还在发光——再攒攒，总会到的',
        effects: [{ attr: 'happiness', delta: -1 }],
      },
    ],
  },
  {
    // 启动期：分期投入（delayed 三期逐期到账；重投入/轻试水两档）。
    id: 'ven_first_year',
    category: 'career',
    title: '启动的那半年',
    text: '营业执照上的名字还带着油墨味。房租、装修、第一批货——每一项都在跟{name}要钱，而账上的数字一天比一天诚实。',
    minAge: 25,
    maxAge: 48,
    once: true,
    weight: 12,
    requires: { tagsAny: ['entrepreneur'] },
    choices: [
      {
        text: '按计划来：铺面、装修、第一批货',
        tooltip: '未来三年每年投入 20,000 元',
        effects: [],
        summary: '{name}把计划表贴在墙上，三期投入一期不少。账很疼，但每一步都踩在自己画的线上',
        delayed: [
          { years: 1, money: -20000, summary: '铺面第一年的投入，交出去的时候手都是稳的' },
          { years: 2, money: -20000, summary: '第二批货款+租金，生意像样了一点' },
          { years: 3, money: -20000, summary: '第三期投入——撑过这一年，就算站稳了' },
        ],
      },
      {
        text: '轻一点：先从线上小生意试水',
        tooltip: '未来三年每年投入 8,000 元',
        effects: [{ attr: 'stress', delta: -1 }],
        summary: '{name}把客厅一角改成了打包台。小本生意，试的是水，也是自己',
        delayed: [
          { years: 1, money: -8000, summary: '第一年的试水成本，包装盒堆到了天花板' },
          { years: 2, money: -8000, summary: '回头客多起来了，投入也跟着加了一点' },
          { years: 3, money: -8000, summary: '第三年——小店的名声，是打包台上一单一单攒出来的' },
        ],
      },
    ],
  },
  {
    // 第一笔进账：支流门 0.5（进账年）。回款两档（落袋/滚动再投入），效果签名差异化。
    id: 'ven_first_profit',
    category: 'career',
    title: '第一笔进账',
    text: '手机震了一下，到账短信跳出来。{name}盯着那个数字看了很久——不是大钱，是第一笔别人为{name}的东西付的钱。',
    minAge: 25,
    maxAge: 50,
    cooldown: 2,
    weight: 12,
    requires: { tagsAny: ['entrepreneur'], ventureProfit: true },
    choices: [
      {
        text: '落袋。这一笔，存起来',
        summary: '{name}开了个新的账户专门存它。数字不大，意义全是自己的——原来真的有人愿意为这件事付钱',
        effects: [
          { money: 24000 },
          { attr: 'happiness', delta: 2 },
        ],
      },
      {
        text: '滚动进去，把钱变成下一批货',
        summary: '到账当天{name}就下了原料单。钱过一遍手就变成了仓库里的货——生意就该是这个转法',
        effects: [
          { money: 24000 },
          { attr: 'stress', delta: 1 },
        ],
        delayed: [{ years: 1, money: -16000, summary: '原料款如约划出，换回来的是更厚的订单' }],
      },
    ],
  },
  {
    // 护城河抉择：扩张=重投入押注（风险由既有关门/进账支流继续演绎）；守住=稳定小利。
    id: 'ven_scale_or_hold',
    category: 'career',
    title: '扩张还是守住',
    text: '小店 steady 跑了一年，账上第一次有了余钱。隔壁铺面的招租电话来得正好——扩，还是不扩？{name}在计算器上按了又清，清了又按。',
    minAge: 26,
    maxAge: 50,
    once: true,
    weight: 12,
    requires: { tagsAny: ['entrepreneur'] },
    choices: [
      {
        text: '扩张：把隔壁铺面拿下来',
        tooltip: '未来两年每年投入 25,000 元；更大的场子，更大的风浪',
        summary: '{name}在租约上签了字。新铺面的钥匙很凉，心很热——生意人总要有一次押上家的时刻',
        effects: [{ attr: 'stress', delta: 3 }],
        delayed: [
          { years: 1, money: -25000, summary: '新铺面的装修与押金，押上的是这三年攒下的底气' },
          { years: 2, money: -25000, summary: '两家店同时转，{name}瘦了一圈，眼睛却越来越亮' },
        ],
      },
      {
        text: '守住：把这一家店做深',
        summary: '{name}婉拒了招租电话，转头把老店的货架子重新排了一遍。稳稳的小利，稳稳的睡得着觉',
        effects: [],
        delayed: [
          { years: 1, money: 12000, summary: '老客带新客，年底一算，比去年多了这一笔' },
          { years: 2, money: 12000, summary: '小店的口碑在街坊里立住了——慢，但是自己的' },
        ],
      },
    ],
  },
  {
    // 关门抉择：支流门 0.4（风险年）。关门=biz_failed 标记；叙事禁羞辱化。
    id: 'vent_close_day',
    category: 'career',
    title: '关门的那天',
    text: '账算到第三遍，数字还是那个数字。{name}把卷帘门拉下来一半，站在半明半暗的店里，做了个决定。',
    minAge: 25,
    maxAge: 52,
    cooldown: 3,
    weight: 12,
    requires: { tagsAny: ['entrepreneur'], ventureClose: true },
    choices: [
      {
        text: '正式关门。这段路不算白走',
        summary: '卷帘门落锁的声音很轻。{name}把招牌小心拆下来包好——这段路不算白走，下一次走路，脚底会有数',
        effects: [
          { attr: 'happiness', delta: -4 },
        ],
        addTags: ['biz_failed'],
      },
      {
        text: '再撑一撑，把库清完再说',
        summary: '{name}把关门的日子又往后推了推。清仓的横幅挂出去，进店的人反而多了两个——先撑过这个季度',
        effects: [{ attr: 'stress', delta: 3 }],
      },
    ],
  },
  {
    // 重新上班：biz_failed 后的转身（设计偏差记录：startJob 硬门槛会静默 no-op 谎报入职，
    // 弃用；重入职交回既有求职事件链，本事件给补偿与过渡）。
    id: 'vent_back_to_work',
    category: 'career',
    title: '重新上班的人',
    text: '简历上那段「自主创业」写了两行。面试官盯着看了很久，问了个{name}没想到的问题：「这两年，你最大的教训是什么？」{name}笑了——这个能聊一整天。',
    minAge: 26,
    maxAge: 55,
    once: true,
    weight: 14,
    requires: { tagsAny: ['biz_failed'] },
    choices: [
      {
        text: '带着这段经历去面试老本行',
        summary: '面试官听完那段教训，在简历上圈了个记号。{name}走出门的时候知道：创业教会的东西，职场也认',
        effects: [
          { addSkill: { id: 'academics', delta: 3 } },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '先接零工过渡，边走边看',
        summary: '{name}接了几单零工，钱不多，日子却重新转起来了。停下来的人才输，走着的人都在路上',
        effects: [
          { money: 3000 },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
]
