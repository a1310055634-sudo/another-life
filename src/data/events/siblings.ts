// 第 65 轮：兄弟姐妹事件线——给手足以情感叙事，不只结算关系值。
// 资格全部读第 64 轮机制落下的真实状态：
// - 在册手足（relationKinds: sibling；alive 判定天然排除已故与疏远）
// - 疏远手足（estranged_sibling 标记：亲密度跌 0 自动疏远时由 settleEstrangement 授予；
//   重建走 relation revive 效果——只认 estranged，不复活已去世者）
// - 已故手足（siblingDiedWithin N，第 65 轮新条件：deceased + deathAge（真实手足年龄）反推）
// - 父母联动：minCloseness 双键 AND（赡养分工须父母与手足同在）、
//   parentsAllDeceased + parentDiedWithin（遗产之年）
// 全部 ≥2 有效选项（负债时大额选项隐藏后事件自然关闭或保 ≥2 可见）；
// 金额与既有物价感知一致（数千至三万档，顶格不超过婚礼彩礼 30k）。
import type { GameEvent } from '../../engine/types'

export const SIBLING_EVENTS: GameEvent[] = [
  // ── 借钱与还钱：成年期最常见的求助；delayed 两年还钱（确定性回收）──
  {
    id: 'sib_loan',
    category: 'relationship',
    title: '深夜的求助电话',
    text: '电话那头是TA的声音，绕了半天圈子才说到正题——手头差点钱，想跟{name}借点钱应应急。「要是不方便，就当我没说过。」',
    minAge: 22,
    maxAge: 50,
    cooldown: 5,
    weight: 10,
    requires: { relationKinds: ['sibling'] },
    choices: [
      {
        text: '全部借给TA，不催还',
        tooltip: '两年的宽限，亲情不设利息',
        summary: '{name}把钱转了过去，只说了一句「先渡过这阵」',
        effects: [
          { money: -20000 },
          { relation: { kind: 'sibling', deltaCloseness: 6 } },
        ],
        delayed: [{ years: 2, money: 20000, summary: 'TA把钱如数还上了，还捎来两箱老家特产' }],
      },
      {
        text: '借一半，帮TA渡难关',
        summary: '{name}转了一半过去，剩下的让TA自己想想办法',
        effects: [
          { money: -10000 },
          { relation: { kind: 'sibling', deltaCloseness: 3 } },
        ],
        delayed: [{ years: 2, money: 10000, summary: '那笔钱如期回到了卡里' }],
      },
      {
        text: '手心手背都是肉，但日子是自己过的',
        summary: '{name}没接这个话茬，电话两头都沉默了很久',
        effects: [
          { relation: { kind: 'sibling', deltaCloseness: -4 } },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
  // ── 合伙创业：高风险高回报的确定性双支（入伙坐等分红/只出力不掏钱/不掺和）──
  {
    id: 'sib_venture',
    category: 'relationship',
    title: '要不要一起干票大的',
    text: 'TA看中了一个铺面，想做点小生意，算盘打得噼啪响，就差最后一笔本钱。「咱俩合伙，赚了对半分。」{name}盯着那张规划草图，心跳快了半拍。',
    minAge: 30,
    maxAge: 45,
    cooldown: 5,
    weight: 8,
    requires: { relationKinds: ['sibling'], moneyAtLeast: 5000 },
    choices: [
      {
        text: '出一半本钱，入伙',
        tooltip: '三年见分晓，累是真累',
        summary: '{name}成了自家铺子的合伙人，周末全搭了进去',
        effects: [
          { money: -30000 },
          { attr: 'stress', delta: 4 },
          { relation: { kind: 'sibling', deltaCloseness: 5 } },
        ],
        delayed: [{ years: 3, money: 45000, summary: '铺子站稳了脚跟，第一笔分红比想象中厚实' }],
      },
      {
        text: '钱不出，力气出',
        summary: '{name}没投钱，但进货搬货跑执照，一趟没落下',
        effects: [
          { addSkill: { id: 'vocational', delta: 5 } },
          { attr: 'stress', delta: 3 },
          { relation: { kind: 'sibling', deltaCloseness: 3 } },
        ],
      },
      {
        text: '亲戚归亲戚，生意归生意',
        summary: '{name}把话说透了：账目混在一起，亲情反而容易散',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  // ── 父母赡养分工：须父母与手足同在（minCloseness 双键 AND 存在性）──
  {
    id: 'sib_care_split',
    category: 'relationship',
    title: '爸妈养老这笔账',
    text: '老人体检单上的箭头多了几个。晚饭桌上，{name}和TA把话摆到了台面上——往后怎么办，总得有个章程。',
    minAge: 35,
    maxAge: 65,
    cooldown: 4,
    weight: 9,
    requires: { minCloseness: { parent: 0, sibling: 0 } },
    choices: [
      {
        text: '钱多出些，让TA多跑腿',
        summary: '{name}包了大头开支，跑腿的事交给了住得近的TA',
        effects: [
          { money: -6000 },
          { relation: { kind: 'parent', deltaCloseness: 4 } },
          { relation: { kind: 'sibling', deltaCloseness: 2 } },
        ],
      },
      {
        text: '自己多跑腿，让TA少操心',
        summary: '{name}把周末都给了爸妈的体检和药房',
        effects: [
          { attr: 'stress', delta: 3 },
          { relation: { kind: 'parent', deltaCloseness: 5 } },
        ],
      },
      {
        text: '先打电话跟TA商量着来',
        summary: '兄妹俩在电话里把章程定了个七八成',
        effects: [
          { money: -200 },
          { relation: { kind: 'sibling', deltaCloseness: 5 } },
          { relation: { kind: 'parent', deltaCloseness: 2 } },
        ],
      },
    ],
  },
  // ── 遗产之年：双亲皆逝后三年内、手足在册——「分产」的情感叙事，once ──
  {
    id: 'sib_inheritance',
    category: 'relationship',
    title: '老屋的钥匙',
    text: '老屋过户的日子定了。中介把文件推过来的时候，屋子里安静得能听见挂钟走针——你和TA，一人一把钥匙。',
    minAge: 32,
    maxAge: 77,
    once: true,
    weight: 14,
    priority: 2,
    requires: { parentsAllDeceased: true, parentDiedWithin: 3, relationKinds: ['sibling'] },
    choices: [
      {
        text: '按老人生前的意思，平分',
        summary: '该是谁的就是谁的，谁也没多占一分',
        effects: [
          { money: 8000 },
          { attr: 'happiness', delta: 3 },
          { relation: { kind: 'sibling', deltaCloseness: 4 } },
        ],
      },
      {
        text: '让着TA些，少拿一份',
        summary: '{name}在那份文件上签了字，签得比想象中轻',
        effects: [
          { money: 4000 },
          { attr: 'happiness', delta: 5 },
          { relation: { kind: 'sibling', deltaCloseness: 7 } },
        ],
      },
      {
        text: '为一间老屋，闹得很僵',
        summary: '话说重了，门摔得很响，那间老屋空了很久',
        effects: [
          { money: 15000 },
          { attr: 'happiness', delta: -3 },
          { relation: { kind: 'sibling', deltaCloseness: -12 } },
        ],
      },
    ],
  },
  // ── 聚会口角与和解：亲密度走低（≤40）才有此局；先低头是修复出口 ──
  {
    id: 'sib_fallout_reconcile',
    category: 'relationship',
    title: '饭桌上的旧账',
    text: '又是一年聚齐，几句话不对付，旧账翻上了桌。摔筷子的是TA，先离席的是{name}。回到屋里，手机屏幕亮了又暗——那条编辑了一半的消息，发还是不发。',
    minAge: 22,
    maxAge: 68,
    cooldown: 4,
    weight: 9,
    requires: { relationKinds: ['sibling'], maxCloseness: { sibling: 40 } },
    choices: [
      {
        text: '先低头，把电话打过去',
        tooltip: '血缘面前，谁先开口谁大气',
        summary: '电话接通的第一句是「吃了吗」，最后一句是「过年回来」',
        effects: [
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'sibling', deltaCloseness: 9 } },
        ],
      },
      {
        text: '等TA先开口',
        summary: '那晚谁也没打给谁，各自睡得很晚',
        effects: [{ attr: 'happiness', delta: -1 }],
      },
      {
        text: '把旧账翻个明白',
        summary: '旧账是翻明白了，情分也翻薄了',
        effects: [
          { attr: 'stress', delta: 3 },
          { relation: { kind: 'sibling', deltaCloseness: -6 } },
        ],
      },
    ],
  },
  // ── 异地重逢：疏远线（estranged_sibling 标记在场）；重建走 revive，不复活已逝 ──
  {
    id: 'sib_reunion',
    category: 'relationship',
    title: '通讯录里那个不再拨的号码',
    text: '母亲又在电话里念叨TA了——「你们到底咋了，一个锅里吃饭长大的人」。{name}翻出通讯录，那个号码存了很多年，却很久没拨过了。',
    minAge: 26,
    maxAge: 68,
    cooldown: 3,
    weight: 11,
    priority: 1,
    requires: { tagsAny: ['estranged_sibling'] },
    choices: [
      {
        text: '去个电话，把话说开',
        summary: '电话响了很久才接通，第一句话是「喂，是我」',
        effects: [
          { attr: 'happiness', delta: 3 },
          { relation: { kind: 'sibling', revive: true, closeness: 45 } },
        ],
        removeTags: ['estranged_sibling'],
      },
      {
        text: '托母亲带句好话',
        summary: '话带到了，电话还没打好',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
      {
        text: '让这段关系，留在过去',
        summary: '{name}把那条号码备注改成了两个字：过去',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: -2 },
        ],
        removeTags: ['estranged_sibling'],
      },
    ],
  },
  // ── 老来相伴：手足年满 60（childStage kind:'sibling' 复用子女年龄推算）──
  {
    id: 'sib_old_companion',
    category: 'relationship',
    title: '这世上记得你小时候的人',
    text: '这世上知道{name}小时候尿过裤子、逃过课、偷过供果的，只剩TA了。电话里聊起旧事，两个加起来一百多岁的人笑得像两个孩子。',
    minAge: 58,
    maxAge: 77,
    cooldown: 3,
    weight: 10,
    requires: { childStage: { kind: 'sibling', atLeast: 60 } },
    choices: [
      {
        text: '每周一次电话粥，雷打不动',
        summary: '周日晚八点的电话，成了两个老人共同的钟表',
        effects: [
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'sibling', deltaCloseness: 5 } },
        ],
      },
      {
        text: '结伴回一趟老家',
        summary: '老屋门前合了张影，照片里两个人都在笑',
        effects: [
          { money: -4000 },
          { attr: 'happiness', delta: 5 },
          { relation: { kind: 'sibling', deltaCloseness: 6 } },
        ],
      },
      {
        text: '各过各的日子，但知道TA在',
        summary: '不常见面，但那份惦记一直都在',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'sibling', deltaCloseness: 2 } },
        ],
      },
    ],
  },
  // ── 送别手足之后：旧照片（siblingDiedWithin 2，once）——手足线的「第一个春天」──
  {
    id: 'sib_memorial',
    category: 'relationship',
    title: '旧照片里的那个人',
    text: '整理柜子时翻出一张旧照片：两个小孩蹲在门槛上分一根冰棍，笑得没心没肺。照片里的另一个人，去年还在电话里跟{name}拌嘴。',
    minAge: 20,
    maxAge: 77,
    once: true,
    weight: 13,
    priority: 2,
    requires: { siblingDiedWithin: 2 },
    choices: [
      {
        text: '把照片翻拍存档，设成屏保',
        summary: '那张照片如今每天都在口袋里',
        effects: [
          { money: -300 },
          { attr: 'happiness', delta: 4 },
        ],
      },
      {
        text: '学着做TA最拿手的那道菜',
        summary: '味道差了一点，但就是那个味',
        effects: [{ attr: 'happiness', delta: 5 }],
      },
      {
        text: '今年先不看，把盒子轻轻合上',
        summary: '有些想念需要再攒一攒勇气',
        effects: [{ attr: 'happiness', delta: -2 }],
      },
    ],
  },
]
