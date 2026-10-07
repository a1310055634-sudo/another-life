// 第 67 轮：婚姻深水区事件线——危机与修复（离婚最小语义按砍量预案未做，留账）。
// 资格全部读真实状态：已婚标记（married：rel_propose 授予）、危机标记
// （marriage_crisis：危机事件各选项授予，修复选项 removeTags 摘除，年度结算
// strain 额外 −2）、亲密阈值线（冷战线 ≤55）。窗口 28–60；与既有甜蜜向事件
// （rel_propose / mid_anniversary 十周年）互补不撞题；不假设孩子/房产/手足。
import type { GameEvent } from '../../engine/types'

export const MARRIAGE_EVENTS: GameEvent[] = [
  // ── 七年之痒：裂缝初现，摊开说就不成危机 ──
  {
    id: 'mar_seven_year',
    category: 'relationship',
    title: '婚姻的第几年',
    text: '不知从哪天起，晚饭桌上的话只剩「吃什么」和「交水电费」。{name}看着对面低头扒饭的那个人，忽然想起上一次认真聊天是什么时候——想不起来了。',
    minAge: 30,
    maxAge: 48,
    cooldown: 4,
    weight: 9,
    requires: { tagsAll: ['married'], relationKinds: ['spouse'], tagsNone: ['marriage_crisis'] },
    choices: [
      {
        text: '把话摊开说，重新约会',
        tooltip: '婚姻是谈出来的',
        summary: '{name}把纸条压在了TA的枕头下：周六晚上，老地方见',
        effects: [
          { money: -600 },
          { attr: 'happiness', delta: 3 },
          { relation: { kind: 'spouse', deltaCloseness: 5 } },
        ],
      },
      {
        text: '各忙各的，凑合着过',
        summary: '日子照旧，只是两个人越来越像合租室友',
        effects: [
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'spouse', deltaCloseness: -3 } },
        ],
        addTags: ['marriage_crisis'],
      },
    ],
  },
  // ── 冷战分居：亲密走低（≤55）才有此局；递台阶可拦在危机门外 ──
  {
    id: 'mar_cold_war',
    category: 'relationship',
    title: '分房睡的第一晚',
    text: '那场架吵到最后，TA抱起枕头去了书房。房子还是那个房子，忽然就显得很大、很空。{name}盯着天花板，听见隔壁传来翻身的声音。',
    minAge: 30,
    maxAge: 55,
    cooldown: 3,
    weight: 10,
    requires: { tagsAll: ['married'], maxCloseness: { spouse: 55 } },
    choices: [
      {
        text: '先递个台阶，敲敲书房的门',
        summary: '门开了一条缝，两个人都没提昨晚的事，但都松了口气',
        effects: [
          { money: -200 },
          { relation: { kind: 'spouse', deltaCloseness: 6 } },
        ],
      },
      {
        text: '谁先低头谁输，冷着',
        summary: '冰箱上的便签从「记得买牛奶」变成了空白',
        effects: [
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'spouse', deltaCloseness: -2 } },
        ],
        addTags: ['marriage_crisis'],
      },
    ],
  },
  // ── 异地考验：职业机会与婚姻的二选一 ──
  {
    id: 'mar_distance',
    category: 'relationship',
    title: '那份外派的offer',
    text: '公司征询{name}的意见：外派三年，薪水涨三成。好机会，好待遇——只是要去另一座城市，而TA的事业刚刚起步，走不开。',
    minAge: 28,
    maxAge: 52,
    cooldown: 4,
    weight: 8,
    requires: { tagsAll: ['married'], careerKinds: ['employed'] },
    choices: [
      {
        text: '接受外派，两地分居',
        tooltip: '补贴丰厚，代价也真实',
        summary: '{name}拖着行李箱去了机场，站台上TA挥手的样子记了很多年',
        effects: [
          { money: 20000 },
          { attr: 'stress', delta: 3 },
          { relation: { kind: 'spouse', deltaCloseness: -4 } },
        ],
        addTags: ['marriage_crisis'],
      },
      {
        text: '推掉机会，守着这个家',
        summary: '{name}给领导发了条长消息，下班回家多买了TA爱吃的菜',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: -1 },
          { relation: { kind: 'spouse', deltaCloseness: 3 } },
        ],
      },
    ],
  },
  // ── 修复之旅：危机在场的主出口（花钱档），摘标记即停止 strain ──
  {
    id: 'mar_repair_trip',
    category: 'relationship',
    title: '趁还没太晚，出发吧',
    text: '朋友说的那家民宿还开着，就在两个人蜜月路过的小城。{name}把手机递过去：「请两天假，我们出去走走吧，就我们俩。」TA盯着屏幕看了很久，点了点头。',
    minAge: 30,
    maxAge: 58,
    cooldown: 2,
    weight: 12,
    priority: 2,
    requires: { tagsAll: ['married', 'marriage_crisis'] },
    choices: [
      {
        text: '补一场两个人的旅行',
        tooltip: '有些话，要出了城才说得出口',
        summary: '在小城住了三天，回来的路上，TA在车里睡着了，手却牵着{name}',
        effects: [
          { money: -8000 },
          { attr: 'happiness', delta: 4 },
          { relation: { kind: 'spouse', deltaCloseness: 9 } },
        ],
        removeTags: ['marriage_crisis'],
        addTags: ['marriage_mended'],
      },
      {
        text: '近郊住一晚，散散心',
        summary: '没有海也没有山，但两个人把话说开了',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'spouse', deltaCloseness: 6 } },
        ],
        removeTags: ['marriage_crisis'],
        addTags: ['marriage_mended'],
      },
      {
        text: '人是出去了，话没出口',
        summary: '风景很好，两张照片，各发各的朋友圈',
        effects: [
          { attr: 'happiness', delta: -2 },
          { relation: { kind: 'spouse', deltaCloseness: -2 } },
        ],
      },
    ],
  },
  // ── 婚姻咨询：连续年可持续（cooldown 1）；坚持才有用 ──
  {
    id: 'mar_counseling',
    category: 'relationship',
    title: '咨询室的沙发放平了',
    text: '咨询师没有评判谁对谁错，只是让两个人把「你总是」改成「我需要」。五十分钟很短，{name}第一次发现，TA那些让人恼火的习惯背后，全是没说出口的委屈。',
    minAge: 28,
    maxAge: 58,
    cooldown: 1,
    weight: 11,
    priority: 2,
    requires: { tagsAll: ['married', 'marriage_crisis'] },
    choices: [
      {
        text: '坚持咨询一整年',
        tooltip: '每年开销数千元，修的是两个人的功课',
        summary: '一整周一次，{name}学会了先听TA把话说完',
        effects: [
          { money: -1500 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'spouse', deltaCloseness: 7 } },
        ],
        removeTags: ['marriage_crisis'],
        addTags: ['marriage_mended'],
      },
      {
        text: '去了两次，就不去了',
        summary: '咨询费交了，功课没做，问题还是那些问题',
        effects: [
          { money: -800 },
          { attr: 'happiness', delta: -1 },
        ],
      },
    ],
  },
  // ── 第 102 轮：婚后财务磨合（撞题扫描零命中，先谈钱再谈感情）──
  {
    id: 'mar_money_talk',
    category: 'money',
    title: '两个人的账',
    text: '冰箱上贴着一张A4纸，正面是房贷和车贷，反面是水电和买菜。{name}在背面最下面添了一行：「这个月又对不上了。」TA没抬头，只说了句：「你从来没跟我讲过。」',
    minAge: 30,
    maxAge: 55,
    cooldown: 5,
    weight: 9,
    requires: { tagsAll: ['married'], relationKinds: ['spouse'] },
    choices: [
      {
        text: '把账户合并，定个规矩',
        tooltip: '共同账户 + 各自留一笔零花钱',
        summary: '两个人在手机银行里对着屏幕按了半小时，从此不必再对账',
        effects: [
          { money: 800 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'spouse', deltaCloseness: 4 } },
        ],
      },
      {
        text: '只谈这个月的窟窿',
        summary: '窟窿补上了，谁也没提以后怎么办',
        effects: [
          { money: -300 },
          { attr: 'stress', delta: 2 },
        ],
      },
      {
        text: '各管各的，谁也别问谁',
        summary: 'A4纸翻回正面，背面那行字被擦掉了',
        effects: [
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'spouse', deltaCloseness: -3 } },
        ],
      },
    ],
  },
  // ── 第 102 轮：过年去谁家（与 youth_holiday_dilemma 互斥：该局只写已婚小家庭与两边老人的拉扯）──
  {
    id: 'mar_new_year_side',
    category: 'relationship',
    title: '年三十的路线',
    text: '电视里在放倒计时，{name}的手机上躺着两条消息，一条是「来吧，今年在我们家」，一条是「妈已经包好饺子了」。TA问：「今年呢？」',
    minAge: 28,
    maxAge: 52,
    cooldown: 4,
    weight: 10,
    requires: { tagsAll: ['married'], relationKinds: ['spouse'] },
    choices: [
      {
        text: '两边各住一半',
        tooltip: '三十去这家，初一去那家',
        summary: '两头都跑了，两边老人都说「来都来了，别急着走」',
        effects: [
          { money: -1200 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'spouse', deltaCloseness: 3 } },
        ],
      },
      {
        text: '跟TA一起回TA家',
        summary: '那天的电视雪花比什么节目都好看',
        effects: [
          { money: -800 },
          { attr: 'happiness', delta: -1 },
          { relation: { kind: 'spouse', deltaCloseness: 2 } },
        ],
      },
      {
        text: '谁也不回，就在家过',
        summary: '两个人煮了锅速冻饺子，窗外倒数声远远传进来',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'spouse', deltaCloseness: 1 } },
        ],
      },
    ],
  },
  // ── 第 102 轮：中年书信（与 late_old_letter 互斥：该局发生在还写得动的时候）──
  {
    id: 'mar_handwritten_letter',
    category: 'relationship',
    title: '一封手写的信',
    text: '{name}在抽屉最底下翻出一个信封，边角发黄，是自己十几年前写的，字迹用力到划破了纸。上面写着几行那时候不好意思说出口的话。',
    minAge: 38,
    maxAge: 58,
    cooldown: 6,
    weight: 8,
    requires: { tagsAll: ['married'], relationKinds: ['spouse'] },
    choices: [
      {
        text: '把这张纸递给TA看',
        summary: 'TA看完没说话，晚上把那张纸压在了自己的台灯底座下',
        effects: [
          { attr: 'happiness', delta: 3 },
          { relation: { kind: 'spouse', deltaCloseness: 5 } },
        ],
      },
      {
        text: '再写一封现在的',
        summary: '这回写到一半笔停了，最后一行只有一句「还是谢谢你」',
        effects: [
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'spouse', deltaCloseness: 3 } },
        ],
      },
      {
        text: '撕了，夹进一本旧书里',
        summary: '书合上了，那几行字也就留在了十几年前',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
  {
    // ── 第 124 轮（V7）：老线补密 marriage +3 ──
    id: 'mar_money_style',
    category: 'relationship',
    title: '钱袋子怎么管',
    text: '发了工资，账户里的钱各归各的。水电谁交、房贷谁还、人情谁出——婚姻里的经济学，从来没有标准答案，只有商量出来的活法。',
    minAge: 28,
    maxAge: 48,
    cooldown: 5,
    weight: 9,
    requires: { tagsAll: ['married'], relationKinds: ['spouse'] },
    choices: [
      {
        text: '开个共同账户，日子摊开来过',
        summary: '两张工资卡往一个账户里走，谁也没藏着掖着。账目透明了，心也透明了',
        effects: [{ relation: { kind: 'spouse', deltaCloseness: 2 } }],
      },
      {
        text: '各管各的，大头一人一半',
        summary: 'AA 了几年，倒也清净。偶尔谁手头紧，另一人二话不说就转——各管各的，心不各的',
        effects: [{ attr: 'stress', delta: -1 }],
      },
    ],
  },
  {
    id: 'mar_anniversary_upgrade',
    category: 'relationship',
    title: '结婚纪念日这天',
    text: '日历提醒跳出来，{name}才想起今天是纪念日。往年都是一顿饭打发的今年——TA出差前留了句「看你的了」。看我的了？',
    minAge: 30,
    maxAge: 50,
    cooldown: 5,
    weight: 9,
    requires: { tagsAll: ['married'], relationKinds: ['spouse'] },
    choices: [
      {
        text: '补一场两个人的短途旅行',
        tooltip: '机票住宿 5,000 元',
        summary: '把娃托给老人，两人去了趟海边。没有娃在中间喊爸叫妈，突然有点不习惯——原来恋爱时的样子还在',
        effects: [
          { money: -5000 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'spouse', deltaCloseness: 3 } },
        ],
      },
      {
        text: '在家做一桌TA爱吃的菜',
        summary: '锅碗瓢盆响了一下午。TA回家闻到味愣住：「今天什么日子来着？」——笨，但菜是真香',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'spouse', deltaCloseness: 2 } },
        ],
      },
    ],
  },
  {
    id: 'mar_double_shift',
    category: 'relationship',
    title: '双职工的排班表',
    text: '两个人都忙，日历上的班次像两条错开的地铁线。早上谁送娃、晚上谁买菜、周末谁陪娃——婚姻的后半程，拼的是调度。',
    minAge: 30,
    maxAge: 48,
    cooldown: 4,
    weight: 9,
    requires: { tagsAll: ['married'], relationKinds: ['spouse'], careerKinds: ['employed'] },
    choices: [
      {
        text: '错峰下班，换一顿一起吃的早餐',
        summary: '{name}跟主管申请了早到早走。第二天早上，三口人围着一锅粥——久违的、慢慢吃的早餐',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'spouse', deltaCloseness: 2 } },
        ],
      },
      {
        text: '轮流加班，把钱攒下为先',
        summary: '排班表贴在冰箱上，一个月轮一次。加班餐补加绩效，年底账户里的数字慢慢爬坡——苦在当下，账在未来',
        effects: [
          { money: 4000 },
          { attr: 'stress', delta: 2 },
        ],
      },
    ],
  },
]
