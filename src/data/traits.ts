import type { Trait } from '../engine/types'

/**
 * 特质：微调初始属性、事件权重（categoryWeight 由 session 透传给事件引擎）、
 * 并通过 tags 影响后续可选选项。每个特质都必须有明确代价，防止出现无脑最优解。
 */
export const TRAITS: Trait[] = [
  {
    id: 'studious',
    name: '书虫',
    desc: '天生爱读书，学习能力更强，更容易遇到与学习有关的事。',
    pros: '能力起点更高，教育类事件更常出现，升学路线更顺',
    cons: '更容易紧绷（压力 +5）',
    influence: '教育/学习类事件权重 ×1.5',
    attrs: { smarts: 8, stress: 5 },
    skills: { academics: 10 },
    categoryWeight: { education: 1.5 },
    tags: ['bookworm'],
  },
  {
    id: 'sociable',
    name: '社牛',
    desc: '走到哪都能交到朋友，人脉是你的本钱。',
    pros: '人际起点高，感情类事件更常出现，人脉路线更顺',
    cons: '花在啃书上的时间少（能力 -2）',
    influence: '关系类事件权重 ×1.4',
    attrs: { social: 10, happiness: 5, smarts: -2 },
    categoryWeight: { relationship: 1.4 },
    tags: ['social_butterfly'],
  },
  {
    id: 'ambitious',
    name: '野心家',
    desc: '对成功有强烈渴望，事业心强，但容易给自己太大压力。',
    pros: '职业机会更常出现，向事业路线倾斜',
    cons: '压力 +10、幸福 -5，容易透支自己',
    influence: '职业类事件权重 ×1.4',
    attrs: { smarts: 4, stress: 10, happiness: -5 },
    categoryWeight: { career: 1.4 },
    tags: ['ambitious'],
  },
  {
    id: 'laid_back',
    name: '佛系',
    desc: '随遇而安，压力很难找上你，但机会也常常擦肩而过。',
    pros: '压力起点极低、幸福更高，健康类事件更常出现',
    cons: '能力 -3，职业机会更少（权重 ×0.8）',
    influence: '健康类事件权重 ×1.3，职业类 ×0.8',
    attrs: { stress: -15, happiness: 8, smarts: -3 },
    categoryWeight: { health: 1.3, career: 0.8 },
    tags: ['laid_back'],
  },
  {
    id: 'frugal',
    name: '精打细算',
    desc: '一块钱恨不得掰成两半花，对数字格外敏感。',
    pros: '能力小幅提升，金钱类事件更常出现，更早看清财务门道',
    cons: '日子过得紧巴巴（幸福 -3、压力 +2）',
    influence: '金钱类事件权重 ×1.5',
    attrs: { smarts: 3, happiness: -3, stress: 2 },
    categoryWeight: { money: 1.5 },
    tags: ['frugal_minded'],
  },
  {
    id: 'risk_taker',
    name: '敢闯敢赌',
    desc: '别人看到风险，你看到的是机会——虽然不总是真的。',
    pros: '会解锁普通人没有的冒险选项，机遇类事件更常出现',
    cons: '压力 +8、健康 -2，冒险可能血本无归',
    influence: '生活机遇类权重 ×1.3、金钱类 ×1.2，健康类 ×0.85',
    attrs: { happiness: 2, stress: 8, health: -2 },
    categoryWeight: { money: 1.2, life: 1.3, health: 0.85 },
    tags: ['risk_taker'],
  },
]

export function getTrait(id: string): Trait {
  return TRAITS.find((t) => t.id === id) ?? TRAITS[0]
}
