// 第 85 轮（V5）：医疗与保险事件线——基本医保三档报销（只在 V5 新事件实装）+
// 商业保单（投保→在册→确诊给付终结）。设计语义见 SPEC §6.51。
// 投保事件带 healthRiskBelow:45（高风险核保不过，与拒保事件互斥不矛盾）；
// 手术事件三档按职业身份并列（每玩家可见=自己档+保守+硬扛 ≥2），
// 负债玩家的入口是「保守治疗（亲戚搭手，分两年还）」——延迟支出不参与大额隐藏。
import type { GameEvent } from '../../engine/types'

export const INSURANCE_EVENTS: GameEvent[] = [
  {
    id: 'ins_buy_young',
    category: 'money',
    title: '社保之外，再添一份',
    text: '发小在保险行业扎了根，饭桌上反复念叨：「社保是基础，重疾得自己补。」{name}翻着手机里的产品页，犹豫要不要填一份。',
    minAge: 18,
    maxAge: 35,
    once: true,
    requires: { insuranceMissing: true, healthRiskBelow: 45 },
    choices: [
      {
        text: '填一份重疾保障，一年 800，图个安心',
        tooltip: '建立保单：确诊即一次性给付 30,000 元',
        summary: '{name}签下了人生第一份保单，年缴 800，保额三万——但愿永远用不上',
        effects: [
          { money: -800 },
          { ensureInsurance: { annualPremium: 800, benefit: 30000 } },
        ],
      },
      {
        text: '再想想，先把钱握在手里',
        summary: '{name}把产品页划掉了，安心这件事，以后再说',
        effects: [],
      },
    ],
  },
  {
    id: 'ins_buy_mid',
    category: 'money',
    title: '人到中年，保障该补齐了',
    text: '同学群里又有人发起水滴筹，{name}看着那条消息愣了半天，默默打开了自己一直没舍得看的保险报价——年纪越大，这一年越贵。',
    minAge: 36,
    maxAge: 55,
    once: true,
    requires: { insuranceMissing: true, healthRiskBelow: 45 },
    choices: [
      {
        text: '咬咬牙投了，一年 1600，保额四万五',
        tooltip: '建立保单：确诊即一次性给付 45,000 元',
        summary: '{name}投保了重疾保障，年缴 1600、保额四万五——中年人的安全感，按年缴计价',
        effects: [
          { money: -1600 },
          { ensureInsurance: { annualPremium: 1600, benefit: 45000 } },
        ],
      },
      {
        text: '报价太贵，先放一放',
        summary: '{name}算了算家庭开支，把报价单关掉了',
        effects: [],
      },
    ],
  },
  {
    id: 'ins_declined',
    category: 'health',
    title: '核保没有通过',
    text: '{name}终于下定决心加一份保障，健康告知却卡在了体捡报告那几行箭头上——保险公司客客气气地把申请退了回来：风险太高，暂不承保。',
    minAge: 30,
    maxAge: 60,
    once: true,
    requires: { healthRiskAtLeast: 45, insuranceMissing: true },
    choices: [
      {
        text: '把烟酒和熬夜都收一收，先把身体养起来',
        summary: '{name}把拒保函收进抽屉，顺手把烟盒也收了起来',
        effects: [
          { attr: 'health', delta: 1 },
          { attr: 'stress', delta: 1 },
        ],
      },
      {
        text: '算了，不折腾了',
        summary: '{name}关掉了页面，该来的总会来',
        effects: [{ attr: 'stress', delta: 1 }],
      },
    ],
  },
  {
    id: 'hlt_major_surgery',
    category: 'health',
    title: '住院单上的那行字',
    text: '复查结果出来，医生把{name}叫进办公室，指着片子上那处阴影说：建议尽快手术。住院单开出来了，费用清单上写着：预计四万。',
    minAge: 40,
    maxAge: 70,
    once: true,
    requires: { healthRiskAtLeast: 50 },
    choices: [
      {
        text: '排期手术（职工医保报销后自付约 1.2 万）',
        requires: { careerKinds: ['employed'] },
        tooltip: '总费用 4 万，职工医保报销 70%',
        summary: '{name}请了长假住了院。手术很顺利，医保报完大头，剩下的就当买回一条命',
        effects: [
          { money: -12000 },
          { attr: 'health', delta: 15 },
          { attr: 'stress', delta: -3 },
          { claimInsurance: true },
        ],
      },
      {
        text: '排期手术（居民医保报销后自付约 2 万）',
        requires: { careerKinds: ['student', 'unemployed', 'none'] },
        tooltip: '总费用 4 万，居民医保报销 50%',
        summary: '{name}回了老家的大医院做手术。报销完自付两万，在床上躺了一个多月，人缓过来了',
        effects: [
          { money: -20000 },
          { attr: 'health', delta: 15 },
          { attr: 'stress', delta: -3 },
          { claimInsurance: true },
        ],
      },
      {
        text: '排期手术（退休统筹报销后自付约 6 千）',
        requires: { careerKinds: ['retired'] },
        tooltip: '总费用 4 万，退休统筹报销 85%',
        summary: '{name}住了半个月院。退休统筹报掉了大头，自己没掏几个钱，恢复得比想象中快',
        effects: [
          { money: -6000 },
          { attr: 'health', delta: 15 },
          { attr: 'stress', delta: -3 },
          { claimInsurance: true },
        ],
      },
      {
        text: '跟亲戚搭手做保守治疗，分两年还',
        tooltip: '先治后还：延迟两年各还 6,000 元',
        summary: '{name}跟亲戚开了口，凑齐了住院费。保守治疗三个疗程，人保住了，账也认下了',
        effects: [
          { attr: 'health', delta: 5 },
          { claimInsurance: true },
        ],
        delayed: [
          { years: 1, money: -6000, summary: '给亲戚的还款第一笔转了过去' },
          { years: 2, money: -6000, summary: '治病借的钱，终于还清了' },
        ],
      },
    ],
  },
]
