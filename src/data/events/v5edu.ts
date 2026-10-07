// 第 92 轮（V5）：留学与职校双线——教育路径的宽度。
// 留学链复用 V1 既有 studied_abroad 标记语义（海外经历），不新增学历层级
// （setEducation master 仅对 bachelor 升档，更高级别重设同值无害）；
// 海归加成落 salaryMul 1.05+签字费（零引擎改动）；落差窗口由失业状态承载。
// 职校线走 vocational 技能（EventCondition.minVocational 第 92 轮新字段）。
import type { GameEvent } from '../../engine/types'

export const V5EDU_EVENTS: GameEvent[] = [
  {
    id: 'ab_choice',
    category: 'education',
    title: '一封录取邮件',
    text: '海外一年制硕士的 offer 躺在邮箱里：排名不算顶尖，但签证官认、学历认证也认。学费加生活费，一年二十万起。{name}盯着屏幕上的数字，算了一遍又一遍。',
    minAge: 20,
    maxAge: 30,
    once: true,
    weight: 12,
    requires: {
      education: ['bachelor', 'master', 'phd'],
      minAttr: { smarts: 60 },
      moneyAtLeast: 200000,
      careerKinds: ['student', 'employed', 'unemployed', 'none'],
    },
    choices: [
      {
        text: '自费去读，一年磨一剑',
        tooltip: '学费生活费 200,000 元；海外历练 smarts 大涨',
        summary: '{name}辞别家人登陆机场。二十万换来的一年，值不值，要很多年后才知道',
        effects: [
          { money: -200000 },
          { attr: 'stress', delta: 2 },
        ],
        addTags: ['abroad_year'],
      },
      {
        text: '办教育贷款，赌一个更好的起点',
        tooltip: '押金 20,000 元，学贷分三年还清（每年 60,000）；压力更大',
        summary: '{name}签了教育贷款合同。这一把，押上的是未来三年的工资单',
        effects: [
          { money: -20000 },
          { attr: 'stress', delta: 4 },
        ],
        delayed: [
          { years: 1, money: -60000, summary: '留学贷款第一期扣款，毫不留情' },
          { years: 2, money: -60000, summary: '留学贷款第二期，吃土也要还' },
          { years: 3, money: -60000, summary: '最后一期学贷还清，如释重负' },
        ],
        addTags: ['abroad_year'],
      },
      {
        text: '算了吧，成本太高',
        summary: '{name}关掉了邮箱。有些路，注定只能远远看一眼',
        effects: [{ attr: 'smarts', delta: 1 }],
      },
    ],
  },
  {
    id: 'ab_study',
    category: 'education',
    title: '图书馆的凌晨',
    text: '全英文的文献、听不全懂的lecture、超市打折时段的作息——{name}在异国的图书馆熬过一个个凌晨，论文过了的那天，人在楼梯间哭得像个孩子。',
    minAge: 20,
    maxAge: 32,
    once: true,
    weight: 14,
    requires: { tagsAll: ['abroad_year'] },
    choices: [
      {
        text: '毕业归国，学历到手',
        tooltip: 'smarts 大涨；学历升至上硕（本科起点）；海归身份求职有加成',
        summary: '{name}穿上学士服拍完最后一组照片，行李箱里装着学位证和一整个人的脱胎换骨',
        effects: [
          { setEducation: 'master' },
          { addSkill: { id: 'academics', delta: 4 } },
          { attr: 'smarts', delta: 6 },
          { attr: 'stress', delta: -2 },
        ],
        addTags: ['returnee', 'studied_abroad'],
        removeTags: ['abroad_year'],
      },
      {
        text: '实在撑不下去，休学回国',
        tooltip: '放弃学业：无海归标记，情绪代价大',
        summary: '{name}拖着没拆封的行李回国了。这一年的账单和遗憾，都得自己慢慢消化',
        effects: [
          { attr: 'happiness', delta: -3 },
          { attr: 'stress', delta: 2 },
        ],
        removeTags: ['abroad_year'],
      },
    ],
  },
  {
    id: 'ab_job_hunt',
    category: 'career',
    title: '海归的简历',
    text: '留学归来的{name}把简历投进了几家外企和大厂。HR 回复的速度明显比从前快——「海归背景，优先约面」这行字，第一次让留学这件事有了现价的回报。',
    minAge: 24,
    maxAge: 40,
    once: true,
    weight: 12,
    requires: { tagsAll: ['returnee'] },
    choices: [
      {
        text: '接受外企 offer，签字费到账',
        tooltip: '签字费 8,000 元；在职则调薪 1.05',
        summary: '{name}入职了外企。签字费到账的短信提示音，听着像对那一年的迟到补偿',
        effects: [
          { money: 8000 },
          { attr: 'social', delta: 2 },
          { salaryMul: 1.05 },
        ],
      },
      {
        text: '婉拒外企，投奔国内公司',
        summary: '{name}选了家国内公司。海归的牌子没换来溢价，但换来了一句「我们更看中你的独立」',
        effects: [
          { money: 2000 },
          { addSkill: { id: 'academics', delta: 2 } },
        ],
      },
    ],
  },
  {
    id: 'ab_gap',
    category: 'career',
    title: '「海归」变「海待」',
    text: '回来的第三个月，{name}的简历还是只进不出。留学群里有人自嘲：出去的时候叫海归，找不到工作就叫海待了。{name}笑不出来。',
    minAge: 24,
    maxAge: 38,
    once: true,
    requires: { tagsAll: ['returnee'], careerKinds: ['unemployed', 'none'] },
    choices: [
      {
        text: '调整预期，从眼前做起',
        tooltip: '心态落地，stress 缓解',
        summary: '{name}把简历上的「海归」二字删了，从力所能及的岗位重新投起。路是一步一步走宽的',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: -2 },
        ],
      },
      {
        text: '不服，二次冲刺考研考编',
        tooltip: '功底再涨，但压力更大',
        summary: '{name}把行李箱重新打开——这次的目标是国内的研究生名额。败过一次的人，不怕再熬一年',
        effects: [
          { addSkill: { id: 'academics', delta: 3 } },
          { attr: 'stress', delta: 3 },
        ],
      },
    ],
  },
  {
    id: 'voc_night_school',
    category: 'education',
    title: '夜校的技术班',
    text: '技校的夜间进修班贴出了招生简章：PLC 编程、数控机床、电工进阶——上课时间晚间七点到九点，不耽误白天的活。{name}盯着简章看了很久。',
    minAge: 22,
    maxAge: 45,
    cooldown: 4,
    requires: { careerKinds: ['employed'] },
    choices: [
      {
        text: '报名，把技术往深里学',
        tooltip: '学费 3,000 元；职业技能 +12',
        summary: '{name}每晚骑四十分钟电动车去上课，笔记本上全是图纸和参数',
        effects: [
          { money: -3000 },
          { addSkill: { id: 'vocational', delta: 12 } },
          { attr: 'stress', delta: 2 },
        ],
      },
      {
        text: '问清楚再做决定，先不了',
        summary: '{name}把简章折好放进了工具包。也许明年，也许用不上',
        effects: [{ attr: 'smarts', delta: 1 }],
      },
    ],
  },
  {
    id: 'voc_craft_master',
    category: 'career',
    title: '老师傅的名号',
    text: '厂里的进口设备出了疑难故障，外方工程师远程都没搞定，最后是{name}上手听声辨位修好的。车间主任拍板：技术攻关小组，{name}来牵头。',
    minAge: 30,
    maxAge: 50,
    cooldown: 8,
    requires: { careerKinds: ['employed'], minVocational: 70 },
    choices: [
      {
        text: '牵头攻关，把名号打出去',
        tooltip: '压力不小；一年后调薪 12,000 元兑现',
        summary: '{name}带队啃下了这块硬骨头。「有难题找{name}」，从此在厂里成了口号',
        effects: [
          { attr: 'stress', delta: 2 },
          { attr: 'happiness', delta: 1 },
        ],
        delayed: [{ years: 1, money: 12000, summary: '技术攻关的调薪批下来了，实至名归' }],
      },
      {
        text: '把手艺守好就行，出头让别人来',
        summary: '{name}婉拒了牵头。手艺在身，心里不慌——平静也是种回报',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
]
