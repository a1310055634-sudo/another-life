// 第 15 轮：中年内容扩充（31～50 岁，19 个独立事件）
// 五大主题：职业瓶颈（layoff_wave / age_trap / industry_shift）、
// 重新学习（vocational_cert）、财务责任（child_interest / school_district /
// mortgage_refit / installment_payoff / biz_payout）、
// 关系变化（marriage_flat / teen_door / friend_fade / abroad_reconnect /
// mentor_reversal / dream_rekindle / hometown_house）、
// 健康（old_injury / smoke_break / checkup_arrows）。
// 其中 8 个事件读取青年阶段标记（第 14 轮埋点 + 引擎职业标记）：
// layoff_wave←grinder、age_trap←job_hunting/laid_off、mentor_reversal←mentor_bond、
// biz_payout←biz_partner、installment_payoff←installment、dream_rekindle←dream_kept/
// dream_bloom/artist_path、abroad_reconnect←studied_abroad/exchanged、
// hometown_house←stay_hometown/stable_path。
// 转型语义保证：中年仍有重新入行（startJob）、考证升级（addSkills 延迟）、
// 旧伤根治（移除 chronic_pain）、压力戒烟替代（授予 routine_exercise）等主动出路。
// 新增标记：mid_pivot（成功转行）、repaid_mentor、health_comeback、dream_full、
// side_creates、overseas_bond、shop_dream（复用）、cared_for_parents（复用）。
// 第 27 轮：+1 纯氛围事件 mid_nav_memory（导航与记忆，效果极轻）。
// 第 28 轮：+8 中年危机带事件（35～45 岁，主题见区块注释）——
// young_boss / industry_collapse / second_child / sandwich / partner_career_gap /
// friend_fallout / budget_downgrade / reunion_compare；
// 其中 second_child 的延迟出生效果使用 RelationEffect.addAnother（二胎多孩语义）。
import type { GameEvent } from '../../engine/types'

export const MIDLIFE_EVENTS: GameEvent[] = [
  // ─── 职业瓶颈 ───────────────────────────────────────────
  {
    id: 'mid_layoff_wave',
    category: 'career',
    title: '优化名单在流传',
    text: '茶水间的消息从来最快：这季度要"优化"一批人。{name}的名字还没听见，但部门群里已经安静了好几天。',
    minAge: 31,
    maxAge: 48,
    once: true,
    weight: 9,
    requires: { careerKinds: ['employed'] },
    choices: [
      {
        text: '凭这些年的拼劲，跟老板立军令状',
        tooltip: '只有真正拼过的人才敢开这个口',
        summary: '{name}把这几年的成绩单拍在了桌上，名单绕开了这个工位',
        requires: { tagsAny: ['grinder'] },
        effects: [
          { attr: 'stress', delta: 6 },
          { attr: 'happiness', delta: -1 },
        ],
        addTags: ['survivor'],
      },
      {
        text: '自费报班，让自己无可替代',
        tooltip: '花钱换一身真本事',
        summary: '{name}把周末都填进了网课和作业里，工牌暂时还挂在胸前',
        effects: [
          { money: -6000 },
          { attr: 'stress', delta: 2 },
          { addSkill: { id: 'vocational', delta: 6 } },
        ],
        delayed: [
          { years: 1, addSkills: [{ id: 'academics', delta: 3 }], summary: '新课目学出了心得，简历厚了一页' },
        ],
      },
      {
        text: '拿 N+1 补偿，主动离开',
        tooltip: '拿钱走人，重新开始',
        summary: '{name}抱着纸箱走出大楼，赔偿金在账户里，前面的路在雾里',
        effects: [
          { loseJob: true },
          { money: 24000 },
          { attr: 'happiness', delta: -2 },
        ],
      },
    ],
  },
  {
    id: 'mid_age_trap',
    category: 'career',
    title: '三十五岁的简历',
    text: '招聘软件上投出去的简历大多石沉大海，偶尔一条回复，开头是"我们团队比较年轻"。{name}把年龄那一栏看了又看。',
    minAge: 32,
    maxAge: 48,
    once: true,
    weight: 11,
    requires: { careerKinds: ['unemployed'], tagsAny: ['job_hunting', 'laid_off'] },
    choices: [
      {
        text: '降薪求稳，先进小公司干着',
        tooltip: '手上有活儿就不慌',
        summary: '{name}进了家不大的公司，工资少了一截，心倒是落回了肚子里',
        requires: { minSkills: { vocational: 25 } },
        effects: [{ startJob: { jobId: 'warehouse_keeper' } }],
      },
      {
        text: '考个证，换个赛道重新来',
        tooltip: '先投入，一年后见真章',
        summary: '{name}的书桌上又摆上了教材，这次为自己而考',
        effects: [
          { money: -6000 },
          { attr: 'stress', delta: 3 },
        ],
        delayed: [
          { years: 1, addSkills: [{ id: 'vocational', delta: 10 }], summary: '证书到手，{name}在新的赛道上有了入场券' },
        ],
        addTags: ['mid_pivot'],
      },
      {
        text: '不打工了，摆摊创业',
        tooltip: '投入毕积蓄的一部分，自己当老板',
        summary: '{name}的摊位支了起来，风里雨里，都是自己的日子',
        effects: [
          { money: -15000 },
          { startJob: { jobId: 'stall_vendor' } },
          { attr: 'stress', delta: 4 },
          { attr: 'happiness', delta: 1 },
        ],
        addTags: ['mid_pivot', 'shop_dream'],
      },
      {
        text: '继续投简历，总会有的',
        summary: '{name}把简历又改了一版，继续等那通迟来的电话',
        effects: [
          { attr: 'stress', delta: 2 },
          { attr: 'happiness', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'mid_industry_shift',
    category: 'career',
    title: '行业的黄昏',
    text: '行业峰会的报道越读越像讣告：订单腰斩、工厂外迁。{name}在这行干了十几年，第一次认真想：要不要趁还来得及，换条船？',
    minAge: 31,
    maxAge: 50,
    once: true,
    weight: 8,
    requires: { careerKinds: ['employed'] },
    choices: [
      {
        text: '跟着网课自学编程，转去技术岗',
        tooltip: '需要本科以上学历和不错的学业功底',
        summary: '{name}的工位上多了块小白板，写着算法题',
        requires: { education: ['bachelor', 'master', 'phd'], minSkills: { academics: 55 } },
        effects: [
          { money: -8000 },
          { attr: 'stress', delta: 4 },
          { addSkill: { id: 'academics', delta: 5 } },
          { startJob: { jobId: 'junior_dev' } },
        ],
        addTags: ['mid_pivot'],
      },
      {
        text: '盘个小店，换种活法',
        tooltip: '辞职，投一笔钱开店',
        summary: '{name}的店开张那天，老同事来了一桌',
        effects: [
          { money: -25000 },
          { startJob: { jobId: 'stall_vendor' } },
          { attr: 'stress', delta: 4 },
          { attr: 'happiness', delta: 1 },
        ],
        addTags: ['mid_pivot', 'shop_dream'],
      },
      {
        text: '留在原行业死磕到底',
        summary: '{name}决定守着老本行，船沉不沉，先划了再说',
        effects: [
          { attr: 'stress', delta: 3 },
        ],
        delayed: [
          { years: 1, attr: 'happiness', delta: -2, summary: '行业还在下探，{name}偶尔会想起那两条没上的船' },
        ],
      },
    ],
  },
  // ─── 重新学习 ───────────────────────────────────────────
  {
    id: 'mid_vocational_cert',
    category: 'education',
    title: '四十岁的学徒',
    text: '街道职介所的门口挂出新横幅：技能培训班招生，电工、收纳师、养老护理。{name}在橱窗前站了很久——这个年纪重新当学徒，丢人吗？',
    minAge: 31,
    maxAge: 48,
    once: true,
    weight: 10,
    requires: { education: ['junior', 'highschool', 'college'] },
    choices: [
      {
        text: '报班考电工证，学门硬手艺',
        tooltip: '投入半年，一年后拿证',
        summary: '{name}和一群小年轻坐在同一间教室，笔记记得最厚',
        effects: [
          { money: -6000 },
          { attr: 'stress', delta: 3 },
        ],
        delayed: [
          { years: 1, addSkills: [{ id: 'vocational', delta: 12 }], summary: '电工证考了下来，{name}的手艺有了公章背书' },
        ],
        addTags: ['cert_track'],
      },
      {
        text: '学收纳师，帮人整理生活',
        tooltip: '轻投入，见效快',
        summary: '{name}的第一单做完了三小时，客户家里亮堂了，心里也是',
        effects: [
          { money: -2500 },
          { addSkill: { id: 'vocational', delta: 5 } },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '这个年纪了，算了吧',
        summary: '{name}把简章揉成一团扔进垃圾桶，走出两步又回头看了一眼',
        effects: [{ attr: 'happiness', delta: -2 }],
      },
    ],
  },
  // ─── 财务责任 ───────────────────────────────────────────
  {
    id: 'mid_child_interest',
    category: 'money',
    title: '兴趣班的缴费单',
    text: '孩子拿回一张兴趣班体验课的邀请卡，眼睛亮晶晶的。钢琴、绘画、跆拳道——每一样后面都跟着一串学费，体验课顾问的微信第二天就跟了上来："名额不多了哦。"{name}捏着单子，想起了自己小时候。',
    minAge: 32,
    maxAge: 46,
    once: true,
    requires: { tagsAll: ['has_child'] },
    choices: [
      {
        text: '全都报上，不能输在起跑线',
        tooltip: '钱包会疼一年',
        summary: '{name}的银行卡余额瘦了一圈，孩子的周末排满了课程',
        effects: [
          { money: -12000 },
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: 2 },
        ],
      },
      {
        text: '挑一个孩子最想学的',
        summary: '{name}蹲下来问孩子的想法，一起圈了一个班',
        effects: [
          { money: -5000 },
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: 4 } },
        ],
      },
      {
        text: '不报班，周末带娃去公园',
        summary: '{name}的童年没有兴趣班，孩子照样追着蝴蝶笑出了声',
        effects: [
          { relation: { kind: 'child', deltaCloseness: 6 } },
          { attr: 'happiness', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'mid_school_district',
    category: 'money',
    title: '学区的选择题',
    text: '中介的朋友圈刷出一条"老破小"：面积小、楼龄老，但门口就是重点小学。{name}盯着户型图，孩子未来的模样在脑子里转了一圈又一圈。',
    minAge: 31,
    maxAge: 45,
    once: true,
    requires: { tagsAll: ['has_child'] },
    choices: [
      {
        text: '咬牙买下学区房',
        tooltip: '需要 15 万以上存款，掏空六个钱包',
        summary: '{name}签完字手都是抖的，但孩子的学籍上写的是重点小学',
        requires: { moneyAtLeast: 150000 },
        effects: [
          { money: -130000 },
          { attr: 'stress', delta: 4 },
          { attr: 'happiness', delta: 1 },
        ],
        addTags: ['homeowner', 'school_district'],
      },
      {
        text: '在学校附近租房陪读',
        tooltip: '房东涨价的风险自己扛',
        summary: '{name}一家搬进了出租屋，走路十分钟到校门',
        effects: [
          { money: -24000 },
          { attr: 'stress', delta: 3 },
          { relation: { kind: 'child', deltaCloseness: 5 } },
        ],
      },
      {
        text: '不折腾，就近入学',
        summary: '{name}合上了电脑，家门口的学校也是学校',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'mid_mortgage_refit',
    category: 'money',
    title: '月供的对账单',
    text: '银行短信准时抵达：本月房贷已扣款。{name}望着对账单发呆——手里的闲钱，是提前还掉一笔，还是另作打算？',
    minAge: 31,
    maxAge: 50,
    cooldown: 4,
    requires: { tagsAll: ['homeowner'], mortgageBalanceAtLeast: 1 },
    choices: [
      {
        text: '提前还一笔本金',
        tooltip: '立刻划走 4 万元本金；余额不足 4 万则一次结清',
        summary: '{name}提交了提前还款申请，剩下的还款年限短了一截',
        effects: [
          { payMortgage: 40000 },
          { attr: 'stress', delta: -2 },
        ],
        delayed: [
          { years: 1, attr: 'happiness', delta: 3, summary: '还贷的年头短了一截，{name}的呼吸也轻了' },
        ],
      },
      {
        text: '把闲钱拿去理财',
        tooltip: '收益不一定跑得赢利率',
        summary: '{name}研究了一晚上理财产品，选了个中间档',
        effects: [
          { money: -30000 },
          { attr: 'stress', delta: 1 },
        ],
        delayed: [
          { years: 2, money: 5000, summary: '理财到期，收益虽然不惊艳，但确实是赚的' },
        ],
        addTags: ['prudent_investor'],
      },
      {
        text: '按部就班，不动了',
        summary: '{name}把对账单收好，日子照旧往前挪',
        effects: [{ attr: 'stress', delta: 1 }],
      },
    ],
  },
  {
    id: 'mid_installment_payoff',
    category: 'money',
    title: '分期的最后一期',
    text: '记账APP弹出提醒：当年咬牙上新机型的分期，还剩尾巴没清。{name}看着那串数字，像看见几年前那个冲动的自己。',
    minAge: 31,
    maxAge: 42,
    once: true,
    requires: { tagsAny: ['installment'] },
    choices: [
      {
        text: '一次结清，跟冲动消费告别',
        summary: '{name}点了全额还款，账户瘦了，心里痛快了',
        effects: [
          { money: -9000 },
          { attr: 'stress', delta: -3 },
          { attr: 'happiness', delta: 2 },
        ],
        removeTags: ['installment'],
      },
      {
        text: '按月慢慢还，不伤筋动骨',
        summary: '{name}设好了自动还款，让分期自己走完最后一程',
        effects: [{ attr: 'stress', delta: 1 }],
        delayed: [
          { years: 1, money: -4500, repeat: 1, summary: '分期又扣了一期，尾巴越来越短' },
        ],
      },
      {
        text: '顺手又看中了新机型',
        tooltip: '旧债未清，新债又起',
        summary: '{name}预约了今年的新机型，记账APP沉默地看着这一切',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'mid_biz_payout',
    category: 'money',
    title: '驿站的散伙饭',
    text: '发小在电话里沉默了很久才开口：驿站的转让费谈好了，散伙饭就定在周六。当年那份"利润四六开"的约定，到了算总账的时候。',
    minAge: 31,
    maxAge: 46,
    once: true,
    requires: { tagsAny: ['biz_partner'] },
    choices: [
      {
        text: '好聚好散，按约拿回本金',
        summary: '{name}和发小碰了杯，转账到账的提示音响得恰到好处',
        effects: [
          { money: 15000 },
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'friend', deltaCloseness: -3 } },
        ],
      },
      {
        text: '份额低价转给发小，交情不散',
        summary: '{name}少拿了三万块，发小红着眼眶说"这份情我记着"',
        effects: [
          { money: 8000 },
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'friend', deltaCloseness: 10 } },
        ],
      },
      {
        text: '再撑两年，说不准就回血了',
        tooltip: '再投一笔，赌一个好转',
        summary: '{name}把转让合同推了回去，驿站的灯又亮了一晚',
        effects: [
          { money: -6000 },
          { attr: 'stress', delta: 3 },
        ],
        delayed: [
          { years: 2, money: 18000, summary: '驿站终于回血，{name}的坚持换来了分红' },
        ],
      },
    ],
  },
  // ─── 关系变化 ───────────────────────────────────────────
  {
    id: 'mid_marriage_flat',
    category: 'relationship',
    title: '结婚十周年',
    text: '日历提醒：今天是{name}和TA的结婚纪念日。餐桌上两个人各自刷着手机，谁也没先开口——好像该说点什么，又好像说什么都多余。',
    minAge: 31,
    maxAge: 48,
    once: true,
    weight: 11,
    requires: { tagsAll: ['married'] },
    choices: [
      {
        text: '补一场两个人的旅行',
        tooltip: '把孩子交给老人，花一笔钱',
        summary: '{name}在酒店前台改签了一晚，有些话在山和海之间才说得出口',
        effects: [
          { money: -12000 },
          { relation: { kind: 'spouse', deltaCloseness: 12 } },
          { attr: 'happiness', delta: 4 },
          { attr: 'stress', delta: -2 },
        ],
      },
      {
        text: '报个双人班，一起学点新东西',
        summary: '{name}和TA成了同桌，笔记互抄，笑点也重新对上了',
        effects: [
          { money: -4000 },
          { relation: { kind: 'spouse', deltaCloseness: 8 } },
          { attr: 'happiness', delta: 2 },
        ],
      },
      {
        text: '太累了，各忙各的吧',
        summary: '纪念日就这样翻了过去，谁也没提，谁也没忘',
        effects: [
          { relation: { kind: 'spouse', deltaCloseness: -8 } },
          { attr: 'happiness', delta: -2 },
        ],
      },
    ],
  },
  {
    id: 'mid_teen_door',
    category: 'relationship',
    title: '青春期的房门',
    text: '孩子的房门越来越多地关着，门缝里的灯光和手机屏幕一样，让人看不清。{name}端着切好的水果，在门口站了很久。',
    minAge: 33,
    maxAge: 50,
    once: true,
    requires: { tagsAll: ['has_child'] },
    choices: [
      {
        text: '在门缝下塞一封信',
        summary: '第二天，门缝下多了一张回条：谢谢，芒果很好吃',
        effects: [
          { relation: { kind: 'child', deltaCloseness: 8 } },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '立规矩：吃饭时必须出门',
        summary: '饭桌上安静得能听见筷子碰碗的声音',
        effects: [
          { relation: { kind: 'child', deltaCloseness: -10 } },
          { attr: 'stress', delta: 4 },
        ],
      },
      {
        text: '请孩子信任的长辈来聊聊',
        tooltip: '需要一定的交际手腕',
        summary: '舅舅来了趟家里，走的时候孩子主动把门开了条缝',
        requires: { minAttr: { social: 50 } },
        effects: [
          { relation: { kind: 'child', deltaCloseness: 5 } },
          { attr: 'social', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'mid_mentor_reversal',
    category: 'relationship',
    title: '当年的师傅来求助',
    text: '微信弹出一条久违的消息，是当年手把手带{name}入门的那位师傅：最近公司动荡，年纪大了被优先"优化"，想问问你这边有没有门路。',
    minAge: 31,
    maxAge: 50,
    once: true,
    weight: 12,
    requires: { tagsAny: ['mentor_bond'] },
    choices: [
      {
        text: '借TA两万块渡过难关',
        tooltip: '师傅欠下的这笔，会慢慢还',
        summary: '{name}转完钱只回了四个字：您带我入门的',
        effects: [
          { money: -20000 },
          { attr: 'happiness', delta: 2 },
        ],
        delayed: [
          { years: 2, money: 8000, summary: '师傅分几笔把钱还了回来，附赠一封长信' },
        ],
        addTags: ['repaid_mentor'],
      },
      {
        text: '动用人脉帮TA内荐',
        tooltip: '需要不错的交际能力',
        summary: '三通电话之后，师傅有了新东家的面试机会',
        requires: { minAttr: { social: 55 } },
        effects: [
          { money: -2000 },
          { attr: 'social', delta: 1 },
          { attr: 'happiness', delta: 3 },
        ],
        addTags: ['repaid_mentor'],
      },
      {
        text: '为难得复，婉拒了',
        summary: '{name}打了又删的回复最终只有一句"帮不上，抱歉"',
        effects: [
          { attr: 'happiness', delta: -3 },
          { attr: 'stress', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'mid_dream_rekindle',
    category: 'life',
    title: '落灰的画架',
    text: '搬东西时翻出了那副画架，颜料干成了小山。这些年它一直跟着{name}搬家、换工作、换城市，像一句没说完的话。',
    minAge: 31,
    maxAge: 50,
    once: true,
    weight: 11,
    requires: { tagsAny: ['dream_kept', 'dream_bloom', 'artist_path'] },
    choices: [
      {
        text: '辞职，全职去创作',
        tooltip: '把人生押给热爱，这次是成年人版本',
        summary: '{name}的画架重新支了起来，就支在客厅采光最好的地方',
        effects: [
          { quitJob: true },
          { money: -10000 },
          { attr: 'happiness', delta: 6 },
          { attr: 'stress', delta: 3 },
        ],
        addTags: ['dream_full'],
      },
      {
        text: '把作品摆上周末市集',
        tooltip: '副业起步，看看市场买不买账',
        summary: '市集摊位前停下了不少人，{name}卖出了三张明信片',
        effects: [
          { money: -3000 },
          { attr: 'stress', delta: 2 },
          { attr: 'happiness', delta: 2 },
        ],
        delayed: [
          { years: 1, money: 6000, summary: '周末市集的回头客让摊位回了本，还小赚了一笔' },
        ],
        addTags: ['side_creates'],
      },
      {
        text: '擦干净，再收起来',
        summary: '{name}把画架擦得干干净净，又放回了柜顶',
        effects: [{ attr: 'happiness', delta: -3 }],
      },
    ],
  },
  {
    id: 'mid_friend_fade',
    category: 'relationship',
    title: '点赞之交',
    text: '深夜刷朋友圈，老友晒出了孩子的奖状。{name}手指在键盘上停了停，最后只点了个赞——上一次见面，好像还是三年前。',
    minAge: 31,
    maxAge: 50,
    cooldown: 5,
    weight: 11,
    choices: [
      {
        text: '张罗一场老友局',
        tooltip: '钱是小钱，局是难局',
        summary: '包间里笑声不断，散场时约好了"下个月还来"',
        effects: [
          { money: -3000 },
          { relation: { kind: 'friend', deltaCloseness: 15 } },
          { attr: 'social', delta: 2 },
          { attr: 'happiness', delta: 3 },
        ],
      },
      {
        text: '退出同学群，清净',
        summary: '退群的那一瞬间，世界安静了，也空了一块',
        effects: [
          { relation: { kind: 'friend', deltaCloseness: -10 } },
          { attr: 'stress', delta: -2 },
        ],
      },
      {
        text: '各自安好，便是安好',
        summary: '{name}关掉了朋友圈，有些友情就放在那里吧',
        effects: [{ attr: 'happiness', delta: -1 }],
      },
    ],
  },
  {
    id: 'mid_abroad_reconnect',
    category: 'relationship',
    title: '海外同学群',
    text: '当年一起交换、一起留学的老同学在群里张罗聚会，照片里有人开了公司，有人回了国，有人在地球另一端晒着极光。',
    minAge: 31,
    maxAge: 50,
    once: true,
    weight: 11,
    requires: { tagsAny: ['studied_abroad', 'exchanged'] },
    choices: [
      {
        text: '入股老同学的公司',
        tooltip: '需要 4 万以上存款，两年后见分晓',
        summary: '{name}签了入股协议，群里多了个"合伙人"头衔',
        requires: { moneyAtLeast: 40000 },
        effects: [
          { money: -30000 },
          { attr: 'stress', delta: 3 },
        ],
        delayed: [
          { years: 2, money: 45000, summary: '老同学的公司拿下了大客户，{name}的这份投资翻了倍' },
        ],
        addTags: ['overseas_bond'],
      },
      {
        text: '维持人脉，静候机会',
        summary: '{name}认真回复了每条消息，通讯录里多了一群"靠谱的人"',
        effects: [
          { attr: 'social', delta: 3 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '静静退了群',
        summary: '{name}看完了全部聊天记录，然后按下了退群',
        effects: [{ attr: 'happiness', delta: -1 }],
      },
    ],
  },
  {
    id: 'mid_hometown_house',
    category: 'life',
    title: '老家的宅基地',
    text: '父亲的视频电话里絮絮叨叨：屋顶又漏了，村里都在翻新房。镜头晃了晃，扫过房梁上那道新补的水痕。{name}在城里待了这么多年，老家的那栋房子，还是结婚时翻修过的样子。',
    minAge: 32,
    maxAge: 50,
    once: true,
    weight: 11,
    requires: { tagsAny: ['stay_hometown', 'stable_path'] },
    choices: [
      {
        text: '出钱翻新，接父母住进去',
        tooltip: '大额支出，换来一间自己的房和父母的晚年',
        summary: '新房封顶那天，父亲放了一挂很长的鞭炮',
        effects: [
          { money: -60000 },
          { relation: { kind: 'parent', deltaCloseness: 12 } },
          { attr: 'happiness', delta: 3 },
        ],
        addTags: ['homeowner', 'cared_for_parents'],
      },
      {
        text: '改成农家乐，自己做生意',
        tooltip: '投一笔钱，赌乡村游的风口',
        summary: '{name}的老屋挂上了招牌，第一个周末来了两桌客人',
        effects: [
          { money: -30000 },
          { attr: 'stress', delta: 3 },
        ],
        delayed: [
          { years: 2, money: 15000, summary: '农家乐的口碑做起来了，账上开始有结余' },
        ],
        addTags: ['shop_dream'],
      },
      {
        text: '先放着，攒钱要紧',
        summary: '{name}给父亲转了两千块修屋顶，长久的打算往后推了推',
        effects: [
          { attr: 'stress', delta: 1 },
          { attr: 'happiness', delta: -1 },
        ],
      },
    ],
  },
  // ─── 健康 ───────────────────────────────────────────────
  {
    id: 'mid_old_injury',
    category: 'health',
    title: '拖了十年的旧伤',
    text: '阴雨天，膝盖里那处旧伤又开始隐隐作痛。医生说过很多次：手术能根治，但要卧床小一个月，还得花一笔钱。{name}一拖就是十年。',
    minAge: 31,
    maxAge: 50,
    once: true,
    weight: 12,
    requires: { tagsAny: ['chronic_pain'] },
    choices: [
      {
        text: '彻底手术，跟旧伤做个了断',
        tooltip: '花一笔大钱，换一劳永逸',
        summary: '手术很顺利，{name}在病床上盘算着痊愈后的第一场球',
        effects: [
          { money: -25000 },
          { attr: 'health', delta: -2 },
          { attr: 'stress', delta: -1 },
        ],
        delayed: [
          { years: 1, attr: 'health', delta: 8, summary: '拆了钢板，{name}十年没这么轻快过' },
        ],
        removeTags: ['chronic_pain'],
        addTags: ['health_comeback'],
      },
      {
        text: '报个康复训练年卡，慢慢养',
        tooltip: '每年一笔小钱，健康稳步回来',
        summary: '{name}成了康复中心的常客，教练比他小十岁，喊他"叔"',
        effects: [
          { attr: 'stress', delta: -1 },
        ],
        delayed: [
          { years: 1, money: -3000, repeat: 2, summary: '康复训练又续了一期，膝盖听使唤多了' },
        ],
        addTags: ['rehab_program'],
      },
      {
        text: '忍着吧，习惯就好',
        summary: '{name}往膝盖上贴了片膏药，日子照旧',
        effects: [{ attr: 'stress', delta: 2 }],
        delayed: [
          { years: 1, attr: 'health', delta: -4, summary: '阴雨天疼得睡不着的夜晚越来越多' },
        ],
      },
    ],
  },
  {
    id: 'mid_smoke_break',
    category: 'health',
    title: '楼道里的打火机',
    text: '加班到十点，楼道里碰到同样下班的同事，他递来一支烟："就一根，解解乏。"打火机的火苗在暗处跳了一下。',
    minAge: 31,
    maxAge: 50,
    cooldown: 4,
    weight: 10,
    requires: { minAttr: { stress: 55 } },
    choices: [
      {
        text: '接过烟，就一根',
        summary: '烟圈散进夜色里，{name}的肩膀松了半寸，喉咙有点痒',
        effects: [
          { attr: 'stress', delta: -5 },
          { attr: 'happiness', delta: 2 },
        ],
        addTags: ['light_smoker'],
      },
      {
        text: '摆摆手，嚼片口香糖',
        summary: '{name}把口香糖嚼出了烟的架势，同事笑着把烟收了回去',
        effects: [{ attr: 'stress', delta: -1 }],
      },
      {
        text: '不抽了，下楼跑两圈',
        summary: '{name}绕着园区跑了两圈，汗出透的那一刻，烟瘾也散了',
        effects: [
          { attr: 'stress', delta: -3 },
          { attr: 'health', delta: 1 },
        ],
        addTags: ['routine_exercise'],
      },
    ],
  },
  {
    id: 'mid_checkup_arrows',
    category: 'health',
    title: '体检单上的红箭头',
    text: '年度体检报告出来了，好几个指标后面跟着向上的箭头。医生的字迹潦草但结论清楚：复查、调理、少熬夜。{name}盯着那页纸看了很久。',
    minAge: 34,
    maxAge: 50,
    once: true,
    weight: 12,
    choices: [
      {
        text: '住院复查，系统调理',
        tooltip: '花一笔钱，把箭头压回去',
        summary: '复查结果出来了，大部分箭头被{name}用一个月的自律按了回去',
        effects: [
          { money: -9000 },
          { attr: 'stress', delta: -1 },
        ],
        delayed: [
          { years: 1, attr: 'health', delta: 4, summary: '调理见了效，{name}爬五楼不再喘了' },
        ],
      },
      {
        text: '买一堆保健品图个安心',
        summary: '保健品摆满了半张桌子，{name}的心理安慰到位了',
        effects: [
          { money: -6000 },
          { attr: 'happiness', delta: 2 },
          { attr: 'health', delta: 1 },
        ],
      },
      {
        text: '报告塞进抽屉，眼不见心不烦',
        summary: '抽屉合上的声音很轻，{name}却在半夜醒来摸了两次胸口',
        effects: [{ attr: 'stress', delta: 3 }],
        delayed: [
          { years: 1, attr: 'health', delta: -4, summary: '那些被无视的箭头，在身体里继续往上飘' },
        ],
        addTags: ['avoided_doctor'],
      },
    ],
  },
  // ─── 时代氛围（第 27 轮：纯氛围事件，无机制效果或极轻） ───
  {
    id: 'mid_nav_memory',
    category: 'life',
    title: '导航说左转，记忆说直走',
    text: '去老城区办点事，导航一遍遍催着左转，{name}却记得直走那条巷子里有家开了三十年的面馆。手机说三分钟，记忆说：绕一下，也值。',
    minAge: 31,
    maxAge: 50,
    weight: 6,
    cooldown: 6,
    choices: [
      {
        text: '听导航的，办事要紧',
        summary: '{name}准时办完了事，那碗面的香味只在等红灯时飘过一下',
        effects: [{ attr: 'stress', delta: -1 }],
      },
      {
        text: '关掉导航，凭记忆绕一段',
        summary: '面馆还在，味道没怎么变，{name}吃得比约的时间晚了半小时',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: 1 },
        ],
      },
      {
        text: '把定位发进老同学群，约下次一起来',
        summary: '消息发出去，群里一下冒出七八条"算我一个"',
        effects: [{ attr: 'social', delta: 1 }],
      },
    ],
  },
  // ─── 中年危机带加密（第 28 轮：35～45 岁，8 个独立事件）────────
  // 主题：职场危机（young_boss 职级倒挂 / industry_collapse 行业塌方）、
  // 家庭结构（second_child 二胎抉择 / sandwich 上有老下有小 / partner_career_gap 配偶职场空窗）、
  // 友情与对照（friend_fallout 中年友尽 / reunion_compare 同学会）、
  // 房贷挤压（budget_downgrade 消费降级，资格=房贷余额>0，第 23 轮模型的直接消费者）。
  // 全部满足：≥2 有效选项（负债隐藏大额后仍剩 2）、真实状态门槛、
  // 无对应家庭结构时不触发（single/无孩线看不到二胎与挤压）。
  // 引擎侧新增 RelationEffect.addAnother（第 26 轮遗留的二胎多孩语义）：
  // 仅 second_child 的延迟出生效果使用，普通 add 的 V1 语义不变。
  {
    id: 'mid_young_boss',
    category: 'career',
    title: '空降的年轻领导',
    text: '新部门的头儿比{name}小六岁，开会张口就是新词，散会时客气地拍拍{name}的肩："叔/姨，有想法多提。"{name}笑着一一应下，回工位的路上有点不是滋味。',
    minAge: 35,
    maxAge: 45,
    once: true,
    weight: 10,
    requires: { careerKinds: ['employed'] },
    choices: [
      {
        text: '放下身段，跟年轻人学新工具',
        summary: '{name}把新软件一样样啃了下来，小领导后来逢人就说：这是我见过最肯学的老同志',
        effects: [
          { attr: 'smarts', delta: 2 },
          { attr: 'stress', delta: 1 },
          { addSkill: { id: 'vocational', delta: 3 } },
        ],
      },
      {
        text: '拿资历硬顶到底',
        tooltip: '老资历是本钱，也可能是包袱',
        summary: '{name}的方案一次次在会上被"再研究"，核心项目一个个绕开了这个工位',
        effects: [
          { attr: 'stress', delta: 4 },
        ],
        delayed: [
          { years: 1, attr: 'happiness', delta: -3, summary: '被边缘化的滋味，{name}在工位上尝了一整年' },
        ],
      },
      {
        text: '骑驴找马，悄悄把简历挂出去',
        summary: '{name}更新了简历、设了免打扰，日子照常过，眼睛开始留意窗外的机会',
        effects: [
          { attr: 'stress', delta: 1 },
        ],
        addTags: ['job_hunting'],
      },
    ],
  },
  {
    id: 'mid_industry_collapse',
    category: 'career',
    title: '行业塌方的那一周',
    text: '头部企业连环暴雷的新闻挂了三天热搜，同行群一个个改名成"互助群"。公司账上的钱还能撑几个月，没人说得准。{name}在这行干了十几年，第一次看清整条船的水线。',
    minAge: 35,
    maxAge: 45,
    once: true,
    weight: 9,
    requires: { careerKinds: ['employed'] },
    choices: [
      {
        text: '拿补偿趁早下车',
        tooltip: '赔一笔遣散费，从头再来',
        summary: '{name}抱着纸箱走出大楼，补偿金到账的短信响得干脆，前面的路从头画起',
        effects: [
          { loseJob: true },
          { money: 18000 },
          { attr: 'stress', delta: 2 },
        ],
      },
      {
        text: '边上班边考跨行业证书',
        tooltip: '真本事不随行业沉没',
        summary: '{name}把通勤地铁变成了自习室，行业群静悄悄，学习群倒热闹起来',
        effects: [
          { money: -5000 },
          { attr: 'stress', delta: 2 },
          { addSkill: { id: 'vocational', delta: 3 } },
        ],
        delayed: [
          { years: 1, addSkills: [{ id: 'vocational', delta: 8 }], summary: '跨行业的证书考了下来，{name}进可攻退可守' },
        ],
        addTags: ['cert_track'],
      },
      {
        text: '把身家押上，跟公司赌最后一把',
        tooltip: '再投一笔钱进去，赌行业出清后活下来的是自己人',
        summary: '{name}把转账回执设成了手机壁纸，每天进门先看一眼',
        effects: [
          { money: -12000 },
          { attr: 'stress', delta: 4 },
        ],
        delayed: [
          { years: 2, money: 26000, summary: '行业出清，公司活了下来，{name}的坚持连本带利回了账' },
        ],
      },
    ],
  },
  {
    id: 'mid_second_child',
    category: 'relationship',
    title: '二胎的选择题',
    text: '饭桌上，TA又提起了那个搁置了两年的话题："要不要给大宝添个伴？"{name}扒着碗里的饭，脑子里转的是房贷、补习费和两个人的精力。',
    minAge: 35,
    maxAge: 45,
    once: true,
    weight: 11,
    requires: { relationKinds: ['spouse'], tagsAll: ['has_child'] },
    choices: [
      {
        text: '要，给大宝添个伴',
        tooltip: '备孕产检是一笔开销，往后夜里睡整觉的日子更少了',
        summary: '{name}和TA把婴儿床又擦了一遍，大宝趴在旁边研究：弟弟还是妹妹？',
        effects: [
          { money: -5000 },
          { attr: 'stress', delta: 2 },
        ],
        delayed: [
          {
            years: 1,
            relation: { kind: 'child', add: true, addAnother: true, name: '小宝', closeness: 60 },
            summary: '小宝出生了，家里一下子更热闹了',
          },
          { years: 1, attr: 'happiness', delta: 5, summary: '' },
        ],
      },
      {
        text: '不要了，把全部心力留给大宝',
        summary: '{name}和TA聊到深夜，最后一起想通了：把一个人的爱给足，也是完整',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: 3 } },
        ],
      },
      {
        text: '再给彼此一年时间商量',
        summary: '{name}和TA约定不再互相催促，把这道题留在明年的饭桌上',
        effects: [
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'spouse', deltaCloseness: 2 } },
        ],
      },
    ],
  },
  {
    id: 'mid_sandwich',
    category: 'money',
    title: '同一天来的两张账单',
    text: '孩子的补习班续费提醒和父亲复查的缴费单，前后脚躺在手机里。上有老下有小的年纪，{name}第一次体会到"夹心层"三个字有多具体。',
    minAge: 35,
    maxAge: 45,
    cooldown: 4,
    weight: 11,
    // minCloseness 取 0 是「该关系有存活对象」的 AND 存在性检查（relationKinds 是 OR，
    // 表达不了"孩子与父母都在"）——夹心层事件要求两头都在场
    requires: { tagsAll: ['has_child'], minCloseness: { child: 0, parent: 0 } },
    choices: [
      {
        text: '两头都不省，咬牙都撑住',
        tooltip: '钱和精力一起透支',
        summary: '{name}把两张单子都付了，深吸一口气——撑住这个家的人，暂时还轮不到别人',
        effects: [
          { money: -9000 },
          { attr: 'stress', delta: 3 },
          { attr: 'happiness', delta: -1 },
          { relation: { kind: 'child', deltaCloseness: 2 } },
          { relation: { kind: 'parent', deltaCloseness: 4 } },
        ],
      },
      {
        text: '护工照旧，孩子的班减两节',
        summary: '{name}和孩子谈了谈，孩子嘟囔了两句，周末照样缠着去打球——钱省下了，天没塌',
        effects: [
          { money: -2800 },
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: -2 } },
          { relation: { kind: 'parent', deltaCloseness: 3 } },
        ],
      },
      {
        text: '老的先拖一拖，小的不能停',
        summary: '父亲的复查又推了半年，电话里说"没事没事"，{name}挂了电话半天没说话',
        effects: [
          { money: -1200 },
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'parent', deltaCloseness: -8 } },
        ],
      },
    ],
  },
  {
    id: 'mid_partner_career_gap',
    category: 'relationship',
    title: 'TA 的职场停下来了',
    text: 'TA的工位收拾进了纸箱，回家路上TA说"正好歇歇"，可那晚客厅的灯亮到很晚。{name}想把话说出口，又怕说错。',
    minAge: 35,
    maxAge: 45,
    cooldown: 4,
    weight: 9,
    requires: { relationKinds: ['spouse'] },
    choices: [
      {
        text: '把TA的社保接过来，自己缴',
        tooltip: '一笔固定开销，换来TA的踏实',
        summary: '{name}把缴费记录截图发给TA："你只管歇好，这些我来。"那晚TA睡得很沉',
        effects: [
          { money: -6000 },
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'spouse', deltaCloseness: 6 } },
        ],
      },
      {
        text: '鼓励TA趁这段时间学点想学的',
        summary: '{name}把落灰的书桌重新收拾出来，TA报的名到了，饭桌上的话题也多了',
        effects: [
          { money: -1500 },
          { relation: { kind: 'spouse', deltaCloseness: 4 } },
        ],
        delayed: [
          { years: 1, attr: 'happiness', delta: 3, summary: 'TA的新证书下来了，人也重新亮了起来' },
        ],
      },
      {
        text: '谁也不提这事，各自硬扛',
        summary: '饭桌上只有筷子碰碗的声音，两个人都在等对方先开口，一等就是半年',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'spouse', deltaCloseness: -6 } },
        ],
      },
    ],
  },
  {
    id: 'mid_friend_fallout',
    category: 'relationship',
    title: '老友开口借钱之后',
    text: '老友生意翻了车，饭吃到一半开了口，一借就是五万。上回那三千块，到今天还没个说法。{name}握着茶杯，这两年的交情和这么多年的账，一起压在了桌上。',
    minAge: 35,
    maxAge: 45,
    once: true,
    weight: 9,
    requires: { relationKinds: ['friend'], maxCloseness: { friend: 55 } },
    choices: [
      {
        text: '再帮最后一次',
        tooltip: '钱借出去，情分能不能回来另说',
        summary: '{name}把卡号要了过来，转账备注写了四个字：兄弟保重',
        effects: [
          { money: -10000 },
          { relation: { kind: 'friend', deltaCloseness: 6 } },
          { attr: 'stress', delta: 1 },
        ],
        delayed: [
          { years: 2, money: 6000, summary: '老友分两笔还了一半，剩下的一半，谁都没再提' },
        ],
      },
      {
        text: '当面把两笔账一起算清',
        tooltip: '这笔钱要不回来，这段友情也就到这了',
        summary: '{name}把两笔账一笔笔摆上桌，话说完，杯子里的茶再没人动过——有的友情，结账就是散场',
        effects: [
          { relation: { kind: 'friend', deltaCloseness: -60 } },
          { attr: 'stress', delta: 2 },
          { attr: 'happiness', delta: -2 },
        ],
      },
      {
        text: '钱不借，旧账也不再提',
        summary: '{name}只回了句"手头也紧"，两个人心照不宣地换了个话题，然后慢慢没了话题',
        effects: [
          { relation: { kind: 'friend', deltaCloseness: -12 } },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'mid_budget_downgrade',
    category: 'money',
    title: '月供挤压下的账本',
    text: '房贷扣款短信和信用卡账单前后脚到，{name}把这一年的开销拉了张清单——有些数字，不看不知道，一看坐不住了。',
    minAge: 35,
    maxAge: 45,
    once: true,
    weight: 9,
    requires: { mortgageBalanceAtLeast: 1 },
    choices: [
      {
        text: '全家消费降级：健身卡退了，外卖停了',
        tooltip: '日子紧一紧，年底能看出差别',
        summary: '{name}把订阅服务一条条取消，饭盒重新上岗——钱包紧了，心里反而有了底',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: -2 },
        ],
        delayed: [
          { years: 1, money: 6000, summary: '年底一算账，降级省下的钱真攒出来了一笔' },
        ],
      },
      {
        text: '周末接零工，专门补月供',
        tooltip: '辛苦钱，见得着现',
        summary: '{name}的周末被网约车和代驾排满，月供到账那天，辛苦都值了',
        effects: [
          { attr: 'stress', delta: 3 },
          { attr: 'health', delta: -1 },
        ],
        delayed: [
          { years: 1, money: 9000, summary: '零工的钱正好补上了两个月的供，{name}的车里常备着眼药水' },
        ],
      },
      {
        text: '跟TA把账摊开，一起想办法',
        tooltip: '需要有人在身边一起扛',
        summary: '{name}把两张账单摆在饭桌上，TA看完只说了句"还有我"——那天晚上聊到后半夜，账还是那些账，人不一样了',
        requires: { relationKinds: ['spouse'] },
        effects: [
          { attr: 'stress', delta: -1 },
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'spouse', deltaCloseness: 5 } },
        ],
      },
    ],
  },
  {
    id: 'mid_reunion_compare',
    category: 'life',
    title: '同学会的圆桌',
    text: '班长在群里发起了毕业聚会的接龙，底下跟了一长串"1"。有人开了公司，有人评了职称，也有人三年没冒过泡。{name}盯着那个"1"字，手指悬了很久。',
    minAge: 35,
    maxAge: 45,
    once: true,
    weight: 10,
    choices: [
      {
        text: '去赴约，敬每位当年并肩的人',
        summary: '酒过三巡，头衔和房价都聊完了，留下来的还是当年那点情分——{name}没白来',
        effects: [
          { money: -2000 },
          { attr: 'social', delta: 2 },
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'friend', deltaCloseness: 6 } },
        ],
      },
      {
        text: '包桌做东，体面地撑一次场',
        tooltip: '需要 2 万以上存款，一顿饭吃掉小半年积蓄',
        summary: '{name}抢着买了单，班长拍着肩膀说"还是你有出息"——散场时的热闹，{name}记了很久',
        requires: { moneyAtLeast: 20000 },
        effects: [
          { money: -15000 },
          { attr: 'social', delta: 1 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'friend', deltaCloseness: 10 } },
        ],
      },
      {
        text: '不去，把群设成免打扰',
        summary: '{name}退出了接龙，安静是安静了，那天夜里还是把旧照片翻了一遍',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: -1 },
        ],
      },
    ],
  },
  // ── 第 68 轮：倦怠与心理韧性线（事件授予制——过载顶点授予 burnout，应对事件消费）──
  {
    id: 'mid_burnout_onset',
    category: 'health',
    title: '过载的顶点',
    text: '第三个通宵后的清晨，{name}站在地铁里，看着玻璃上映出的那张脸——眼神是空的。身体在报警，声音很大，大到装不听见都难。',
    minAge: 31,
    maxAge: 48,
    cooldown: 4,
    weight: 10,
    priority: 2,
    requires: { careerKinds: ['employed'], minAttr: { stress: 90 }, tagsNone: ['burnout'] },
    choices: [
      {
        text: '扛住，把这一季忙完再说',
        tooltip: '身体会记下这笔账',
        summary: '{name}又熬了下去，只是笑的时候，眼睛已经不参与了',
        effects: [
          { attr: 'health', delta: -2 },
          { attr: 'happiness', delta: -3 },
        ],
        addTags: ['burnout'],
      },
      {
        text: '请两周病假，认真休息',
        summary: '病假条递上去的那一刻，{name}睡了出生以来最沉的一觉',
        effects: [
          { money: -3000 },
          { attr: 'stress', delta: -12 },
        ],
      },
      {
        text: '请年假进山待几天',
        summary: '山里没有信号。第三天，{name}居然睡着了',
        effects: [
          { money: -2000 },
          { attr: 'stress', delta: -10 },
          { attr: 'happiness', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'mid_burnout_insomnia',
    category: 'health',
    title: '凌晨三点的天花板',
    text: '身体累到散架，脑子却像开了闸。{name}数了一夜天花板的纹路，天亮时终于睡着——闹钟响了。',
    minAge: 31,
    maxAge: 48,
    cooldown: 2,
    weight: 12,
    priority: 2,
    requires: { tagsAll: ['burnout'] },
    choices: [
      {
        text: '睡前把手机放在客厅',
        summary: '头几天翻来覆去，第十天，{name}十一点就困了',
        effects: [
          { attr: 'stress', delta: -4 },
          { attr: 'health', delta: 1 },
        ],
      },
      {
        text: '听白噪音，早点躺下',
        summary: '雨声盖过了脑子里那些没完没了的待办',
        effects: [{ attr: 'stress', delta: -3 }],
      },
      {
        text: '睡不着就接着干',
        summary: '夜更深了，待办更多了，天更快亮了',
        effects: [
          { attr: 'health', delta: -2 },
          { attr: 'stress', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'mid_burnout_slump',
    category: 'career',
    title: '键盘上使不上力',
    text: '曾经两小时搞定的方案，现在一整天都憋不出一页。{name}盯着屏幕上的光标闪啊闪，第一次理解了「力不从心」这四个字有多具体。',
    minAge: 31,
    maxAge: 48,
    cooldown: 3,
    weight: 10,
    requires: { careerKinds: ['employed'], tagsAll: ['burnout'] },
    choices: [
      {
        text: '和领导交底，申请调去轻松岗',
        tooltip: '薪水让一步，人先稳住',
        summary: '新岗位节奏慢了三成，{name}的下班时间终于有了下限',
        effects: [
          { salaryMul: 0.95 },
          { attr: 'stress', delta: -8 },
        ],
      },
      {
        text: '请年假透口气再说',
        summary: '假期结束那天，{name}删掉了草稿箱里那封辞职信',
        effects: [
          { money: -1500 },
          { attr: 'stress', delta: -6 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '强撑，用加班证明自己',
        summary: '考勤表很好看，体检表很难看',
        effects: [
          { salaryMul: 1.02 },
          { attr: 'health', delta: -2 },
          { attr: 'stress', delta: 4 },
        ],
      },
    ],
  },
  {
    id: 'mid_burnout_therapy',
    category: 'health',
    title: '咨询室的白沙发',
    text: '第一次坐下的时候，{name}说「我可能就是矫情」。咨询师没有反驳，只是问：「矫情会让人连续失眠四个月吗？」房间里安静了很久。',
    minAge: 31,
    maxAge: 48,
    cooldown: 2,
    weight: 11,
    requires: { tagsAll: ['burnout'] },
    choices: [
      {
        text: '坚持咨询一个季度',
        tooltip: '每年数千元，修的是自己的功课',
        summary: '第八次咨询，{name}说出了那句憋了三年的「我撑不住了」',
        effects: [
          { money: -1200 },
          { attr: 'stress', delta: -10 },
          { attr: 'happiness', delta: 3 },
        ],
        removeTags: ['burnout'],
      },
      {
        text: '试一次，就算了',
        summary: '{name}说「下次再来」——咨询室的门，开了又关',
        effects: [
          { money: -500 },
          { attr: 'stress', delta: -3 },
        ],
      },
    ],
  },
  {
    id: 'mid_burnout_sabbatical',
    category: 'life',
    title: '存折和年假，总得动一个',
    text: '医生把检查单推过来，措辞很委婉，意思很明确。{name}忽然意识到：这份工作少了谁都能转，这个身体垮了就真的垮了。',
    minAge: 31,
    maxAge: 48,
    cooldown: 4,
    weight: 9,
    requires: { careerKinds: ['employed'], tagsAll: ['burnout'] },
    choices: [
      {
        text: '休三个月，把命捡回来',
        tooltip: '需要一笔存款兜底',
        summary: '{name}删掉了工作群。第一个月睡，第二个月走，第三个月开始想吃什么',
        effects: [
          { money: -12000 },
          { attr: 'stress', delta: -15 },
          { attr: 'health', delta: 2 },
          { attr: 'happiness', delta: 5 },
        ],
        removeTags: ['burnout'],
        requires: { moneyAtLeast: 12000 },
      },
      {
        text: '休一个月，省着花',
        summary: '一个月不长，但足够把呼吸调回自己的节奏',
        effects: [
          { money: -4000 },
          { attr: 'stress', delta: -8 },
        ],
      },
      {
        text: '不休，事找人总比人找事强',
        summary: '{name}把检查单折起来放进了抽屉最深处',
        effects: [{ attr: 'stress', delta: 3 }],
      },
    ],
  },
  // ── 第 70 轮：时代纵深 II 纯氛围（31-38）——直播间里的购物车 ──
  {
    id: 'mid_livestream_cart',
    category: 'life',
    title: '直播间里的购物车',
    text: '「最后三单！家人们把【要】打在公屏上！」主播的嗓门穿过手机听筒，倒计时牌红得发烫。{name}本来只想看看纸巾的价格，购物车却已经躺了五件东西。',
    minAge: 31,
    maxAge: 38,
    weight: 7,
    cooldown: 5,
    choices: [
      {
        text: '限时价确实便宜，拼一单',
        summary: '纸巾洗衣液到货堆了半个人高——够用到大半年后',
        effects: [
          { money: -200 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '冷静退出，把购物车清空',
        summary: '{name}退出一看时间：十一点半。刚才那五件，一件都没必要',
        effects: [{ attr: 'stress', delta: -1 }],
      },
    ],
  },
  {
    id: 'mid_rideshare_story',
    category: 'life',
    title: '网约车后座的夜归',
    text: '加完班叫的车。司机从后视镜里瞥了一眼：「又加班？我以前也这样。」方向盘一转，他讲起自己怎么从写字楼里出来开网约车——「现在拉的不是客，是自由」。',
    minAge: 40,
    maxAge: 48,
    weight: 7,
    cooldown: 5,
    choices: [
      {
        text: '聊了一路，下车道声「祝顺利」',
        summary: '陌生人的晚上也有故事。{name}下车时，把「差不多得了」咽了回去',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
      {
        text: '闭上眼听完这首歌就好',
        summary: '电台里的老歌放完，车也到了。有些疲惫，音乐管一半',
        effects: [{ attr: 'stress', delta: -1 }],
      },
    ],
  },

  // ── 第 101 轮：时代纵深 III 纯氛围 2 枚（46-58 桶补密 + 时代词表落地）──
  // 依据：age_heatmap 46-55 桶覆盖 137、专属 0（窗口全被更宽事件覆盖），
  // 且 R101 词表 +8 中「考公上岸/灵活就业/直播带货/副业刚需/断舍离」五词
  // 全池 0 命中（词形与文本不一致 = 扫描矛盾，A2 判零矛盾须清）。
  // 撞题扫描：既有mid_livestream_cart 是 31-38 岁「买购物车」侧，
  // 本条走「做卖货的从业侧」，年龄窗亦不重叠；mc_free_lance 是 35-50 岁
  // 自由职业（机制向），本条为纯氛围、年龄窗 46+ 不重叠。
  {
    id: 'mid_exam_anchor_wait',
    category: 'life',
    title: '面试完出来的那条消息',
    text: '「感谢您的投递」——邮箱里躺着一封没有下文的通知。桌上摊着行测的卷子，边上是从小摊上买的一碗面。同龄人里这两年考公上岸的不少，{name}把这行字看了三遍，然后把手机扣过去。',
    minAge: 42,
    maxAge: 50,
    weight: 6,
    cooldown: 10,
    choices: [
      {
        text: '把行测的书重新摆好，下半年接着考',
        summary: '书角压了卷子，卷子又压了别的日子，{name}没打算算这笔账',
        effects: [{ attr: 'stress', delta: 1 }],
      },
      {
        text: '给老同学打个电话，不谈工作',
        summary: '两人从天气聊到房价，谁也没提那封邮件。挂了电话，{name}觉得松快了些',
        effects: [{ attr: 'social', delta: 1 }, { attr: 'stress', delta: -1 }],
      },
      {
        text: '算了，找份先做着，别让家里跟着悬着',
        summary: '海投的第一天就回了两封，{name}把它们归到同一个文件夹里，不看了',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    id: 'mid_livestream_works',
    category: 'life',
    title: '下班后开一场直播',
    text: '同事在办公室做起了直播带货，一个月下的提成比工资还高。{name}动了心，买了一盏补光灯，先从「不露脸，只讲怎么挑」开始试。群里两百人在线那天，{name}第一次听见自己被叫「家人们」。',
    minAge: 41,
    maxAge: 50,
    weight: 6,
    cooldown: 10,
    choices: [
      {
        text: '坚持做下去，把它当正经副业',
        summary: '半年后补光灯换成了第二盏，{name}给自己记了个流水账，数字比预想的好看',
        effects: [{ money: 1500 }, { attr: 'happiness', delta: 1 }],
      },
      {
        text: '试了两次，还是算了',
        summary: '不赚钱倒不打紧，主要是每晚十点对着镜头说话这件事，{name}实在不习惯',
        effects: [{ attr: 'stress', delta: 1 }],
      },
      {
        text: '不播，把家里旧物一件件清掉',
        summary: '断舍离到第三个箱子时，{name}翻出大学时的球衣，站了很久，最后还是放进了捐赠袋',
        effects: [{ attr: 'happiness', delta: -1 }],
      },
    ],
  },
  {
    id: 'mid_gig_and_downsizing',
    category: 'life',
    title: '一笔接来的一单',
    text: '以前同事的消息：「有个活儿，你帮我顶一下，按天结。」接下来这一周，{name}白天照常上班，晚上到家接单到后半夜——副业刚需这一年，班是这么上的。同事的鸡汤群里，有人晒着工资条，有人算着每月花掉的钱：后面这种，得体地叫作消费降级；前面那种，叫作灵活就业。',
    minAge: 40,
    maxAge: 50,
    weight: 6,
    cooldown: 8,
    choices: [
      {
        text: '接下副业，多一笔收入',
        summary: '副业刚需这一年，{name}的账本比以往任何一年都厚，代价是睡觉',
        effects: [{ money: 1200 }, { attr: 'stress', delta: 2 }],
      },
      {
        text: '婉拒，主业已经够忙了',
        summary: '{name}回了句「最近实在排不开」，发完把手机调了静音',
        effects: [{ attr: 'stress', delta: -1 }],
      },
      {
        text: '不接单，把开支也一并减掉',
        summary: '外食停了、订阅停了、旅行停了。断舍离之后的日子谈不上好，但夜里睡得着',
        effects: [{ attr: 'happiness', delta: -1 }, { attr: 'stress', delta: -2 }],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 第 102 轮：事件池扩容收尾 · 薄处补密（46-55 桶「专属覆盖」实测为 0，本组 2 枚窗口取 [46,50]）
  // → 窗口完全落在 46-55 桶内 → 该桶专属数 0→2（midlife.ts maxAge ≤ 50 硬约束下能取到的最优窗口；
  // 若取 [44,50] 只会进「覆盖」不进「专属」，等于白补）。
  // 撞题扫描：「一整天的空闲」全池仅 3 命中（mid_burnout_slump / late_silver_rework /
  // pet_vet_visit），无一是「什么都没做的一整天」；「工作收尾与交接」仅 1 命中（mc_moat，
  // 且属 midcareer 而非本文件的 40+ 段）。
  // 硬约束：minAge ≥ 31、maxAge ≤ 50（midlife.test.ts）；**不得引用任何青年标记**
  // （midlife.test.ts 对 go_big_city / stable_path / grinder / mentor_bond / biz_partner
  // 等 YOUTH_MARKERS 相关的固定名单有精确断言）。
  // ═══════════════════════════════════════════════════════════════════

  // 一整天空转：与 mid_burnout_slump（倦怠触发后的应付）区别在于——本局不写 burnout，写的是没有触发任何事件的空白
  {
    id: 'mid_empty_day',
    category: 'life',
    title: '一整天，什么也没发生',
    text: '闹钟响了，起来，吃了早饭，坐了一上午，中午下楼买了份饭，下午又坐回去了。一天结束时{name}回想这一天，发现想不起一件发生过的事。',
    minAge: 46,
    maxAge: 50,
    cooldown: 6,
    weight: 9,
    choices: [
      {
        text: '第二天给自己排点事',
        tooltip: '逛个没去过的公园也算',
        summary: '周末去了趟植物园，走了一整天，晚上睡得很沉',
        effects: [
          { money: -200 },
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: -2 },
        ],
      },
      {
        text: '就这么待着，也挺好',
        summary: '什么也不做的一天，第二天还是这么一天',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
      {
        text: '开始回想：这些年是不是都这样',
        summary: '这个念头一冒出来，一整天都没能好好过完',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: 2 },
        ],
      },
    ],
  },

  // 工作收尾：不是 mc_moat 的「守壁垒」，而是「把自己手上的活交出去」这一动作本身
  {
    id: 'mid_handover_year',
    category: 'career',
    title: '把这摊事交出去',
    text: '上面问到什么时候能接新的方向，问得很客气。{name}心里清楚这句话的潜台词：先把旧的做完。摊子在这儿，二十来年的做法、几个人的名字、一堆只有自己记得的规矩。',
    minAge: 46,
    maxAge: 50,
    cooldown: 6,
    weight: 8,
    choices: [
      {
        text: '认真交，手把手带半年',
        tooltip: '留一份写下来的东西，比口头说一百遍管用',
        summary: '交接文档写了三十页，半年后那边没再打来问过一个问题',
        effects: [
          { attr: 'social', delta: 2 },
          { attr: 'stress', delta: -2 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '三天交完，多一天都是消耗',
        summary: '交接会开了四十分钟。走的时候没人送，也没人拦',
        effects: [
          { attr: 'stress', delta: -3 },
          { attr: 'happiness', delta: -1 },
        ],
      },
      {
        text: '先不交，等看清上面的意思',
        summary: '这事就这么压着，桌上多了一份写了没发的方案',
        effects: [
          { attr: 'stress', delta: 2 },
          { attr: 'happiness', delta: -1 },
        ],
      },
    ],
  },
]
