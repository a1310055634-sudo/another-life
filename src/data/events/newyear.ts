// 年关系统（第 118 轮，V7）：离乡者的年关抉择层。
// 撞题切割（账本详录）：youth_holiday_dilemma「春节的抢票页面」盖未婚 18–30（无城市门）、
// mar_new_year_side「年三十的路线」盖已婚 28–52（两边老人拉扯）、rel「过年没回的家」盖
// 疏远父母线——本线补**未婚离乡 31–58 岁**（cityIn metro/province+tagsNone married），
// 三者按人群/生命段互斥不重叠。无日历年约束：年关按年龄锚定 cd3 轮转。
// 静态正文模型的记录偏差：亲戚三连问（工资/对象/二胎）的状态门控显示在单一事件正文
// 中不可行（text 不支持条件拼接），本线改为氛围泛写+两向抉择；状态化催问归 R124 联动候选。
import type { GameEvent } from '../../engine/types'

export const NEWYEAR_EVENTS: GameEvent[] = [
  {
    // 在哪过年：未婚离乡者每年的抉择。回家=春运+红包；留城=加班费/省下的路费。
    id: 'ny_where',
    category: 'life',
    title: '今年的年在哪过',
    text: '腊月一到，日历上的那个日子就开始发烫。回家的票、留守的班、母亲发来的腊味清单——{name}对着手机算了又算，这道题每年都要重答一遍。',
    minAge: 31,
    maxAge: 58,
    cooldown: 3,
    weight: 12,
    requires: { cityIn: ['metro', 'province'], tagsNone: ['married'] },
    choices: [
      {
        text: '回家。票再难抢也要回',
        tooltip: '春运路费 1,500 元',
        summary: '拖着一箱年货挤上车， hometown 的站牌亮起来那一刻，一年的疲惫都值了',
        effects: [
          { money: -1500 },
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'parent', deltaCloseness: 2 } },
        ],
        addTags: ['home_for_ny'],
      },
      {
        text: '留在城市，把路费变成加班费',
        summary: '留城的年夜，{name}给自己点了顿好的。视频里给爸妈拜了年——不是不想回，是这年在城里也有它的过法',
        effects: [
          { money: 2000 },
          { attr: 'happiness', delta: -3 },
        ],
        addTags: ['ny_stay_town'],
      },
    ],
  },
  {
    // 亲戚的提问：回家年后的饭桌环节（工资/对象/二胎的泛写——状态化催问显示层不可行，
    // 记录偏差归 R124）。打太极/实话说两向。
    id: 'ny_questions',
    category: 'life',
    title: '饭桌上的提问环节',
    text: '年夜饭的筷子还没放下，问题就一个接一个上桌了。姑姑问收入，舅妈问个人问题，连表弟都凑热闹。{name}夹了一筷子菜，脑内飞速排兵布阵。',
    minAge: 26,
    maxAge: 58,
    cooldown: 3,
    weight: 10,
    requires: { tagsAny: ['home_for_ny'] },
    choices: [
      {
        text: '打太极，「还行还行，吃菜吃菜」',
        summary: '四个「还行」挡下了三轮攻势。姑姑们似乎也满意了——她们要的也许不是答案，是这来来回回的热闹',
        effects: [{ attr: 'stress', delta: 1 }],
      },
      {
        text: '实话实说，一句是一句',
        summary: '{name}把近况原原本本说了。饭桌上安静了几秒，然后姥姥夹了个鸡腿过来：「实话好。日子是自己过的。」如释重负',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: -2 },
        ],
      },
    ],
  },
  {
    // 留城的年夜饭：留城年当天的生活流。自在写法（非羞辱化）+R115 同事联动（被邀请支）。
    id: 'ny_stay_dinner',
    category: 'life',
    title: '年三十的这顿饭',
    text: '城市在今晚难得地安静下来，窗外偶尔炸开几朵烟花。{name}的年夜饭，得认真对待——一年就这一顿，在哪儿吃、跟谁吃，都是讲究。',
    minAge: 26,
    maxAge: 58,
    cooldown: 3,
    weight: 10,
    requires: { tagsAny: ['ny_stay_town'] },
    choices: [
      {
        text: '一人食也要四个菜，给自己撑场面',
        tooltip: '采买 500 元',
        summary: '硬菜两个、素菜两个、汤一个，摆满一桌。{name}拍了张照发家族群，配文「一切都好」。一个人的年，也过得像模像样',
        effects: [
          { money: -500 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '跟爸妈视频守岁，隔着屏幕碰杯',
        summary: '屏幕那头在放春晚，母亲非要举着饺子对着镜头「干杯」。隔着六百公里，年三十的钟声是一起听的',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
      {
        text: '同事喊了一起了年',
        requires: { relationKinds: ['colleague'] },
        summary: 'TA家客厅挤满了同样留城的年轻人，饺子包了三种馅。午夜十二点，一群人举着饮料碰杯——「明年都更好」',
        effects: [
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'colleague', deltaCloseness: 2 } },
        ],
      },
    ],
  },
]
