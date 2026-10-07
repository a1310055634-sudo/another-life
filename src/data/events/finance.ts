// 第 10 轮：财务事件（7 个）
// 设计主线：短期利益 vs 长期后果。修旧件省钱但后续更贵（fin_broken_scooter）、
// 快钱伤身 vs 技能长期收益（fin_side_hustle）、骗局割韭菜 vs 小仓位试水（fin_invest_pitch）、
// 负债者的四条出路（fin_debt_calls）、富裕线的人情债（fin_relative_borrow）、
// 一次性大投入换持续现金流（fin_shopfront，landlord 标记接 finance.ts 年租结算）、
// 拖延小病拖成大钱（fin_molar_root_canal）。
// 负债（money<0）时即时支出 ≥3000 的选项由引擎自动隐藏（events.ts isBigSpend），
// 每个事件都保留至少一个零支出选项，负债玩家不会看到一堆点不了的按钮。
import type { GameEvent } from '../../engine/types'

export const FINANCE_EVENTS: GameEvent[] = [
  {
    id: 'fin_broken_scooter',
    category: 'money',
    title: '电动车罢工了',
    text: '通勤的老电动车在一个早晨彻底没了声息。修车铺老板瞟了一眼："电机烧了，修不如换。"{name}盯着手里安全帽的划痕盘算起来。',
    minAge: 18,
    maxAge: 55,
    cooldown: 5,
    weight: 9,
    requires: { careerKinds: ['employed', 'none', 'unemployed'] },
    choices: [
      {
        text: '换个二手电机凑合用',
        tooltip: '眼前最省，但便宜货靠不住',
        summary: '{name}的电动车又突突地跑了起来，只是噪音比以前大了一圈',
        effects: [
          { money: -1200 },
          { attr: 'stress', delta: 2 },
        ],
        delayed: [{ years: 1, money: -2800, summary: '二手电机还是罢工了，这回连带着电瓶一起换' }],
      },
      {
        text: '咬牙换辆新的',
        tooltip: '一次到位，骑得也踏实',
        summary: '{name}提了辆新车，通勤路上终于不用看运气了',
        effects: [
          { money: -6000 },
          { attr: 'happiness', delta: 2 },
          { attr: 'health', delta: 1 },
        ],
        requires: { moneyAtLeast: 6000 },
      },
      {
        text: '不修了，改挤公交地铁',
        summary: '{name}把车卖给了收废品的，每天在站台背单词背得津津有味',
        effects: [
          { money: 300 },
          { attr: 'health', delta: 2 },
          { attr: 'stress', delta: 1 },
          { attr: 'happiness', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'fin_side_hustle',
    category: 'money',
    title: '下班后的两小时',
    text: '晚上八点到十点，是刷手机还是干点什么？群里有人晒出跑代驾的流水，也有人晒出接修图单子的收款记录。{name}的手指在屏幕上停了很久。',
    minAge: 20,
    maxAge: 45,
    // 第 19 轮重复清点：同一个群里晒同一种流水的场景不该每四年重播一次；
    // 下班后时间的取舍是一次性表态，快钱/技能线另有深夜外卖、夜校班等事件承接。
    once: true,
    weight: 9,
    requires: { careerKinds: ['employed', 'none', 'unemployed'] },
    choices: [
      {
        text: '晚上跑代驾，先挣眼前的快钱',
        tooltip: '来钱快，但熬夜伤身',
        summary: '{name}的代驾账单月月见涨，只是黑眼圈也跟着见涨',
        effects: [
          { money: 9000 },
          { attr: 'stress', delta: 4 },
          { attr: 'health', delta: -2 },
        ],
      },
      {
        text: '报班学接单技能，慢就是快',
        tooltip: '先投入，技能在以后许多年都值钱',
        summary: '{name}的深夜时间换成了网课和练习稿',
        effects: [
          { money: -2000 },
          { attr: 'stress', delta: 2 },
          { addSkill: { id: 'vocational', delta: 2 } },
        ],
        delayed: [{ years: 1, addSkills: [{ id: 'vocational', delta: 3 }], summary: '几个月的练习结了果，{name}接到了第一单外包' }],
      },
      {
        text: '不折腾了，这两小时留给家人',
        summary: '{name}把手机扣在桌上，陪家人把那部老剧追完了',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'parent', deltaCloseness: 3 } },
        ],
      },
    ],
  },
  {
    id: 'fin_invest_pitch',
    category: 'money',
    title: '「稳赚不赔」的项目',
    text: '老同学的饭局上有人掏出手机："这个平台年化 30%，我进去大半年了，天天都能提现。"{name}盯着那根一路向上的收益曲线，心跳快了半拍。',
    minAge: 22,
    maxAge: 58,
    cooldown: 6,
    weight: 8,
    requires: { moneyAtLeast: 15000 },
    choices: [
      {
        text: '大手笔投进去，搏一把大的',
        tooltip: '高收益的话术，往往有人在暗处标好了价格',
        summary: '{name}把大半积蓄转了进去，头一个月的收益数字确实好看',
        effects: [
          { money: -50000 },
          { attr: 'stress', delta: 5 },
        ],
        delayed: [{ years: 2, money: 8000, attr: 'happiness', delta: -3, summary: '「稳赚」平台暴雷了，两年拉扯只追回 8,000 元' }],
        requires: { moneyAtLeast: 50000 },
        addTags: ['scam_victim'],
      },
      {
        text: '只拿小钱试水，输了就当学费',
        tooltip: '仓位小，输得起也学得到',
        summary: '{name}转了一万块进去，每天看盘半小时，倒把市场脾气摸了个大概',
        effects: [
          { money: -10000 },
          { attr: 'smarts', delta: 2 },
        ],
        delayed: [{ years: 2, money: 12500, summary: '小仓位跟着行情走了一程，落袋为安' }],
        requires: { moneyAtLeast: 20000 },
        addTags: ['prudent_investor'],
      },
      {
        text: '看穿话术，转身就走',
        summary: '{name}问了一句"提现要交保证金吗"，饭桌安静了几秒',
        effects: [
          { attr: 'smarts', delta: 3 },
          { attr: 'stress', delta: -1 },
        ],
        addTags: ['scam_skeptic'],
      },
    ],
  },
  {
    id: 'fin_debt_calls',
    category: 'money',
    title: '响个不停的催收电话',
    text: '陌生号码一天打进来七八个，短信里的措辞越来越难听。{name}把手机翻过去扣在桌上，可震动声还是顺着桌面传进耳朵里。',
    minAge: 18,
    maxAge: 60,
    cooldown: 3,
    weight: 10,
    requires: { moneyBelow: -20000 },
    choices: [
      {
        text: '跟家里开口，先把窟窿堵上一块',
        tooltip: '家里能帮衬，但这份情不好受',
        summary: '{name}在电话里支支吾吾半天，那头只说了一句"发卡号来"',
        effects: [
          { money: 15000 },
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'parent', deltaCloseness: -6 } },
        ],
        requires: { relationKinds: ['parent'] },
        addTags: ['borrowed_family'],
      },
      {
        text: '以贷养贷，先把这个月糊弄过去',
        tooltip: '新债的利息，会比旧债更咬人',
        summary: '{name}在三个借款软件之间来回倒腾，账目连自己都看不清了',
        effects: [
          { money: 8000 },
          { attr: 'stress', delta: 4 },
        ],
        delayed: [{ years: 1, money: -10000, summary: '新债的利息滚上来了，比想象中咬人得多' }],
        addTags: ['debt_spiral'],
      },
      {
        text: '白天上班晚上跑单，自己往外爬',
        tooltip: '辛苦，但每一步都算数',
        summary: '{name}的手机计步器天天霸榜，债务表上第一次出现了下降的箭头',
        effects: [
          { money: 6000 },
          { attr: 'stress', delta: 5 },
          { attr: 'health', delta: -3 },
          { addSkill: { id: 'vocational', delta: 2 } },
        ],
      },
      {
        text: '谁也不告诉，自己硬扛',
        summary: '{name}学会了在楼道里接电话，声音压得比夜还低',
        effects: [
          { attr: 'stress', delta: 6 },
          { attr: 'health', delta: -2 },
          { attr: 'happiness', delta: -3 },
        ],
      },
    ],
  },
  {
    id: 'fin_relative_borrow',
    category: 'money',
    title: '亲戚开口了',
    text: '多年不怎么走动的堂哥突然打来电话，寒暄了十分钟才绕到正题："生意上周转不开，能不能借三万？年底一定还。"{name}看了眼自己的存款余额。',
    minAge: 26,
    maxAge: 60,
    // 第 19 轮重复清点：同一位堂哥借同一笔三万、同一个"年底一定还"——一次就好
    once: true,
    weight: 8,
    requires: { moneyAtLeast: 100000 },
    choices: [
      {
        text: '借他三万，救急如救火',
        tooltip: '钱能回来，也可能回不来',
        summary: '{name}转完账只回了个"拿去用"，堂哥连发了三个抱拳的表情',
        effects: [
          { money: -30000 },
          { attr: 'social', delta: 2 },
        ],
        delayed: [{ years: 3, money: 30000, attr: 'happiness', delta: 2, summary: '堂哥的生意缓过来了，如约把钱送了回来' }],
        addTags: ['lent_family'],
      },
      {
        text: '包个一万五的红包，不指望还',
        summary: '{name}说"这钱不用还了"，两家的走动反倒比从前勤了',
        effects: [
          { money: -15000 },
          { attr: 'social', delta: 3 },
          { attr: 'happiness', delta: 1 },
        ],
        addTags: ['generous'],
      },
      {
        text: '婉拒：救急不救穷，钱是底线',
        summary: '{name}把话说得客气又清楚，挂了电话心里松了口气',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'social', delta: -1 },
        ],
        addTags: ['kept_boundary'],
      },
    ],
  },
  {
    id: 'fin_shopfront',
    category: 'money',
    title: '老街的转让铺面',
    text: '老街拐角的铺面挂出了"旺铺转让"，位置不差，隔壁药店和快餐店的人流都从这里过。中介搓着手："过完这个村，可就没这个店了。"',
    minAge: 30,
    maxAge: 55,
    once: true,
    weight: 8,
    requires: { moneyAtLeast: 200000 },
    choices: [
      {
        text: '全款盘下，安安稳稳收租',
        tooltip: '一笔大投入，换来每年稳定的租金',
        summary: '{name}拿到钥匙那天在铺子里站了很久，盘算着往后每一年的租金',
        effects: [
          { money: -250000 },
          { attr: 'stress', delta: 2 },
        ],
        requires: { moneyAtLeast: 250000 },
        addTags: ['landlord', 'shop_owner'],
      },
      {
        text: '贷款盘下，赌未来的现金流',
        tooltip: '手头留下的钱多，但未来三年要咬牙还贷',
        summary: '{name}在贷款合同上签了字，铺面的钥匙和还款计划表一起放进抽屉',
        effects: [
          { money: -80000 },
          { attr: 'stress', delta: 4 },
        ],
        delayed: [
          { years: 1, money: -60000, summary: '银行准时划走了第一笔铺面贷款' },
          { years: 2, money: -60000, summary: '第二笔铺面贷款按时划扣' },
          { years: 3, money: -60000, summary: '最后一笔贷款结清，铺面彻底是自己的了' },
        ],
        addTags: ['landlord', 'shop_owner', 'leveraged_buy'],
      },
      {
        text: '放弃，钱还是放在理财里安心',
        summary: '{name}请中介喝了杯茶，把安全感留在了卡里',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'smarts', delta: 1 },
        ],
        delayed: [{ years: 2, money: 9000, summary: '理财的收益不算惊艳，但睡得着觉' }],
        addTags: ['prudent_saver'],
      },
    ],
  },
  {
    id: 'fin_molar_root_canal',
    category: 'money',
    title: '拖不得的牙',
    text: '后槽牙的钝痛断断续续一个月了，最近半夜也开始疼。诊所的朋友看了眼说："这颗牙再拖，就不是补的事了。"',
    minAge: 20,
    maxAge: 70,
    cooldown: 6,
    weight: 8,
    choices: [
      {
        text: '先吃止痛药扛着，忙过这阵再说',
        tooltip: '现在不花钱，以后连本带利',
        summary: '{name}的床头多了一盒止痛药，那颗牙安静了，也知道它在憋着什么',
        effects: [
          { attr: 'health', delta: -3 },
        ],
        delayed: [{ years: 2, money: -9000, attr: 'health', delta: -2, summary: '牙疼拖成了急症，半夜挂了急诊，花的钱是当初的三倍' }],
        addTags: ['avoided_doctor'],
      },
      {
        text: '正规治疗，一次解决',
        summary: '{name}躺在牙椅上半小时，出来时觉得整个世界都清爽了',
        effects: [
          { money: -4000 },
          { attr: 'health', delta: 3 },
        ],
      },
      {
        text: '一步到位做种植，省了后患',
        tooltip: '贵有贵的道理',
        summary: '{name}的新牙用起来和原装的没差别，吃嘛嘛香',
        effects: [
          { money: -15000 },
          { attr: 'health', delta: 4 },
          { attr: 'happiness', delta: 2 },
        ],
        requires: { moneyAtLeast: 15000 },
      },
    ],
  },
  // 第 13 轮因果链：fin_invest_pitch「大手笔投进去」(scam_victim) → 本事件。
  // 受骗经历改写之后的选择：同样的话术，摔过跟头的人听得懂弦外之音。
  {
    id: 'fin_scam_aftermath',
    category: 'money',
    title: '又有人来「带赚钱」了',
    text: '两年前在「稳赚」平台上摔的跟头，疼劲还没全忘。如今酒桌上又有人掏出手机，屏幕上还是那根熟悉的、一路向上的收益曲线。{name}端着杯子没说话。',
    minAge: 24,
    maxAge: 60,
    once: true,
    weight: 10,
    requires: { tagsAny: ['scam_victim'] },
    choices: [
      {
        text: '一句话点破，顺手举报',
        tooltip: '摔过的跟头，至少要摔得明白',
        summary: '{name}问了句"提现要交保证金吗"，和当年自己听到的一模一样',
        effects: [
          { attr: 'smarts', delta: 2 },
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: -1 },
        ],
        addTags: ['scam_skeptic'],
      },
      {
        text: '散席后，把防骗提醒发进家人群',
        summary: '{name}把那套话术拆成三条发在群里，表姐回了个"已转发相亲群"',
        effects: [
          { attr: 'social', delta: 3 },
          { attr: 'happiness', delta: 1 },
        ],
        delayed: [{ years: 1, attr: 'happiness', delta: 1, summary: '群里有人说，照着{name}那条提醒认出了新骗局' }],
      },
      {
        text: '没接话，只是想起自己追不回的钱',
        summary: '那顿饭后面上了什么菜，{name}一口都没尝出来',
        effects: [
          { attr: 'stress', delta: 2 },
          { attr: 'happiness', delta: -1 },
        ],
      },
    ],
  },
  // 第 13 轮因果链：fin_debt_calls「以贷养贷」(debt_spiral) → 本事件（债务出口，兼修
  // 已知问题"深负债长线无破产保护"）。priority 4：危机事件优先入卡。
  {
    id: 'fin_debt_bottom',
    category: 'money',
    title: '债务的尽头',
    text: '借款软件的额度终于全部点成了灰色。{name}把所有欠条、账单和催收记录摊在桌上，第一次不是算"这个月怎么过"，而是算"这辈子还不还得清"。',
    minAge: 18,
    maxAge: 60,
    once: true,
    weight: 12,
    priority: 4,
    requires: { tagsAll: ['debt_spiral'], moneyBelow: -40000 },
    choices: [
      {
        text: '找正规机构做债务整理，分期三年还本金',
        tooltip: '利息罚金一笔勾销，但三年日子都得勒紧',
        summary: '方案谈下来的那天，{name}把利息罚金的数字划掉，只留了本金',
        effects: [
          { money: 30000 },
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: -2 },
        ],
        delayed: [
          { years: 1, money: -11000, summary: '第一笔整理还款按时划出' },
          { years: 2, money: -11000, summary: '第二笔整理还款按时划出' },
          { years: 3, money: -11000, summary: '最后一笔整理还款结清，{name}撕掉了欠款清单' },
        ],
        removeTags: ['debt_spiral'],
      },
      {
        text: '让家里做最后一次兜底',
        tooltip: '能立刻上岸，但这份情要记很多年',
        summary: '母亲在电话那头沉默了很久，只说"这次是最后一次，啊？"',
        effects: [
          { money: 40000 },
          { attr: 'happiness', delta: -3 },
          { relation: { kind: 'parent', deltaCloseness: -12 } },
        ],
        requires: { relationKinds: ['parent'] },
        removeTags: ['debt_spiral'],
        addTags: ['borrowed_family'],
      },
      {
        text: '不借任何人一分钱，删掉软件自己还',
        summary: '{name}把手机清得干干净净，第二天开始接晚班单',
        effects: [
          { attr: 'stress', delta: 3 },
          { attr: 'health', delta: -2 },
          { addSkill: { id: 'vocational', delta: 2 } },
        ],
        delayed: [{ years: 1, attr: 'health', delta: -1, summary: '没日没夜地接单，身体又开始报警' }],
        removeTags: ['debt_spiral'],
      },
    ],
  },
  // 第 13 轮因果链：youth_first_salary_splurge(saver) / fin_shopfront(prudent_saver) /
  // fin_invest_pitch(prudent_investor) → 本事件。储蓄习惯攒出的"底气"变成新机会。
  {
    id: 'fin_compound_habit',
    category: 'money',
    title: '存下来的底气',
    text: '银行客户经理翻着{name}的流水，抬眼说："您这存款习惯，比大多数客户都好。有个配置方案，您要不要听听？"',
    minAge: 26,
    maxAge: 58,
    once: true,
    weight: 9,
    requires: { tagsAny: ['saver', 'prudent_saver', 'prudent_investor'], moneyAtLeast: 30000 },
    choices: [
      {
        text: '分成三份：应急、稳健、进取',
        tooltip: '两年后见分晓，学到的比赚到的更多',
        summary: '{name}把存款分成三份，给每一份都写了个名字',
        effects: [
          { money: -20000 },
          { attr: 'smarts', delta: 2 },
        ],
        delayed: [{ years: 2, money: 26000, attr: 'happiness', delta: 1, summary: '三份钱的答卷交了出来：赚得不算多，睡得着觉' }],
      },
      {
        text: '转成大额存单，只求个安心',
        summary: '{name}选了最 boring 的那个选项，客户经理笑着盖了章',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
        delayed: [{ years: 2, money: 4500, summary: '大额存单到期，利息不多，但一分没少' }],
      },
      {
        text: '取一笔出来，带家里人出去走走',
        summary: '存折上的数字小了一圈，饭桌上的笑声大了一圈',
        effects: [
          { money: -12000 },
          { attr: 'happiness', delta: 4 },
          { relation: { kind: 'parent', deltaCloseness: 4 } },
        ],
      },
    ],
  },
]
