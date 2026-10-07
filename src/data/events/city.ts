// 第 90 轮（V5）：城市迁移事件线——成本与机会的天平。
// setCity 效果变更所在层级；三档系数（薪资/生活成本/房产增值）在引擎侧挂钩，
// 缺省 hometown 全系数 1 = 旧行为逐位不变（迁移为选择性加入）。
import type { GameEvent } from '../../engine/types'

export const CITY_EVENTS: GameEvent[] = [
  {
    id: 'city_graduate_run',
    category: 'life',
    title: '去大城市闯闯',
    text: '行李箱的轮子在地砖上哒哒作响。高铁票上的终点是一座{name}只在新闻里见过的城市——三个小时的距离，两种完全不同的人生报价。',
    minAge: 18,
    maxAge: 26,
    once: true,
    requires: { careerKinds: ['employed', 'unemployed', 'none'], cityIn: ['hometown'] },
    choices: [
      {
        text: '买票，走',
        tooltip: '安家开销 3,000 元；一线薪资 ×1.35、生活成本 ×1.3、房价增值 ×1.5 档',
        summary: '{name}在大城市城中村的隔断间里铺好了床单。这里的钱好挣，也不经花',
        effects: [
          { money: -3000 },
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: 2 },
          { setCity: 'metro' },
        ],
      },
      {
        text: '留下来，离家近的日子不折腾',
        summary: '{name}退了票。家门口的日子一眼能望到头，但胜在踏实',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'social', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'city_drift_tired',
    category: 'life',
    title: '北漂的第十个年头',
    text: '合租房的隔音棉又掉了一块。凌晨加班回来，{name}在楼下便利店买了关东煮，手机里是母亲发来的「隔壁小王在省城买房了」。',
    minAge: 28,
    maxAge: 40,
    cooldown: 4,
    requires: { careerKinds: ['employed', 'unemployed'], cityIn: ['metro'], tagsNone: ['homeowner'] },
    choices: [
      {
        text: '收拾行李，去省城重新开始',
        tooltip: '搬家费 2,000 元；省城薪资 ×1.15、生活成本 ×1.1',
        summary: '{name}把三年攒下的行李压缩成两个箱子。省城的房子租金便宜了一半，晚上能睡整觉了',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 2 },
          { setCity: 'province' },
        ],
      },
      {
        text: '咬牙留下，再冲两年',
        tooltip: '一线的机会与房租一起涨',
        summary: '{name}续了一年的租约。关东煮的热气糊住了眼镜——再冲两年，就两年',
        effects: [
          { money: -2000 },
          { attr: 'stress', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'city_province_hq',
    category: 'career',
    title: '老家省会的 offer',
    text: '省城一家公司的电话打了过来：岗位对口，薪资在当地排得上号，「就是比不上你现在的城市」。{name}翻着手机里省会双子楼的照片，认真想了想。',
    minAge: 25,
    maxAge: 35,
    once: true,
    requires: { careerKinds: ['employed', 'unemployed', 'none'], cityIn: ['hometown'] },
    choices: [
      {
        text: '去省城，离家近事业也不耽误',
        tooltip: '安家开销 2,500 元；省城薪资 ×1.15、生活成本 ×1.1',
        summary: '{name}拖着行李箱到了省会。高铁回家四十分钟，工资单上的数字也比老家精神了不少',
        effects: [
          { money: -2500 },
          { attr: 'social', delta: 2 },
          { setCity: 'province' },
        ],
      },
      {
        text: '留在家乡，守着眼下的一切',
        summary: '{name}婉拒了对方。家门口的一亩三分地，种点踏实的日子',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    id: 'city_return_retire',
    category: 'life',
    title: '返乡的机票',
    text: '退休手续办完那天，{name}在阳台上看了一场这个城市最完整的日落。第二天，机票和老家亲戚「回来住吧」的语音一起，摆在了眼前。',
    minAge: 50,
    maxAge: 75,
    once: true,
    requires: { careerKinds: ['retired'], cityIn: ['metro', 'province'] },
    choices: [
      {
        text: '回去。叶落归根',
        tooltip: '搬家费 2,000 元；老家生活成本 ×1.0',
        summary: '{name}把城市的家具送了人。老家的院子扫得很干净，早晚的空气都是甜的',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 3 },
          { setCity: 'hometown' },
        ],
      },
      {
        text: '城市住惯了，不折腾',
        summary: '{name}把机票退了。这里的水果贵一点，但医院和地铁都在楼下',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
]
