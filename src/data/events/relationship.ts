// 第 11 轮：关系事件（友情 / 伴侣 / 家庭 / 单身路线）
// 设计主线：
// - 具体关系状态（朋友/恋人/伴侣/孩子多实例），事件条件直接读取关系种类与亲密度；
// - 破裂与重建：rel_crossroads 分手、rel_reconnect_friend / rel_estranged_parent 复活疏远关系；
// - 读先前选择：estranged_friend / estranged_parent 标记（疏远结算写入）、went_blind_date、
//   tried_again、married、dink、has_child，以及"共同好友评理"要求存活朋友关系；
// - 单身路线完整：rel_blind_date / rel_single_fullness 用 relationKindsNone 门控，
//   恋爱/婚姻事件对单身玩家不可见，单身也有把日子过好的真实选项。
// - 子女生命阶段（第 26 轮）：fam_child_* / fam_grandchild 按孩子真实年龄触发
//   （childStage 条件 + childMilestone 记标记，每孩至多一次；见 engine/children.ts）。
// 金钱量级参考 fin_relative_borrow（1.5 万～3 万级为大事，千元级为日常）。
import type { GameEvent } from '../../engine/types'

export const RELATIONSHIP_EVENTS: GameEvent[] = [
  {
    id: 'rel_keep_friendship',
    category: 'relationship',
    title: '好久没聚了',
    text: '群聊安静了快半年，最后一条消息还停在某个表情包上。{name}翻着通讯录，心想再不约，这帮人真要只剩点赞交情了。',
    minAge: 22,
    maxAge: 42,
    cooldown: 5,
    weight: 10,
    requires: { relationKinds: ['friend'] },
    choices: [
      {
        text: '张罗一场聚会，你来订地方',
        tooltip: '花点钱和心思，友情是要经营的',
        summary: '{name}订了大学常去的那家馆子，一桌人笑闹到打烊',
        effects: [
          { money: -600 },
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'friend', deltaCloseness: 10 } },
        ],
      },
      {
        text: '视频里聊到半夜',
        summary: '{name}和老友隔着屏幕把近况倒了个干净，挂断时窗外都泛白了',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'health', delta: -1 },
          { relation: { kind: 'friend', deltaCloseness: 4 } },
        ],
      },
      {
        text: '算了，都挺忙的',
        summary: '{name}把手机扣下，有些关系就在"下次一定"里淡了',
        effects: [
          { attr: 'stress', delta: -1 },
          { relation: { kind: 'friend', deltaCloseness: -6 } },
        ],
      },
    ],
  },
  {
    id: 'rel_reconnect_friend',
    category: 'relationship',
    title: '通讯录里的旧号码',
    text: '深夜整理手机，{name}翻到一个熟悉的号码——当年闹掰之后，这串数字就再没拨出去过。备注还停在从前。',
    minAge: 22,
    maxAge: 65,
    cooldown: 6,
    weight: 9,
    requires: { tagsAny: ['estranged_friend'] },
    choices: [
      {
        text: '拨通那个号码',
        tooltip: '破冰需要勇气，也可能等来忙音',
        summary: '{name}拨通电话，那头沉默两秒后骂了句"现在才想起来"，声音却带着笑',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'friend', revive: true, closeness: 30 } },
        ],
        removeTags: ['estranged_friend'],
      },
      {
        text: '先发条消息试试水',
        tooltip: '明年这个时候，也许就有回音',
        summary: '{name}编辑了半天，最后只发了句"最近怎么样"',
        effects: [{ attr: 'happiness', delta: 1 }],
        delayed: [
          {
            years: 1,
            relation: { kind: 'friend', revive: true, closeness: 20 },
            summary: '老友回了消息，你们约了顿迟到的饭',
          },
        ],
        removeTags: ['estranged_friend'],
      },
      {
        text: '让过去真的过去',
        summary: '{name}按下删除键，心里像放下一件浸水的行李',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: -2 },
        ],
        removeTags: ['estranged_friend'],
      },
    ],
  },
  {
    id: 'rel_partner_low',
    category: 'relationship',
    title: 'TA 最近不太对劲',
    text: '恋人这几天话变少了，饭吃两口就放下筷子。{name}看在眼里，知道那种沉默背后一定压着事。',
    minAge: 22,
    maxAge: 48,
    // 第 39 轮平衡（300 局对照）：cooldown 5→3。恋人从相亲/初恋落地（45/50）到
    // 求婚门槛之间只靠本事件与冷战事件抬升亲密度，5 年冷却叠加 −1/年自然衰减
    // 会让两次维护最高只到 64（<65 旧门槛），婚姻链在 300 局真实路径下 0% 可达；
    // 冷却收到 3 后两次维护可达 66~71，婚姻弧线对非最优玩法重新打开。
    cooldown: 3,
    weight: 10,
    requires: { relationKinds: ['partner'], minCloseness: { partner: 40 } },
    choices: [
      {
        text: '放下手头一切，陪TA几天',
        tooltip: '最费心神，但也最暖',
        summary: '{name}请了年假陪着到处走走，TA终于在江边把憋了很久的话说了出来',
        effects: [
          { money: -2000 },
          { attr: 'stress', delta: 4 },
          { attr: 'health', delta: -1 },
          { relation: { kind: 'partner', deltaCloseness: 12 } },
        ],
      },
      {
        text: '帮TA把问题拆开一条条分析',
        summary: '{name}拉来白板，两个人写到后半夜，事情好像也没那么难了',
        effects: [
          { attr: 'smarts', delta: 2 },
          { relation: { kind: 'partner', deltaCloseness: 5 } },
        ],
      },
      {
        text: '给彼此留点空间',
        summary: '{name}把书房让给TA，每天默默放一杯热牛奶在门口',
        effects: [
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'partner', deltaCloseness: -3 } },
        ],
      },
    ],
  },
  {
    id: 'rel_quarrel_coldwar',
    category: 'relationship',
    title: '同居后的第一次冷战',
    text: '为了一只没洗的碗，话越说越重，最后摔门声替两个人收了尾。{name}盯着天花板，谁也没先开口。',
    minAge: 22,
    maxAge: 45,
    cooldown: 4,
    weight: 10,
    requires: { relationKinds: ['partner'], minCloseness: { partner: 30 } },
    choices: [
      {
        text: '先低头，认个错',
        summary: '{name}煮了两碗面，把那碗多加了蛋的推了过去，冷战在热气里化了',
        effects: [
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'partner', deltaCloseness: 8 } },
        ],
      },
      {
        text: '冷战到底，谁也别理谁',
        summary: '{name}和TA在一间屋里活成了两个时区，空气能拧出水来',
        effects: [
          { attr: 'stress', delta: 5 },
          { attr: 'happiness', delta: -3 },
          { relation: { kind: 'partner', deltaCloseness: -15 } },
        ],
      },
      {
        text: '找共同好友评评理',
        tooltip: '需要有一位还联系的朋友',
        summary: '老友两头劝了一晚上，最后甩下一句"你俩就是没事闲的"，倒把两人说笑了',
        effects: [
          { attr: 'social', delta: 2 },
          { relation: { kind: 'friend', deltaCloseness: 4 } },
          { relation: { kind: 'partner', deltaCloseness: 3 } },
        ],
        requires: { relationKinds: ['friend'] },
      },
    ],
  },
  {
    id: 'rel_crossroads',
    category: 'relationship',
    title: '走到岔路口的感情',
    text: '不知道从哪天起，约会变成了打卡，晚安变成了表情包。{name}心里清楚，这段感情站在岔路口，总得有人先伸手，或者先松手。',
    minAge: 20,
    maxAge: 40,
    cooldown: 3,
    weight: 11,
    requires: { relationKinds: ['partner'], maxCloseness: { partner: 25 } },
    choices: [
      {
        text: '长痛不如短痛，分开吧',
        summary: '{name}把钥匙放回桌面，两个人都哭了，但都知道这是对的',
        effects: [
          { attr: 'stress', delta: -5 },
          { attr: 'happiness', delta: -2 },
          { attr: 'social', delta: -2 },
          { relation: { kind: 'partner', remove: true } },
        ],
        addTags: ['broke_up'],
      },
      {
        text: '把话说开，再认真试一年',
        tooltip: '一年后见分晓',
        summary: '{name}约TA在初次见面的那家店坐了一整晚，把攒了半年的话都说完了',
        effects: [{ attr: 'stress', delta: 2 }],
        delayed: [
          {
            years: 1,
            relation: { kind: 'partner', deltaCloseness: 15 },
            summary: '那次长谈之后，感情慢慢回温了',
          },
        ],
        addTags: ['tried_again'],
      },
      {
        text: '什么都不做，就这么拖着',
        summary: '{name}选择了最省事的答案，也选择了最贵的代价',
        effects: [
          { attr: 'happiness', delta: -3 },
          { attr: 'stress', delta: 5 },
          { relation: { kind: 'partner', deltaCloseness: -5 } },
        ],
      },
    ],
  },
  {
    id: 'rel_propose',
    category: 'relationship',
    title: '戒指已经挑好了',
    text: '抽屉最里层躺着一枚戒指，{name}排练了很多遍求婚的话。这些年风风雨雨走过来，好像就差一个正式的名分了。',
    minAge: 25,
    maxAge: 45,
    cooldown: 3,
    // 第 39 轮平衡（300 局对照）：weight 12→18。求婚资格窗由落地 55 与维护事件撑开
    // 后，年命中率仍只有 ~4.5%（候选池 ~25 事件），资格年 495 年仅 23 次抽中；
    // 上调后婚姻成为普通可选项而非彩蛋，冷却 3 仍防连年刷求婚。
    weight: 18,
    requires: {
      relationKinds: ['partner'],
      relationKindsNone: ['spouse'],
      // 第 39 轮平衡（300 局对照）：65→50。恋人落地亲密度即 45（相亲）/50（初恋），
      // 年衰减 −1；旧门槛 65 要求「两次维护事件 + 求婚」三连击全部命中衰减窗口，
      // 300 局真实路径 0 婚姻、整条家庭内容链不可达。50 = 恋人落地值——新恋识即具
      // 求婚资格（仍需花销选项），旧恋人经一次维护（+5~+12）也能重回资格线，
      // 婚姻弧线重开且感情仍需经营（衰减不删，冷战后可能再跌破）。
      minCloseness: { partner: 50 },
    },
    choices: [
      {
        text: '办一场体面的婚礼，把亲戚朋友都请来',
        tooltip: '花销不小，但这一天只此一次',
        summary: '{name}单膝跪地的那一幕被全场的手机记录下来，婚礼办得热热闹闹',
        effects: [
          { money: -30000 },
          { attr: 'happiness', delta: 8 },
          { attr: 'stress', delta: 4 },
          { attr: 'social', delta: 3 },
          { relation: { kind: 'spouse', convertFrom: 'partner' } },
        ],
        requires: { moneyAtLeast: 30000 },
        addTags: ['married'],
      },
      {
        text: '旅行结婚，两个人说走就走',
        tooltip: '省下酒席钱，去看海',
        summary: '{name}和TA在海边交换了戒指，婚礼照片只有九张，张张都好看',
        effects: [
          { money: -8000 },
          { attr: 'happiness', delta: 6 },
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'spouse', convertFrom: 'partner' } },
        ],
        requires: { moneyAtLeast: 8000 },
        addTags: ['married'],
      },
      {
        text: '再等等，先把自己的事安顿好',
        summary: '{name}把戒指放回抽屉，TA说了句"我等你"，笑得有点勉强',
        effects: [
          { attr: 'smarts', delta: 2 },
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'partner', deltaCloseness: -3 } },
        ],
      },
    ],
  },
  {
    id: 'rel_blind_date',
    category: 'relationship',
    title: '亲戚介绍的相亲',
    text: '家庭群里转来一条消息："姑娘/小伙子条件不错，见见？"照片看着挺顺眼，约在周末下午的咖啡店。{name}盯着屏幕犹豫了。',
    minAge: 24,
    maxAge: 40,
    cooldown: 4,
    weight: 9,
    requires: { relationKindsNone: ['partner', 'spouse'] },
    choices: [
      {
        text: '认真去见一见',
        tooltip: '也许就是这个人',
        summary: '{name}提前二十分钟到了咖啡店，聊得比想象中投缘，交换了联系方式',
        effects: [
          { attr: 'social', delta: 2 },
          { attr: 'stress', delta: 2 },
        ],
        delayed: [
          {
            years: 1,
            // 第 39 轮平衡（300 局对照）：落地 45→55。旧值配 −1/年衰减 + 65 求婚门槛
            // 让婚姻链数学性封死；55 落地即跨过新资格线 50，此后 5 年为自然求婚窗。
            relation: { kind: 'partner', add: true, name: '小赵', closeness: 55 },
            summary: '和相亲对象几次来往之后，{name}确定了关系',
          },
        ],
        addTags: ['went_blind_date'],
      },
      {
        text: '去露个脸，敷衍一下',
        summary: '{name}全程礼貌微笑，回家路上给介绍人回了句"人挺好，不合适"',
        effects: [
          { attr: 'happiness', delta: -1 },
          { relation: { kind: 'parent', deltaCloseness: 3 } },
        ],
      },
      {
        text: '直接回绝，别耽误人家',
        summary: '{name}回得干脆，那头骂了句"死脑筋"，倒也没真生气',
        effects: [
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'parent', deltaCloseness: -4 } },
        ],
      },
    ],
  },
  {
    id: 'rel_single_fullness',
    category: 'relationship',
    title: '一个人的完整',
    text: '同事在晒娃，同学在晒婚纱照，{name}的周末却自由得像一整片旷野。一个人的日子，也能过得有声有色——只是得自己有心气儿。',
    minAge: 26,
    maxAge: 55,
    cooldown: 6,
    weight: 8,
    requires: { relationKindsNone: ['partner', 'spouse'] },
    choices: [
      {
        text: '把日子过成自己喜欢的样子',
        summary: '{name}换了落地的书架，添了台好咖啡机，屋里第一次有了"家"的样子',
        effects: [
          { money: -1200 },
          { attr: 'happiness', delta: 6 },
        ],
      },
      {
        text: '加入周末徒步团',
        tooltip: '山里能遇到聊得来的人',
        summary: '{name}跟着队伍翻过第一座山，山顶的风把班味儿吹得干干净净',
        effects: [
          { money: -800 },
          { attr: 'health', delta: 2 },
          { attr: 'social', delta: 4 },
          { relation: { kind: 'friend', add: true, name: '驴友老周', closeness: 45 } },
        ],
      },
      {
        text: '报个夜校，给自己充电',
        summary: '{name}的笔记本上又爬满了字，久违的心流回来了',
        effects: [
          { money: -1500 },
          { attr: 'smarts', delta: 3 },
          { attr: 'stress', delta: 2 },
          { addSkill: { id: 'academics', delta: 2 } },
        ],
      },
    ],
  },
  {
    id: 'rel_child_question',
    category: 'relationship',
    title: '两个人的下一步',
    text: '婚后的日子安稳流淌，饭桌上忽然有人提起："该要孩子了吗？"{name}和TA对视了一眼，谁也没立刻接话。',
    minAge: 26,
    maxAge: 40,
    cooldown: 4,
    // 第 39 轮平衡（300 局对照）：weight 12→22。生育选项对综合评分策略天然偏负
    // （即期成本 vs 延迟幸福），提高入场频率让轮换/随机策略也有现实概率触达
    // 「要孩子」；下游子女里程碑/孙辈链（三代同堂）依赖本事件入场次数。
    weight: 22,
    // has_child 门控：引擎的孩子 add 只在无存活孩子时生效，已育夫妻再选只会扣钱+谎报"孩子出生"
    requires: { relationKinds: ['spouse'], tagsNone: ['has_child', 'dink'] }, // 第 91 轮：丁克约定压制生育议题
    choices: [
      {
        text: '要个孩子吧',
        tooltip: '生活从此换一个频道',
        summary: '{name}和TA开始囤育儿书、研究奶粉，紧张又期待',
        effects: [
          { money: -5000 },
          { attr: 'stress', delta: 2 },
        ],
        delayed: [
          {
            years: 1,
            relation: { kind: 'child', add: true, name: '宝宝', closeness: 65 },
            summary: '孩子出生了，{name}的生活从此换了频道',
          },
          { years: 1, attr: 'happiness', delta: 6, summary: '' },
        ],
        addTags: ['has_child'],
      },
      {
        text: '再等一年，先把住处安顿好',
        summary: '{name}算了算存款和房间数，两个人一致同意"再缓缓"',
        effects: [
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'spouse', deltaCloseness: 2 } },
        ],
      },
      {
        text: '商量好了，两人世界也很好',
        summary: '{name}和TA击掌为盟，把省下的养育钱记进了旅行基金',
        effects: [
          { attr: 'happiness', delta: 3 },
          { relation: { kind: 'spouse', deltaCloseness: 4 } },
        ],
        addTags: ['dink'],
      },
    ],
  },
  {
    id: 'rel_parent_low',
    category: 'relationship',
    title: '和家里越来越没话说',
    text: '通话记录里的"家里"一栏，最长的一次通话是三分钟，内容是"吃了""吃了""挂了吧"。{name}盯着屏幕，忽然有点心虚。',
    minAge: 20,
    maxAge: 60,
    cooldown: 4,
    weight: 11,
    requires: { relationKinds: ['parent'], maxCloseness: { parent: 15 } },
    choices: [
      {
        text: '主动打个长电话回去',
        summary: '{name}陪着电话那头聊了一个钟头的家常，挂断时鼻子有点酸',
        effects: [
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'parent', deltaCloseness: 12 } },
        ],
      },
      {
        text: '寄一箱老家的东西回去',
        summary: '{name}买了长辈念叨过的营养品寄回去，收到的是一张摆得很正的"收到了"照片',
        effects: [
          { money: -1000 },
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'parent', deltaCloseness: 8 } },
        ],
      },
      {
        text: '就这样吧，各有各的日子',
        summary: '{name}把手机放下，那点心虚很快被日子盖了过去',
        effects: [
          { attr: 'happiness', delta: -2 },
          { relation: { kind: 'parent', deltaCloseness: -5 } },
        ],
      },
    ],
  },
  {
    id: 'rel_estranged_parent',
    category: 'relationship',
    title: '过年没回的家',
    text: '年三十的爆竹声隔着手机屏幕传来，家里的号码在通讯录里躺了一整年。{name}盯着那三个字，拇指悬在拨号键上。',
    minAge: 20,
    maxAge: 70,
    cooldown: 5,
    weight: 12,
    requires: { tagsAny: ['estranged_parent'] },
    choices: [
      {
        text: '先拨一个电话',
        tooltip: '破冰很难，但总有第一个人要先开口',
        summary: '{name}拨通电话，那头第一句话是"吃饭了吗"，两个人都没再提从前',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'parent', revive: true, closeness: 20 } },
        ],
        removeTags: ['estranged_parent'],
      },
      {
        text: '托表姐先带句问候',
        tooltip: '让台阶先搭起来',
        summary: '{name}给表姐转了句"替我问家里好"，表姐回了个"早该这样"的表情包',
        effects: [{ attr: 'happiness', delta: 1 }],
        delayed: [
          {
            years: 1,
            relation: { kind: 'parent', revive: true, closeness: 15 },
            summary: '家里捎来一句"过年回来吃饭"，台阶搭好了',
          },
        ],
        removeTags: ['estranged_parent'],
      },
      {
        text: '让时间冲淡一切',
        summary: '{name}关掉通讯录，窗外的烟花替谁都没说话',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: -1 },
        ],
      },
    ],
  },
  // 第 13 轮因果链：youth_friend_loan「借钱给老友」(lent_money) → 本事件。
  // 雪中送炭的情分，会在很多年后以意想不到的方式回来。
  {
    id: 'rel_old_friend_success',
    category: 'relationship',
    title: '老友的船开了',
    text: '当年那个开口借五千块的老友，如今生意做起来了，专程开车来接{name}吃饭。席间他搓着手说："兄弟，当年那五千块，我一直记着。现在有个事想请你入伙。"',
    minAge: 28,
    maxAge: 48,
    once: true,
    weight: 11,
    priority: 1,
    requires: { tagsAll: ['lent_money'] },
    choices: [
      {
        text: '入伙，投两万进去',
        tooltip: '信任放在明面上，赚赔都认',
        summary: '{name}把转账截图发过去，配了句"当年借你是信你，现在也一样"',
        effects: [
          { money: -20000 },
          { attr: 'social', delta: 2 },
        ],
        delayed: [{ years: 2, money: 36000, attr: 'happiness', delta: 1, summary: '老友的第二家分店开张，分红准时到了账' }],
        requires: { moneyAtLeast: 20000 },
        addTags: ['business_partner'],
      },
      {
        text: '钱不入伙，人要多走动',
        tooltip: '不押钱，情分照旧',
        summary: '那顿饭吃到打烊，谁也没再提"入伙"两个字，但比任何时候都像兄弟',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'friend', add: true, name: '老友阿凯', closeness: 70 } },
        ],
      },
      {
        text: '谢礼收下，各走各路',
        summary: '{name}收下了那条软中华，把人情账在心里记成了两清',
        effects: [
          { money: 5000 },
          { attr: 'happiness', delta: 1 },
        ],
      },
    ],
  },
  // 第 13 轮因果链：mid_parent_health「全力治疗」(cared_for_parents) → 本事件。
  // 中年时跑过的医院、垫过的医药费，父母都记着；晚年的陪伴是他们攒了很久的盼头。
  {
    id: 'rel_parents_tender_years',
    category: 'relationship',
    title: '你陪他们变老',
    text: '父母的头发已经全白了。那张当年你垫了医药费的缴费单，母亲一直夹在旧相册里——她说不是舍不得扔，是想记着"孩子靠得住"。{name}翻到那一页，半天没说出话。',
    minAge: 58,
    maxAge: 75,
    once: true,
    weight: 12,
    priority: 1,
    requires: { tagsAll: ['cared_for_parents'], relationKinds: ['parent'] },
    choices: [
      {
        text: '接他们过来一起住',
        tooltip: '热闹，也琐碎',
        summary: '老两口搬来的第一周，家里飘着一日三餐的香气，也多了些拌嘴声',
        effects: [
          { attr: 'happiness', delta: 3 },
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'parent', deltaCloseness: 8 } },
        ],
      },
      {
        text: '每周回去，把老照片理一遍',
        summary: '{name}学会了听那些讲过八百遍的往事，并且每次都像第一次听',
        effects: [
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'parent', deltaCloseness: 5 } },
        ],
      },
      {
        text: '请个住家护工，自己常去看',
        tooltip: '专业照顾，花销不小',
        summary: '护工把老人照顾得妥帖，{name}每周日的探望成了全家的固定节目',
        effects: [
          { money: -18000 },
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'parent', deltaCloseness: 4 } },
        ],
        requires: { moneyAtLeast: 18000 },
      },
    ],
  },
  // 第 25 轮关系动态：维护类事件（问候/聚会/纪念日）真实恢复亲密度——
  // 引擎的年度自然衰减（朋友/恋人 -2、配偶/父母/孩子 -1）要求关系有常态经营入口；
  // 聚会已有 rel_keep_friendship，这里补齐朋友问候、父母问候与配偶纪念日。
  {
    id: 'rel_friend_checkin',
    category: 'relationship',
    title: '置顶对话框里的沉默',
    text: '置顶的那位老友，对话框停在一个月前的"哈哈哈"。{name}盯着输入框打了几行又删掉——其实也没吵没闹，就是都忙。',
    minAge: 19,
    maxAge: 55,
    cooldown: 3,
    weight: 9,
    requires: { relationKinds: ['friend'] },
    choices: [
      {
        text: '好好回一条，把见面定下来',
        tooltip: '友情是要经营的',
        summary: '{name}回了长长一段近况，末尾敲定下个月的老地方——那头发来一个大拇指',
        effects: [
          { attr: 'social', delta: 1 },
          { relation: { kind: 'friend', deltaCloseness: 5 } },
        ],
      },
      {
        text: '直接拨过去，语音聊到后半夜',
        summary: '{name}和老友从工作聊到小时候，挂断时窗外都泛白了，第二天顶着黑眼圈上班',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'health', delta: -1 },
          { relation: { kind: 'friend', deltaCloseness: 3 } },
        ],
      },
      {
        text: '点个赞，继续已读不回',
        summary: '{name}给那条动态点了赞，对话框依然安静——有些关系就是这样淡下去的',
        effects: [
          { attr: 'happiness', delta: -1 },
          { relation: { kind: 'friend', deltaCloseness: -4 } },
        ],
      },
    ],
  },
  {
    id: 'rel_parent_greeting',
    category: 'relationship',
    title: '一通寻常的电话',
    text: '晚饭刚吃完，手机响了，备注是"妈"。其实没什么事，无非是"吃了吗""降温了""别老点外卖"。{name}握着手机，忽然想起自己很久没主动打过去了。',
    minAge: 20,
    maxAge: 60,
    cooldown: 3,
    weight: 10,
    requires: { relationKinds: ['parent'] },
    choices: [
      {
        text: '陪他们聊一个钟头的家常',
        summary: '{name}听完了广场舞、菜价和邻居家孙子的一整个学期，挂断时那头的笑声很响亮',
        effects: [
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'parent', deltaCloseness: 8 } },
        ],
      },
      {
        text: '寄一箱保暖的、养生的回去',
        summary: '{name}照着购物车里攒了半年的清单下了单，收到的"收到了"照片摆得整整齐齐',
        effects: [
          { money: -800 },
          { relation: { kind: 'parent', deltaCloseness: 6 } },
        ],
      },
      {
        text: '"在忙，回聊"——三句话挂断',
        summary: '{name}把电话夹在肩膀上改方案，最后只说了句"回聊"。那头"哦"了一声，先挂了',
        effects: [
          { attr: 'happiness', delta: -1 },
          { relation: { kind: 'parent', deltaCloseness: -5 } },
        ],
      },
    ],
  },
  {
    id: 'rel_anniversary',
    category: 'relationship',
    title: '日历上的红圈',
    text: '手机弹出提醒：明天是结婚纪念日。{name}和TA这些年过得平实，红圈里的日子却一年没漏过——今年好像差点就忘了。',
    minAge: 26,
    maxAge: 70,
    cooldown: 4,
    weight: 10,
    requires: { relationKinds: ['spouse'] },
    choices: [
      {
        text: '订下TA念叨了很久的那家餐厅',
        tooltip: '花销不小，但值得',
        summary: '{name}把日子过成了当年的约会，TA换了个发型出门，路上一直偷着笑',
        effects: [
          { money: -3000 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'spouse', deltaCloseness: 8 } },
        ],
      },
      {
        text: '在家复刻第一顿饭的菜单',
        summary: '{name}照着记忆把当年那桌菜还原了一遍，咸了半道糊了一道，两个人笑作一团',
        effects: [
          { money: -300 },
          { relation: { kind: 'spouse', deltaCloseness: 5 } },
        ],
      },
      {
        text: '忙忘了，补救已经来不及',
        summary: 'TA说"没事，日子而已"，然后那晚客厅的灯很晚才关',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'spouse', deltaCloseness: -8 } },
        ],
      },
    ],
  },
  // 第 25 轮关系动态：父母 60+ 健康下滑事件线（父母年龄 ≈ 玩家年龄 + 28，32 岁起父母迈过 60）。
  // 照护抉择三选（接同住/花钱/花精力）都是真实照护，复用 cared_for_parents 标记体系——
  // 与 mid_parent_health（手术危机）、rel_parents_tender_years（晚年陪伴）构成三台阶；
  // 只是转钱不算照护，不授标记。负债时两个大额选项隐藏，仍保有两个有效抉择。
  {
    id: 'rel_parent_frail',
    category: 'relationship',
    title: '楼梯越来越长了',
    text: '回家时发现，父亲在楼道里歇了两次才上来；母亲把同一件事讲了两遍，讲第二遍时父亲悄悄摆手。{name}忽然意识到，爸妈是真的老了。',
    minAge: 32,
    maxAge: 70,
    cooldown: 5,
    weight: 11,
    requires: { relationKinds: ['parent'] },
    choices: [
      {
        text: '接他们过来一起住',
        tooltip: '热闹，也琐碎',
        summary: '老两口的针线笸箩和腌菜坛子搬进了家门，饭点准时有了响动',
        effects: [
          { money: -8000 },
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: 3 },
          { relation: { kind: 'parent', deltaCloseness: 8 } },
        ],
        addTags: ['cared_for_parents'],
      },
      {
        text: '出钱做适老化改造，再请个钟点护工',
        tooltip: '扶手、防滑垫、每周三次上门',
        summary: '{name}把老屋的卫生间装了扶手，护工阿姨的菜谱贴在冰箱上，老人嘴上嫌贵，身体却舒展了',
        effects: [
          { money: -15000 },
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'parent', deltaCloseness: 4 } },
        ],
        requires: { moneyAtLeast: 15000 },
        addTags: ['cared_for_parents'],
      },
      {
        text: '每周雷打不动回去陪一天',
        tooltip: '花的是精力，省下的是钱',
        summary: '{name}把周日设成了不可占用的日子，陪买菜、陪挂号、陪晒被子，风雨无阻',
        effects: [
          { money: -500 },
          { attr: 'stress', delta: 3 },
          { attr: 'health', delta: -1 },
          { relation: { kind: 'parent', deltaCloseness: 10 } },
        ],
        addTags: ['cared_for_parents'],
      },
      {
        text: '转一笔钱过去，让他们自己安排',
        summary: '{name}转了钱说了句"缺什么自己买"，电话那头应了一声，像还有话没说',
        effects: [
          { money: -2500 },
          { attr: 'happiness', delta: -2 },
          { relation: { kind: 'parent', deltaCloseness: -6 } },
        ],
      },
    ],
  },

  // ── 子女生命阶段（第 26 轮）───────────────────────────────
  // 孩子按真实年龄长大：升学 12 / 15 / 18，就业 22，婚嫁 26，孙辈 29（须先成家）。
  // 资格 = 存活且出生年龄已知的孩子落在 childStage 年龄窗（unknown 年龄不触发）；
  // 每个里程碑对每个孩子至多一次——资格由 milestonePending 保证，办过即不再出现；
  // 选项效果 childMilestone 给条件解析出的同一个孩子记标记（validateEvents 锁定一致）。
  // 多孩同年达标时先办最年长的，来年轮到下一个（pickChildByStage 出生次序解析）。
  // 负债时大额选项被门槛隐藏后，均保有 2 个有效抉择（≥2 规则）。
  {
    id: 'fam_child_junior',
    category: 'relationship',
    title: '孩子的书包变沉了',
    text: '孩子小学毕业了。家长群里一夜之间冒出好几个"新生群"，{name}翻着群文件里的初中划片通知，饭桌上第一次严肃地聊起了"前程"两个字。',
    minAge: 18,
    maxAge: 77,
    weight: 12,
    priority: 2,
    requires: { childStage: { atLeast: 12, below: 15, milestonePending: 'ms_junior' } },
    choices: [
      {
        text: '托关系挤重点班',
        tooltip: '择校费加暑期衔接班，一笔不小的开销',
        summary: '孩子进了重点班，{name}的钱包瘪了一圈，饭桌上的话题也变成了排名',
        effects: [
          { money: -8000 },
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'child', deltaCloseness: -2, milestoneTarget: true } },
          { childMilestone: 'ms_junior' },
        ],
      },
      {
        text: '就近入学，省下钱多陪陪孩子',
        summary: '{name}没折腾择校，周末带孩子去了三趟博物馆，父子俩的话反而多了起来',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: -1 },
          { relation: { kind: 'child', deltaCloseness: 3, milestoneTarget: true } },
          { childMilestone: 'ms_junior' },
        ],
      },
      {
        text: '报个孩子自己喜欢的兴趣班',
        tooltip: '不卷成绩，先护住那点热乎劲儿',
        summary: '孩子抱着新买的画板睡了好几晚，{name}觉得这钱花得值',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: 4, milestoneTarget: true } },
          { childMilestone: 'ms_junior' },
        ],
      },
    ],
  },
  {
    id: 'fam_child_senior',
    category: 'relationship',
    title: '十五岁的岔路口',
    text: '中考出分了，查分页面一家人轮着刷，离普高线差了几分。读职校还是想办法上高中，这一晚谁都没睡好。',
    minAge: 18,
    maxAge: 77,
    weight: 12,
    priority: 2,
    requires: { childStage: { atLeast: 15, below: 18, milestonePending: 'ms_senior' } },
    choices: [
      {
        text: '想办法供孩子上普高',
        tooltip: '借读费加上课外补习，压力不小',
        summary: '孩子坐进了高中教室，{name}把往后两年的账又盘了一遍',
        effects: [
          { money: -6000 },
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'child', deltaCloseness: 1, milestoneTarget: true } },
          { childMilestone: 'ms_senior' },
        ],
      },
      {
        text: '送孩子去职校学门手艺',
        tooltip: '学费不高，孩子也肯学',
        summary: '孩子在实训车间里找到了感觉，做的第一个工件被老师留作了教具',
        effects: [
          { money: -2000 },
          { relation: { kind: 'child', deltaCloseness: 3, milestoneTarget: true } },
          { childMilestone: 'ms_senior' },
        ],
      },
      {
        text: '让孩子自己拿主意',
        summary: '孩子想了三个晚上，最后自己填了志愿，{name}签字那天手有点抖',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: 2, milestoneTarget: true } },
          { childMilestone: 'ms_senior' },
        ],
      },
    ],
  },
  {
    id: 'fam_child_gaokao',
    category: 'relationship',
    title: '十八岁的志愿表',
    text: '孩子成年了，大学录取通知和招工启事一起摆上了桌。{name}忽然意识到，那个总跟在身后的小尾巴，要独自出门了——不管选哪条路，头几年吃住用度，家里都还得再搭把手。',
    minAge: 18,
    maxAge: 77,
    weight: 12,
    priority: 2,
    requires: { childStage: { atLeast: 18, below: 21, milestonePending: 'ms_adult' } },
    choices: [
      {
        text: '学费生活费一力承担',
        tooltip: '四年下来是一笔大数目，但孩子可以心无旁骛',
        summary: '{name}把学费打进卡里，只嘱咐了一句"别省饭钱"',
        effects: [
          { money: -12000 },
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: 3, milestoneTarget: true } },
          { childMilestone: 'ms_adult' },
        ],
      },
      {
        text: '助学贷款加家里贴补生活费',
        tooltip: '孩子自己扛一半，家里贴一半',
        summary: '开学那天，孩子把贷款合同收进了自己的背包',
        effects: [
          { money: -2500 },
          { relation: { kind: 'child', deltaCloseness: 2, milestoneTarget: true } },
          { childMilestone: 'ms_adult' },
        ],
      },
      {
        text: '尊重孩子想先工作闯闯的想法',
        summary: '孩子进了第一家单位实习，{name}嘴上不说，夜里还是把劳动法翻了一遍',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: 1, milestoneTarget: true } },
          { childMilestone: 'ms_adult' },
        ],
      },
    ],
  },
  {
    id: 'fam_child_first_job',
    category: 'relationship',
    title: '孩子的第一份工作',
    text: '孩子入职了。{name}想起自己刚工作那年那点窘迫，想帮一把，又怕帮多了反而耽误了TA。',
    minAge: 18,
    maxAge: 77,
    weight: 12,
    priority: 2,
    requires: { childStage: { atLeast: 22, below: 25, milestonePending: 'ms_job' } },
    choices: [
      {
        text: '资助半年房租，让TA站稳脚跟',
        tooltip: '头几个月最难，做父母的搭把手',
        summary: '孩子在出租屋里支起了小书桌，周末打电话的声音都亮了几度',
        effects: [
          { money: -6000 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'child', deltaCloseness: 3, milestoneTarget: true } },
          { childMilestone: 'ms_job' },
        ],
      },
      {
        text: '塞一张购物卡意思意思',
        summary: '孩子嘴上说不用，收下的时候眼睛弯了弯',
        effects: [
          { money: -800 },
          { relation: { kind: 'child', deltaCloseness: 1, milestoneTarget: true } },
          { childMilestone: 'ms_job' },
        ],
      },
      {
        text: '只传经验，不出钱',
        summary: '{name}把自己踩过的坑一条条讲给孩子听，剩下的路让TA自己走',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: 2, milestoneTarget: true } },
          { childMilestone: 'ms_job' },
        ],
      },
    ],
  },
  {
    id: 'fam_child_wedding',
    category: 'relationship',
    title: '孩子的喜帖',
    text: '孩子要成家了。喜帖印得喜庆，{name}戴上老花镜看了很久，既是欣慰，也默默盘算起了手里的存折。',
    minAge: 18,
    maxAge: 77,
    weight: 12,
    priority: 2,
    // 第 62 轮：婚礼窗 26–28 → 26–30（孙链瓶颈校准——R62 漏斗实证：婚礼里程碑
    // 两年窗内未抽到则 ms_wedding 永不完成、整条孙链断链；放宽两年让成家链更稳）。
    requires: { childStage: { atLeast: 26, below: 30, milestonePending: 'ms_wedding' } },
    choices: [
      {
        text: '彩礼嫁妆都备上，风光大办',
        tooltip: '掏一块老本，换孩子一辈子记得的热闹',
        summary: '婚礼上司仪把话筒递给{name}，一句"祝你们白头到老"说得眼眶发热',
        effects: [
          { money: -30000 },
          { attr: 'happiness', delta: 3 },
          { relation: { kind: 'child', deltaCloseness: 5, milestoneTarget: true } },
          { childMilestone: 'ms_wedding' },
        ],
      },
      {
        text: '帮着从简操办',
        summary: '两家人一桌饭把大事定了，孩子说这样挺好，不折腾',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'child', deltaCloseness: 3, milestoneTarget: true } },
          { childMilestone: 'ms_wedding' },
        ],
      },
      {
        text: '和孩子坦诚聊聊家底，量力而行',
        summary: '{name}把存折摊开给孩子看，孩子听完说：日子是我们自己过的，您别硬撑',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: 2, milestoneTarget: true } },
          { childMilestone: 'ms_wedding' },
        ],
      },
    ],
  },
  {
    id: 'fam_grandchild',
    category: 'relationship',
    title: '家里添了小成员',
    text: '孩子的孩子出生了。{name}抱起那个皱巴巴的小家伙，忽然想起自己孩子刚出生时的模样——两代人的日子，在这一刻接上了头。',
    minAge: 18,
    maxAge: 77,
    weight: 12,
    priority: 2,
    // 第 62 轮：孙辈门槛 29→26（任务书双通道之通道一：孩子 ≥26 且已成家）。
    // 婚礼里程碑在 26–28 窗办理（fam_child_wedding），ms_wedding 完成即具备
    // 迎接孙辈资格——原 29 岁闸把可达窗压缩到玩家 55+ 的晚段（R62 漏斗实证）。
    requires: { childStage: { atLeast: 26, milestonePending: 'ms_grandchild', milestoneDone: 'ms_wedding' } },
    choices: [
      {
        text: '搬过去帮着带娃',
        tooltip: '出人出力，累是真累',
        summary: '{name}学会了新式冲奶粉的手法，也重新尝到了缺觉的滋味',
        effects: [
          { attr: 'stress', delta: 3 },
          { attr: 'health', delta: -1 },
          { attr: 'happiness', delta: 4 },
          { relation: { kind: 'child', deltaCloseness: 6, milestoneTarget: true } },
          // 第 44 轮：孙辈落为真实关系（grandchild，乳名池具名+birthAge 盖章）；
          // addAnother 支持多孩成家各添一孙
          { relation: { kind: 'grandchild', add: true, addAnother: true, closeness: 55 } },
          { childMilestone: 'ms_grandchild' },
        ],
      },
      {
        text: '出钱请个月嫂搭把手',
        tooltip: '专业的事交给专业的人',
        summary: '月嫂上门那天，孩子松了一口气，{name}也落得清闲',
        effects: [
          { money: -9000 },
          { attr: 'happiness', delta: 3 },
          { relation: { kind: 'child', deltaCloseness: 4, milestoneTarget: true } },
          { relation: { kind: 'grandchild', add: true, addAnother: true, closeness: 50 } },
          { childMilestone: 'ms_grandchild' },
        ],
      },
      {
        text: '包个红包贺喜，不多打扰',
        summary: '{name}包了个厚红包，嘱咐小两口按自己的节奏来',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'child', deltaCloseness: 2, milestoneTarget: true } },
          { relation: { kind: 'grandchild', add: true, addAnother: true, closeness: 45 } },
          { childMilestone: 'ms_grandchild' },
        ],
      },
    ],
  },
  // ── 第 44 轮：含饴弄孙（轻量年度小事件，每孙辈至多一次）——孙辈真实关系
  //    的亲密度维护出口（grandchild 年度衰减 0，亲密度由本事件增长）；
  //    资格=存在 3 岁以上、未办过「含饴弄孙的下午」的孙辈。
  {
    id: 'fam_grandchild_time',
    category: 'relationship',
    title: '含饴弄孙的下午',
    text: '小家伙被送过来过一个下午。{name}把藏了好久的点心拿了出来，讲了一遍当年孩子小时候的糗事——小家伙听得眼睛发亮，比任何观众都捧场。',
    minAge: 18,
    maxAge: 77,
    weight: 10,
    priority: 1,
    requires: { childStage: { kind: 'grandchild', atLeast: 3, milestonePending: 'ms_spoil_afternoon' } },
    choices: [
      {
        text: '带去公园，喂一下午鸽子',
        tooltip: '腿是累的，心是满的',
        summary: '一下午走了八千步，{name}讲当年故事的素材全用光了',
        effects: [
          { money: -300 },
          { attr: 'happiness', delta: 5 },
          { attr: 'health', delta: 1 },
          { relation: { kind: 'grandchild', deltaCloseness: 5, milestoneTarget: true } },
          { childMilestone: 'ms_spoil_afternoon' },
        ],
      },
      {
        text: '在家捏面团，捏了一桌子小动物',
        summary: '面粉糊了半个厨房，小动物摆了一窗台',
        effects: [
          { money: -100 },
          { attr: 'happiness', delta: 4 },
          { relation: { kind: 'grandchild', deltaCloseness: 4, milestoneTarget: true } },
          { childMilestone: 'ms_spoil_afternoon' },
        ],
      },
      {
        text: '把老照片翻出来，指给小家伙认人',
        summary: '「这个是你爸爸小时候」——小家伙笑得直打跌',
        effects: [
          { attr: 'happiness', delta: 3 },
          { attr: 'smarts', delta: 1 },
          { relation: { kind: 'grandchild', deltaCloseness: 3, milestoneTarget: true } },
          { childMilestone: 'ms_spoil_afternoon' },
        ],
      },
    ],
  },
  // ── 第 46 轮：婚恋入口扩展——单身线进入婚恋的路更多（任务书 ≥4）。
  //    与 rel_blind_date（亲戚介绍，静态名「小赵」）同构：relationKindsNone 单身门槛 +
  //    延迟一年落地 partner（55 跨求婚资格线 / 45 需一次维护），名字缺省走第 44 轮
  //    伴侣名池 seed 确定具名。四入口年龄段各异、各有处境门槛，互相 cd 不叠加。
  {
    id: 'rel_old_flame',
    category: 'relationship',
    title: '婚礼上重逢的旧相识',
    text: '朋友的婚礼散场，{name}在门口撞见了多年没联系的旧相识。当年没说出口的话，隔着几杯喜酒的功夫，忽然又有了开口的余地。',
    minAge: 28,
    maxAge: 42,
    cooldown: 4,
    weight: 9,
    requires: { relationKindsNone: ['partner', 'spouse'] },
    choices: [
      {
        text: '重新联系上，认真处处看',
        tooltip: '有些缘分绕一圈还会回来',
        summary: '婚礼之后第三天，{name}发出了第一条消息',
        effects: [
          { attr: 'social', delta: 2 },
          { attr: 'happiness', delta: 1 },
        ],
        delayed: [
          {
            years: 1,
            relation: { kind: 'partner', add: true, closeness: 55 },
            summary: '和重新联系上的旧识确定了关系',
          },
        ],
        addTags: ['went_old_flame'],
      },
      {
        text: '加了联系方式，先处成朋友',
        summary: '从婚礼上的寒暄变成了偶尔的问候，{name}觉得这样也不错',
        effects: [],
        delayed: [
          {
            years: 1,
            relation: { kind: 'partner', add: true, closeness: 45 },
            summary: '和旧识的关系近了一步，但还没说破',
          },
        ],
      },
      {
        text: '笑着道别，让过去留在过去',
        summary: '{name}把话咽了回去，祝TA早日找到对的人',
        effects: [{ attr: 'stress', delta: 1 }],
      },
    ],
  },
  {
    id: 'rel_colleague_crush',
    category: 'relationship',
    title: '一起加班的那个人',
    text: '又是最后一个走的一晚，工位那头的灯还亮着。TA端来两杯咖啡：「顺手多泡了一杯。」{name}接过来的时候，指尖碰到一点温度。',
    minAge: 26,
    maxAge: 40,
    cooldown: 4,
    weight: 9,
    requires: { careerKinds: ['employed'], relationKindsNone: ['partner', 'spouse'] },
    choices: [
      {
        text: '约周末吃个饭，把话说明白',
        tooltip: '同事变恋人，成了是佳话，散了要换个部门',
        summary: '那顿饭吃了三个小时，从项目聊到童年',
        effects: [
          { attr: 'social', delta: 2 },
          { attr: 'stress', delta: 1 },
        ],
        delayed: [
          {
            years: 1,
            relation: { kind: 'partner', add: true, closeness: 55 },
            summary: '和那位同事确定了关系，工位之间的距离近了',
          },
        ],
        addTags: ['went_colleague'],
      },
      {
        text: '保持这种恰到好处的默契',
        summary: '咖啡还续着，话没挑明，日子多了一点盼头',
        effects: [],
        delayed: [
          {
            years: 1,
            relation: { kind: 'partner', add: true, closeness: 45 },
            summary: '和那位同事的感情在默契里慢慢升温',
          },
        ],
      },
      {
        text: '公私分明，把心思收起来',
        summary: '{name}道了谢，把杯子洗干净放回了原位',
        effects: [{ attr: 'stress', delta: -1 }],
      },
    ],
  },
  {
    id: 'rel_hobby_club',
    category: 'relationship',
    title: '兴趣班里的同好',
    text: '每周三晚上的陶艺班，TA总是坐在{name}斜对面，捏的东西歪歪扭扭却认真地要命。这周TA主动借了一块泥：「教教我呗？」',
    minAge: 30,
    maxAge: 52,
    cooldown: 4,
    weight: 9,
    requires: { relationKindsNone: ['partner', 'spouse'] },
    choices: [
      {
        text: '下课一起吃个宵夜吧',
        tooltip: '从陶艺聊到人生，也不算突兀',
        summary: '那顿宵夜吃了两个小时，两人的作品后来都越捏越像样',
        effects: [
          { attr: 'social', delta: 2 },
          { money: -200 },
        ],
        delayed: [
          {
            years: 1,
            relation: { kind: 'partner', add: true, closeness: 55 },
            summary: '和陶艺班的同好确定了关系',
          },
        ],
        addTags: ['went_club'],
      },
      {
        text: '班里人多，慢慢熟悉着看',
        summary: '每周三的陶艺班多了一个期待，也仅止于期待',
        effects: [],
        delayed: [
          {
            years: 1,
            relation: { kind: 'partner', add: true, closeness: 45 },
            summary: '和同好的关系在一次次班里走近了',
          },
        ],
      },
      {
        text: '只教捏泥，不聊别的',
        summary: '{name}教得倾囊相授，课一散就各自回家',
        effects: [{ attr: 'smarts', delta: 1 }],
      },
    ],
  },
  {
    id: 'rel_app_match',
    category: 'relationship',
    title: '交友软件上匹配到的人',
    text: '深夜刷手机，屏幕上跳出一句「我们可能很合得来」。头像后面的人资料写着：爱看老电影，讨厌加班。{name}盯着那个「打招呼」按钮看了很久。',
    minAge: 22,
    maxAge: 36,
    cooldown: 4,
    weight: 9,
    requires: { relationKindsNone: ['partner', 'spouse'] },
    choices: [
      {
        text: '打声招呼，约线下见面',
        tooltip: '线聊三百句，不如见一面',
        summary: '第一次见面约在一家老电影院门口，聊到散场都舍不得走',
        effects: [
          { attr: 'social', delta: 2 },
          { money: -300 },
        ],
        delayed: [
          {
            years: 1,
            relation: { kind: 'partner', add: true, closeness: 55 },
            summary: '和交友软件上认识的人确定了关系',
          },
        ],
        addTags: ['went_app'],
      },
      {
        text: '先线上聊聊看再说',
        summary: '对话框里的「对方正在输入」成了每天的小期待',
        effects: [],
        delayed: [
          {
            years: 1,
            relation: { kind: 'partner', add: true, closeness: 45 },
            summary: '线上聊了一年后终于见了面',
          },
        ],
      },
      {
        text: '关掉软件，还是想慢慢来',
        summary: '{name}卸载了软件，把缘分还给了现实生活',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
]
