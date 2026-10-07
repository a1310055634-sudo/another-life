// 育儿参与线（第 114 轮，V7）：里程碑之间的家长抉择与 child 去向轻分化。
// 定位：fam_child_* 六里程碑是「孩子的节点」（milestonePending 机制，每孩至多一次），
// 本线是节点之间「家长的主动参与」——兴趣班/青春期沟通/填报前夜/去向显形。
// child_path 三向标记（academic/vocational/work）为轻量分化：只承载文案与后续显形，
// 不改结局判定、不改 milestones 引擎（显形事件读取标记做文案分化）。
// 红线：全部 childStage 门控（无娃不可达）+ tagsNone dink；去向显形三支各按标记可见，
// 另设一支无条件选项保证任何构造下 ≥2 可见（校验器「全部选项带 requires」禁令）。
import type { GameEvent } from '../../engine/types'

export const PARENTING_EVENTS: GameEvent[] = [
  {
    // 兴趣班：孩子 5–11 岁学龄段。两档花费都 <3,000 大额隐藏线（负债年也可见，
    // 家长参与不得只属于付得起钱的人）。closeness 走 milestoneTarget 定向到该孩子。
    id: 'par_interest_class',
    category: 'life',
    title: '周六早上的兴趣班',
    text: '孩子盯着少年宫宣传单上的画，眼睛亮了一下，又很快收回去——像怕给家里添麻烦。{name}把那张单子抚平，收进了口袋。',
    minAge: 25,
    maxAge: 45,
    cooldown: 4,
    weight: 12,
    requires: { childStage: { atLeast: 5, below: 12 }, tagsNone: ['dink'] },
    choices: [
      {
        text: '先报个零基础体验班',
        tooltip: '2,000 元',
        summary: '第一节课，孩子攥着蜡笔不肯撒手。回家的路上话比过去一个月都多',
        effects: [
          { money: -2000 },
          { relation: { kind: 'child', deltaCloseness: 3, milestoneTarget: true } },
        ],
        addTags: ['parenting_active'],
      },
      {
        text: '咬咬牙，报进阶小班',
        tooltip: '2,800 元',
        summary: '小班八个人，老师记得住每个名字。孩子把第一张「作品」贴在了冰箱正中央',
        effects: [
          { money: -2800 },
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: 3, milestoneTarget: true } },
        ],
        addTags: ['parenting_active'],
      },
    ],
  },
  {
    // 青春期的门：孩子 12–14 岁。两向抉择——敲开，或尊重那份安静（都给 closeness，
    // 差别在幅度与 stress 补偿：给空间是父母的修行，也确实让家里松一口气）。
    id: 'par_teen_door',
    category: 'life',
    title: '紧闭的房门',
    text: '孩子回家就进屋，门关得比外面天气还冷。饭桌上只剩筷子碰碗的声音。{name}在他门口站了一会儿，手举起来，又放下。',
    minAge: 30,
    maxAge: 50,
    cooldown: 3,
    weight: 12,
    requires: { childStage: { atLeast: 12, below: 15 }, tagsNone: ['dink'] },
    choices: [
      {
        text: '还是敲了门，进去坐下聊',
        summary: '一开始只有「嗯」「还行」。聊到第三十分钟，孩子忽然说起学校里的事，说着说着就停不下来了',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: 4, milestoneTarget: true } },
        ],
        addTags: ['parenting_active'],
      },
      {
        text: '把门轻轻带上，给他空间',
        summary: '{name}在门口贴了张字条：「汤在锅里。」那晚孩子自己出来盛了汤，还把碗洗了',
        effects: [
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'child', deltaCloseness: 2, milestoneTarget: true } },
        ],
        addTags: ['parenting_active'],
      },
    ],
  },
  {
    // 填报前夜：孩子 17–18 岁。撞题差异化——fam_child_gaokao「十八岁的志愿表」是
    // 里程碑操办事件（milestonePending，每孩一次）；本枚是那之前一夜的家长站位抉择，
    // 落 child_path 三向标记。once：志愿只有一夜。
    id: 'par_form_night',
    category: 'life',
    title: '填报前夜',
    text: '志愿表摊在灯下。孩子铅笔悬着，回头看了一眼{name}——那一眼里的意思很复杂：想听你的意见，又怕你替他做主。',
    minAge: 38,
    maxAge: 56,
    once: true,
    weight: 14,
    requires: { childStage: { atLeast: 17, below: 19 }, tagsNone: ['dink'] },
    choices: [
      {
        text: '全力托举：想读，就一直读下去',
        summary: '{name}把一句话放在了桌面上：「家里的事不用你操心，你只管往前走。」孩子低头填了下去，笔迹很稳',
        effects: [],
        addTags: ['child_path_academic', 'parenting_active'],
      },
      {
        text: '陪他看了职业院校：手艺是铁饭碗',
        summary: '一家三口跑了两天招生点。孩子摸着实训车间的机床不肯走——{name}知道，这就是对的路',
        effects: [],
        addTags: ['child_path_vocational', 'parenting_active'],
      },
      {
        text: '他心意已决：早点自立，家里尊重',
        summary: '孩子说想先工作。{name}沉默了一会儿，伸出手：「那就签好你的第一份合同。」',
        effects: [],
        addTags: ['child_path_work', 'parenting_active'],
      },
    ],
  },
  {
    // 去向显形：孩子 22 岁后，按 child_path 分化文案。三支各按标记可见 + 一支无条件，
    // 保证任意构造下 ≥2 可见（且规避「全部选项带 requires」校验问题）。
    id: 'par_path_visible',
    category: 'life',
    title: '他自己选的路上',
    text: '这些年家里安静了不少，孩子按当年那张表走出了很远。{name}偶尔想起填报前夜那盏灯——不知道当年那一下，算不算扶对了地方。',
    minAge: 47,
    maxAge: 65,
    once: true,
    weight: 10,
    requires: {
      childStage: { atLeast: 22 },
      tagsAny: ['child_path_academic', 'child_path_vocational', 'child_path_work'],
      tagsNone: ['dink'],
    },
    choices: [
      {
        text: '行李箱上贴着托运标签——他又出发去念书了',
        requires: { tagsAny: ['child_path_academic'] },
        summary: '视频里孩子举着录取通知，身后是陌生城市的站台。{name}嘴上说着「行李带够了没有」，眼眶先热了',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: 2, milestoneTarget: true } },
        ],
      },
      {
        text: '录用通知，和他亲手领来的第一套工具',
        requires: { tagsAny: ['child_path_vocational'] },
        summary: '孩子把录用通知摆在饭桌正中，工具包擦得锃亮。手艺人的饭碗，端得稳',
        effects: [{ relation: { kind: 'child', deltaCloseness: 3, milestoneTarget: true } }],
      },
      {
        text: '他用第一份工资，给家里换了台冰箱',
        requires: { tagsAny: ['child_path_work'] },
        summary: '新冰箱嗡嗡地响，孩子挠着头说「先尽着你们用」。{name}转身进了厨房，好一会儿才出来',
        effects: [
          { attr: 'stress', delta: -1 },
          { relation: { kind: 'child', deltaCloseness: 2, milestoneTarget: true } },
        ],
      },
      {
        text: '无论哪条路，都是他自己在走',
        summary: '{name}没再多问。当年灯下那一眼，如今有了自己的答案',
        effects: [{ attr: 'happiness', delta: 2 }],
      },
    ],
  },
]
