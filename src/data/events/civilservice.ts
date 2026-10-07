// 第 88 轮（V5）：体制内线事件——考公路线（备考→笔试面试→上岸）+体制内生涯。
// 录取判定走 engine/civilservice.ts 独立支流（seed^盐+age 散列+academics 双条件）；
// 上岸授予 civil_servant 全局标记（寒冬豁免门控/退休金加成由岗位 pensionBonus 承载）。
// 在编防重：考试事件 tagsNone civil_servant（不假定玩家身份，全链显式门控）。
import type { GameEvent } from '../../engine/types'

/** 体制内在职（ employed + civil_servant 标记）——体制内生涯事件共用门控 */
const civilEmployed = { careerKinds: ['employed' as const], tagsAny: ['civil_servant'] }

export const CIVILSERVICE_EVENTS: GameEvent[] = [
  {
    id: 'civ_exam_prep',
    category: 'career',
    title: '备考的那盏灯',
    text: '家里人劝了第三年：「考个编吧，稳定。」{name}翻了翻招考公告——本科起步，行测申论，一年一回。书桌上的台灯，从这天起多亮两个小时。',
    minAge: 20,
    maxAge: 35,
    cooldown: 2,
    requires: { careerKinds: ['employed', 'unemployed', 'none'], tagsNone: ['civil_servant'], education: ['college', 'bachelor', 'master', 'phd'] },
    choices: [
      {
        text: '报个冲刺班，系统刷题',
        tooltip: '支出 3,000 元，标记 civil_exam_prep',
        summary: '{name}交了冲刺班的学费，行测的粉笔头堆满了笔筒',
        effects: [
          { money: -3000 },
          { addSkill: { id: 'academics', delta: 2 } },
        ],
        addTags: ['civil_exam_prep'],
      },
      {
        text: '自己啃真题，一分钱不花',
        tooltip: '标记 civil_exam_prep',
        summary: '{name}从网上扒了十年真题，一页一页啃了下来',
        effects: [{ addSkill: { id: 'academics', delta: 1 } }],
        addTags: ['civil_exam_prep'],
      },
    ],
  },
  {
    id: 'civ_exam',
    category: 'career',
    title: '笔试面试放榜',
    text: '考场外的梧桐树下全是人，{name}攥着准考证把申论模板又默了一遍。三个月后放榜——这一纸结果，可能换一条完全不同的路。',
    minAge: 20,
    maxAge: 40,
    cooldown: 1,
    requires: { careerKinds: ['employed', 'unemployed', 'none'], tagsNone: ['civil_servant'], education: ['college', 'bachelor', 'master', 'phd'], minAcademics: 45 },
    choices: [
      {
        text: '走进考场，等一个结果',
        tooltip: '支出报名费 200 元；录取与学业功底相关，落榜可再战',
        summary: '{name}交了报名费走进了考场，笔下是自己练了千百遍的答案',
        effects: [
          { money: -200 },
          { attr: 'stress', delta: 2 },
          { civilExam: true },
        ],
      },
      {
        text: '临时怯场，弃考',
        summary: '{name}在考场门口站了十分钟，转身走了。备考的标记还留着，明年再说',
        effects: [{ attr: 'stress', delta: 1 }],
      },
    ],
  },
  {
    id: 'civ_office_politics',
    category: 'career',
    title: '处室里的人情世故',
    text: '科长要退了，位置空出来一个。办公室里表面风平浪静，饭桌上的座次却悄悄变了。有人劝{name}「走动走动」，有人劝{name}「闷声干活」。',
    minAge: 28,
    maxAge: 50,
    cooldown: 6,
    requires: { ...civilEmployed },
    choices: [
      {
        text: '硬着头皮走动走动',
        tooltip: '人际长进，心里发堵',
        summary: '{name}拎着果篮串了几次门，话学会了怎么说，觉却睡得比以前少',
        effects: [
          { attr: 'social', delta: 3 },
          { attr: 'stress', delta: 2 },
        ],
      },
      {
        text: '埋头把手头的材料写好',
        tooltip: '功底扎实，提拔另说',
        summary: '{name}把那篇材料改到第十一稿。领导记不记得不重要，本事长在自己身上',
        effects: [{ addSkill: { id: 'academics', delta: 1 } }],
      },
    ],
  },
  {
    id: 'civ_secondment',
    category: 'career',
    title: '一纸借调令',
    text: '上面要人，名单里有{name}。借调去专班，忙是真忙，见识也是真见识——就是一年半载回不来，手头的活全得交出去。',
    minAge: 25,
    maxAge: 45,
    cooldown: 6,
    requires: { ...civilEmployed },
    choices: [
      {
        text: '去。苦一年，长本事',
        tooltip: '压力大，功底与眼界都涨',
        summary: '{name}抱着纸箱搬去了专班。半年下来，材料写得又快又稳，人瘦了一圈',
        effects: [
          { attr: 'stress', delta: 4 },
          { attr: 'happiness', delta: -1 },
          { addSkill: { id: 'academics', delta: 3 } },
        ],
      },
      {
        text: '婉拒，把手头的事守好',
        summary: '{name}婉拒了借调。有人替他惋惜，他自己知道家里离不开',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    id: 'civ_ceiling',
    category: 'career',
    title: '遴选的内部通知',
    text: '上级机关遴选的消息在小圈子里传开。符合条件的干部可以报名，笔试面试差额考察——这是体制内少有的、靠自己考出来的上升通道。',
    minAge: 30,
    maxAge: 55,
    cooldown: 6,
    requires: { ...civilEmployed },
    choices: [
      {
        text: '报名冲刺，答辩走起',
        requires: { promotionAvailable: true },
        tooltip: '事件晋升（职级未满时可用）',
        summary: '{name}把述职材料背到滚瓜烂熟，答辩台上稳稳当当——任命下来了',
        effects: [
          { attr: 'stress', delta: 3 },
          { promote: true },
        ],
      },
      {
        text: '知足留守，把日子过好',
        summary: '{name}没去凑这个热闹。到点上下班，把热汤热饭过成日子',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
]
