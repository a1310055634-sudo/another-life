import type { Background } from '../engine/types'

/**
 * 初始背景：决定 18 岁时的资源起点、标记与家庭关系。
 * 每个背景都必须有明确的优点与代价；标记（tags）供事件条件引用，
 * 让不同开局在后续年份遇到不同的选项。
 */
export const BACKGROUNDS: Background[] = [
  {
    id: 'ordinary',
    name: '普通家庭',
    desc: '小城工薪家庭，父母收入稳定。资源平平，但路最宽，没有先天负担。',
    pros: '父母双全、压力低，各方向起点均衡，没有先天短板事件',
    cons: '起始资金平平，也没有任何专属机会',
    influence: '各方向均衡，无专属事件',
    attrs: { health: 65, happiness: 60, smarts: 50, social: 50, stress: 20 },
    money: 3000,
    education: 'highschool',
    tags: ['bg_ordinary'],
  },
  {
    id: 'wealthy',
    name: '富裕家庭',
    desc: '家里做生意，起步资金充足、人脉广。见识多，但也早早习惯了高标准生活。',
    pros: '起始资金 20 万，家里有人脉，关键时刻拉你一把',
    cons: '吃苦能力与人际亲和力并不出众；家里的期待也是无形的担子',
    influence: '解锁「家里的安排」等富裕专属事件与选项',
    attrs: { health: 60, happiness: 65, smarts: 55, social: 65, stress: 15 },
    skills: { academics: 5 },
    money: 200000,
    education: 'highschool',
    tags: ['bg_wealthy', 'has_connections'],
  },
  {
    id: 'rural',
    name: '农家子弟',
    desc: '山村长大，读书是唯一的出路。能吃苦、韧性强，但手头拮据，信息也闭塞。',
    pros: '健康与能力起点最高，带着「能吃苦」的底子',
    cons: '起始资金只有 300 元，人际起点最低，早年财务紧张',
    influence: '解锁「往家里打钱」等农家专属事件，自立路线更早',
    attrs: { health: 75, happiness: 50, smarts: 60, social: 40, stress: 30 },
    skills: { academics: 8 },
    money: 300,
    education: 'highschool',
    tags: ['bg_rural', 'hardworking'],
  },
  {
    id: 'single_parent',
    name: '单亲家庭',
    desc: '母亲一人把你拉扯大，早早懂事。共情能力强，但对金钱格外没有安全感。',
    pros: '共情力强、人际不差，与母亲格外亲',
    cons: '起始资金少、压力起点最高，带着「金钱焦虑」',
    influence: '解锁「往家里打钱」等家庭责任事件，亲情线更重',
    attrs: { health: 60, happiness: 45, smarts: 55, social: 55, stress: 35 },
    skills: { vocational: 5 },
    money: 1000,
    education: 'highschool',
    tags: ['bg_single_parent', 'empathetic', 'money_anxiety'],
  },
]

export function getBackground(id: string): Background {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0]
}
