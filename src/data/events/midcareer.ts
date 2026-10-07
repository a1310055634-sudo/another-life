// 第 89 轮（V5）：35 岁危机与行业寒冬事件线——市场域中年职业风险（与既有
// car_industry_winter「压力泛写」差异化：本线是裁员落地/35+再就业/护城河反线）。
// 体制内豁免：全部 requires tagsNone civil_servant（第 88 轮门控通道）。
// 补偿金按任务书修正口径=静态分档近似（数千至数万），不做动态工资计算。
// 纯事件轮：loseJob/quitJob/salaryMul/minAcademics 全为既有效果通道，引擎零改动。
import type { GameEvent } from '../../engine/types'

export const MIDCAREER_EVENTS: GameEvent[] = [
  {
    id: 'mc_layoff',
    category: 'career',
    title: '优化名单',
    text: 'HR 的会议邀请没有写议题。会议室里坐着的还有法务——{name}瞬间就明白了。「公司业务调整，你的岗位被优化了，N+1 的方案在这里。」',
    minAge: 33,
    maxAge: 40,
    once: true,
    weight: 18,
    requires: { careerKinds: ['employed'], tagsNone: ['civil_servant'] },
    choices: [
      {
        text: '签了。拿补偿走人',
        tooltip: '补偿金约 25,000 元（静态分档近似），即刻失业',
        summary: '{name}在方案上签了字。25,000 块补偿金到账的那天，朋友圈里全是转发的招聘帖',
        effects: [
          { money: 25000 },
          { attr: 'happiness', delta: -3 },
          { attr: 'stress', delta: 2 },
          { loseJob: true },
        ],
      },
      {
        text: '不接受，耗着争取留下',
        tooltip: '僵持消耗：身心俱疲，薪资下调暂保岗位',
        summary: '{name}拒绝签字，天天正常打卡。一个月后公司妥协了——岗位保住，薪水打折，人也熬脱了一层皮',
        effects: [
          { attr: 'stress', delta: 5 },
          { attr: 'health', delta: -1 },
          { salaryMul: 0.9 },
        ],
      },
    ],
  },
  {
    id: 'mc_bench',
    category: 'career',
    title: '去「战略研究部」报到',
    text: '组织架构调整的邮件里，{name}的名字被划进了新成立的「战略研究部」——没有业务、没有下属，工位挪到了打印机旁边。所有人都知道这意味着什么。',
    minAge: 33,
    maxAge: 40,
    cooldown: 4,
    weight: 18,
    requires: { careerKinds: ['employed'], tagsNone: ['civil_servant'] },
    choices: [
      {
        text: '坐冷板凳，趁机考证充电',
        tooltip: '清闲但憋屈，功底在涨',
        summary: '{name}把冷板凳坐成了自习室，工位抽屉里压着厚厚的题库',
        effects: [
          { attr: 'stress', delta: 1 },
          { addSkill: { id: 'academics', delta: 2 } },
        ],
      },
      {
        text: '主动请缨去业务一线硬仗',
        summary: '{name}敲开了业务负责人的门。苦活累活自己揽，图的是名单上永远有自己',
        effects: [
          { attr: 'stress', delta: 3 },
          { attr: 'health', delta: -1 },
          { attr: 'social', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'mc_resume',
    category: 'career',
    title: '已读不回的简历',
    text: '投出去第四十七份简历，已读不回。猎头朋友说了实话：「35 岁往上，简历先过机器这一关。你这个年纪，要么管理岗，要么技术专家，中间层最难。」',
    minAge: 35,
    maxAge: 50,
    cooldown: 3,
    weight: 14,
    requires: { careerKinds: ['unemployed'] },
    choices: [
      {
        text: '考个证，把门槛踩实',
        tooltip: '支出 3,000 元，功底涨',
        summary: '{name}报了证的书和网课，把等回复的时间换成了刷题时间',
        effects: [
          { money: -3000 },
          { addSkill: { id: 'academics', delta: 3 } },
          { attr: 'stress', delta: 1 },
        ],
      },
      {
        text: '放下身段，从基础岗投起',
        summary: '{name}把期望薪资改成了原来的一半。电话开始响了，虽然岗位比从前低了两级',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: -1 },
          { attr: 'social', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'mc_free_lance',
    category: 'career',
    title: '给自己打工的第一天',
    text: '老东家的竞业协议到期了，{name}算了算手里的接单邀约——够吃到年底。全职单干，没有五险一金，也没有开不完的会。',
    minAge: 35,
    maxAge: 50,
    once: true,
    requires: { careerKinds: ['unemployed'] },
    choices: [
      {
        text: 'all in 自由职业',
        tooltip: '首年接单收入 6,000 元，压力不小',
        summary: '{name}把客厅改成工作室。没有打卡机，也没有下班时间',
        effects: [
          { money: 6000 },
          { attr: 'stress', delta: 2 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '先接零活，同时继续投简历',
        summary: '{name}白天跑面试，晚上接小单。两条腿走路，哪条通了走哪条',
        effects: [
          { money: 2000 },
          { attr: 'stress', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'mc_moat',
    category: 'career',
    title: '新来的年轻人',
    text: '组里来了三个应届生，工资单上的数字让老员工们私下议论了一周。领导找{name}谈话：「带带新人，团队下一步要压担子。」——是危机，也可以是护城河。',
    minAge: 38,
    maxAge: 50,
    cooldown: 6,
    weight: 14,
    requires: { careerKinds: ['employed'], minAcademics: 70 },
    choices: [
      {
        text: '接下带团队的担子',
        tooltip: '压力换位子，调薪在年后兑现',
        summary: '{name}开始带着三个新人啃硬骨头。年会那天，调薪通知悄悄到了账',
        effects: [
          { attr: 'stress', delta: 2 },
          { addSkill: { id: 'academics', delta: 1 } },
        ],
        delayed: [{ years: 1, money: 12000, summary: '带队满一年，调薪兑现了' }],
      },
      {
        text: '当好螺丝钉，不让渡生活',
        summary: '{name}带完手头最后一个小项目就撤了。职级原地踏步，晚饭倒是一顿没落下',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
]
