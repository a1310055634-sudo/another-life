// 第 16 轮：晚年内容扩充（51 岁以后，16 个独立事件）
// 五大主题：退休准备（retirement_paperwork + 引擎到龄自动退休）、
// 关系（empty_nest / growing_old_together / single_golden / grandchild / overseas_call /
// mentor_visit）、健康（second_surgery / quit_smoking / health_debt / age_friendly_home）、
// 传承（mentor_young / dream_legacy / shop_handover）、人生回顾（memoir / tight_years）。
// 其中 8 个事件读取中年及以前的标记（第 14/15 轮埋点）：
// mentor_young←cert_track/mentor_bond、second_surgery←chronic_pain、
// quit_smoking←light_smoker、health_debt←avoided_doctor、shop_handover←shop_dream、
// overseas_call←overseas_bond/studied_abroad/exchanged、mentor_visit←repaid_mentor/
// mentor_bond、dream_legacy←dream_full/side_creates/dream_bloom/artist_path。
// 边缘处境覆盖：单身晚年（single_golden 读 relationKindsNone）、低收入晚年
// （tight_years 读 moneyBelow）、无固定职业晚年（tight_years 事件与零工收入模型）。
// 退休语义保证：提前退休走 retire 效果（退休金打折），到 65 岁年度结算自动退休兜底。
//
// 第 29 轮：晚年窗口加密（60～77 岁，+9 个独立事件，全文件 26 个）。
// 数字生活（smartphone）、凋零与告别（friends_fade / farewell_preparation）、
// 身后安排（will）、单身情感（late_companion）、孙辈互动（grand_rules / story_grandchild）、
// 社区参与（volunteer_lead）、再学习（senior_college）。
// 九题全部不引用中年及以前的标记（零门槛或只读当前状态），独居（companion 单身线、
// 其余各题不假设配偶）、无子女（九题中七题完全不假设子女）、低收入（大额选项均带
// moneyAtLeast 或低于负债隐藏阈值 3000，免费选项恒可见）三类处境可各自走通。
// 任务书候选主题「整理一生照片」与既有 late_memoir 同题，让位不建。
import type { GameEvent } from '../../engine/types'

export const LATE_EVENTS: GameEvent[] = [
  // ─── 退休准备 ───────────────────────────────────────────
  {
    id: 'late_retirement_paperwork',
    category: 'career',
    title: '退休申请表',
    text: '人事把一张退休申请表放在{name}桌上："这个可以提前办，也可以干到点。您考虑考虑？"手机里的政务应用其实也能办——{name}还是捏着那张纸，第一次认真想了想"退休"两个字。',
    minAge: 52,
    maxAge: 64,
    once: true,
    weight: 12,
    priority: 2,
    requires: { careerKinds: ['employed'] },
    choices: [
      {
        text: '提前办了，把日子还给自己',
        tooltip: '退休金会打折，但自由是全款的',
        summary: '{name}把工牌放进抽屉，出门时天还早，心情却像放了假',
        effects: [
          { retire: { mul: 0.32 } },
          { attr: 'happiness', delta: 3 },
          { attr: 'stress', delta: -5 },
        ],
        addTags: ['retired_early'],
      },
      {
        text: '干到点，站好最后一班岗',
        tooltip: '到 65 岁自动退休，退休金拿全额',
        summary: '{name}把申请表塞回抽屉，按部就班的日子反而让人踏实',
        effects: [{ attr: 'stress', delta: -2 }],
        delayed: [
          { years: 1, attr: 'happiness', delta: 1, summary: '安稳的节奏让{name}睡得比前几年都沉' },
        ],
        addTags: ['planned_retirement'],
      },
      {
        text: '接受返聘，发挥余热',
        tooltip: '多干几年，退休金基数还能再涨涨',
        summary: '{name}以顾问的身份留了下来，年轻同事开口闭口"老师"',
        effects: [
          { salaryMul: 1.1 },
          { attr: 'stress', delta: 2 },
        ],
        delayed: [
          { years: 1, money: 8000, summary: '返聘的讲课费和顾问费零零碎碎到账了不少' },
        ],
        addTags: ['consultant_track'],
      },
    ],
  },
  // ─── 关系 ───────────────────────────────────────────────
  {
    id: 'late_empty_nest',
    category: 'relationship',
    title: '孩子的房间空了',
    text: '孩子拖着行李箱进城那天，家里安静得能听见冰箱的嗡嗡声。{name}把他住的房间打扫了三遍，干净得让人心慌。',
    minAge: 54,
    maxAge: 70,
    once: true,
    weight: 11,
    requires: { tagsAll: ['has_child'] },
    choices: [
      {
        text: '塞给他一笔安家钱，让他去闯',
        tooltip: '手里有粮，孩子心里不慌',
        summary: '{name}把卡递过去只说了一句"别省"，孩子在站台上红了眼眶',
        effects: [
          { money: -20000 },
          { relation: { kind: 'child', deltaCloseness: 6 } },
          { attr: 'happiness', delta: 1 },
        ],
        addTags: ['empty_nest_blessing'],
      },
      {
        text: '约好每周日晚上视频',
        summary: '周日晚上八点的视频铃，成了{name}一周里最准时的闹钟',
        effects: [
          { relation: { kind: 'child', deltaCloseness: 4 } },
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
      {
        text: '把房间改成茶室，往前看',
        summary: '孩子的床搬走了，茶台摆进来那天，{name}泡了第一壶新茶',
        effects: [
          { attr: 'smarts', delta: 1 },
          { attr: 'stress', delta: -2 },
          { attr: 'happiness', delta: -2 },
        ],
      },
    ],
  },
  {
    id: 'late_growing_old_together',
    category: 'relationship',
    title: '老伴的手术单',
    text: '老伴体检查出了问题，需要做个手术。她把手术同意书递给{name}时手是稳的，签名时却抖了一下。几十年的风浪都过来了，这一回，谁也没说"别怕"。',
    minAge: 56,
    maxAge: 75,
    once: true,
    weight: 11,
    priority: 1,
    requires: { relationKinds: ['spouse'] },
    choices: [
      {
        text: '全程陪护，一步不离开医院',
        tooltip: '累，但这是两个人的事',
        summary: '手术很成功，推出来的走廊上，老伴说的第一句话是"你几天没刮胡子了"',
        effects: [
          { attr: 'stress', delta: 4 },
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'spouse', deltaCloseness: 10 } },
        ],
      },
      {
        text: '请个专业护工，两人轮流值班',
        tooltip: '花一笔钱，人也扛得住',
        summary: '护工专业，{name}每晚回去睡四个小时，白天接着守',
        effects: [
          { money: -24000 },
          { relation: { kind: 'spouse', deltaCloseness: 5 } },
          { attr: 'stress', delta: -1 },
        ],
        requires: { moneyAtLeast: 24000 },
      },
      {
        text: '"小手术而已"，故作轻松',
        summary: '{name}把担心都咽了回去，深夜的走廊上，一个人抽完了半包烟又掐了',
        effects: [
          { attr: 'stress', delta: 5 },
          { relation: { kind: 'spouse', deltaCloseness: -6 } },
        ],
      },
    ],
  },
  {
    id: 'late_single_golden',
    category: 'relationship',
    title: '一个人的黄金年代',
    text: '邻居老太太拎着两根黄瓜来串门："就你一个人？可怜哟。"{name}笑了——花园种着、书架满着、周末排着队，这日子怎么就可怜了？',
    minAge: 51,
    maxAge: 75,
    cooldown: 6,
    weight: 10,
    requires: { relationKindsNone: ['partner', 'spouse'] },
    choices: [
      {
        text: '加入社区互助社，搭伙过日子',
        summary: '{name}和几个老伙计组了互助社，谁家包了饺子都端一盘过来',
        effects: [
          { money: -1000 },
          { attr: 'social', delta: 4 },
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'friend', add: true, name: '互助社的老周', closeness: 60 } },
        ],
        addTags: ['mutual_aid'],
      },
      {
        text: '领养一只被退养的猫',
        summary: '七岁的橘猫"老白"窝进了{name}的沙发，也窝进了日程表',
        effects: [
          { money: -3000 },
          { attr: 'happiness', delta: 4 },
          { relation: { kind: 'pet', add: true, name: '老白', closeness: 55 } },
        ],
        addTags: ['pet_owner'],
      },
      {
        text: '一个人也要把日子过亮堂',
        summary: '{name}把阳台的花挪到了客厅，阳光好的下午，屋里亮得像过节',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'health', delta: 1 },
          { attr: 'stress', delta: -2 },
        ],
      },
    ],
  },
  {
    id: 'late_grandchild',
    category: 'relationship',
    title: '隔代的课题',
    text: '孩子两口子双职工，孙辈没人带，把话递到了{name}嘴边又不好意思说全。带，是亲力亲为的辛苦；不带，也有不带的亲近法。',
    minAge: 56,
    maxAge: 75,
    once: true,
    weight: 10,
    priority: 1,
    requires: { tagsAll: ['has_child'], relationKinds: ['child'] },
    choices: [
      {
        text: '接过来，全力帮带',
        tooltip: '累几年，换来一家人的热乎',
        summary: '小家伙学会的第一个词是"爷爷"，{name}累得腰酸，笑得见牙不见眼',
        effects: [
          { attr: 'stress', delta: 4 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'child', deltaCloseness: 8 } },
        ],
        addTags: ['grandparent_duty'],
      },
      {
        text: '出钱请育儿嫂，不当免费劳力',
        tooltip: '边界感也是亲情的保鲜剂',
        summary: '{name}把一年的退休金拨了一笔过去，孩子说"爸，您想得比我们明白"',
        effects: [
          { money: -15000 },
          { relation: { kind: 'child', deltaCloseness: 4 } },
        ],
        requires: { moneyAtLeast: 15000 },
      },
      {
        text: '只做周末爷爷奶奶',
        summary: '每周六的游乐场之约雷打不动，周日把孩子还回去，各自睡个好觉',
        effects: [
          { relation: { kind: 'child', deltaCloseness: 2 } },
          { attr: 'health', delta: 1 },
          { attr: 'happiness', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'late_overseas_call',
    category: 'relationship',
    title: '越洋视频',
    text: '周末早上，屏幕那头的老友从地球另一端打来视频，背景是听不懂的路牌。当年一起熬夜的两个人，如今一个刚起床，一个要睡了。',
    minAge: 55,
    maxAge: 75,
    once: true,
    weight: 9,
    requires: { tagsAny: ['overseas_bond', 'studied_abroad', 'exchanged'] },
    choices: [
      {
        text: '订机票，飞过去看他一面',
        tooltip: '这岁数的"下次一定"，往往就是没有了',
        summary: '两个老头在异国的海边坐了一下午，聊的还是二十岁那年的天',
        effects: [
          { money: -30000 },
          { attr: 'happiness', delta: 5 },
          { attr: 'social', delta: 2 },
        ],
        requires: { moneyAtLeast: 30000 },
        addTags: ['overseas_visit'],
      },
      {
        text: '约好每月最后一个周日视频',
        summary: '时差掐着表算，{name}的手机日历多了一个雷打不动的提醒',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'social', delta: 1 },
        ],
      },
      {
        text: '时差和年龄都在劝退',
        summary: '聊天记录停在了那句"改天再聊"，谁也没有再点开',
        effects: [{ attr: 'happiness', delta: -2 }],
      },
    ],
  },
  {
    id: 'late_mentor_visit',
    category: 'relationship',
    title: '师恩的最后一课',
    text: '老师傅的孙子在群里发了条消息：爷爷八十岁了，就念叨当年一起干活的人。{name}盯着屏幕，想起自己十八岁那年递出去的第一支烟、挨的第一顿骂。',
    minAge: 54,
    maxAge: 75,
    once: true,
    weight: 10,
    priority: 1,
    requires: { tagsAny: ['repaid_mentor', 'mentor_bond'] },
    choices: [
      {
        text: '登门探望，陪他喝一下午茶',
        summary: '老师傅耳背了，但{name}报上名字的那一刻，他笑得像四十年前一样',
        effects: [
          { money: -4000 },
          { attr: 'happiness', delta: 4 },
        ],
        addTags: ['mentor_full_circle'],
      },
      {
        text: '寄上好茶，逢年过节必打电话',
        summary: '快递单上的留言栏里，{name}写：您的手艺，我一直没用歪',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 2 },
        ],
      },
      {
        text: '惦记着，但总也没去',
        summary: '{name}把那条消息置顶了，置顶了整整一年',
        effects: [{ attr: 'happiness', delta: -3 }],
      },
    ],
  },
  // ─── 健康 ───────────────────────────────────────────────
  {
    id: 'late_second_surgery',
    category: 'health',
    title: '又见手术同意书',
    text: '还是那个旧伤，还是那纸手术同意书。上一次{name}选了保守治疗，这一次医生把片子往灯板上一插："年纪再大，可就真做不了了。"',
    minAge: 51,
    maxAge: 72,
    once: true,
    weight: 12,
    priority: 2,
    requires: { tagsAny: ['chronic_pain'] },
    choices: [
      {
        text: '这一次做彻底，跟旧伤两清',
        tooltip: '花一笔大钱，换真正轻快的晚年',
        summary: '麻药醒来，{name}试着动了动腿——那种熟悉的钝痛，第一次没有来',
        effects: [
          { money: -30000 },
          { attr: 'health', delta: -2 },
          { attr: 'stress', delta: -1 },
        ],
        delayed: [
          { years: 1, attr: 'health', delta: 7, summary: '康复科放了毕业，{name}晚年在公园走上了前排' },
        ],
        requires: { moneyAtLeast: 30000 },
        removeTags: ['chronic_pain'],
        addTags: ['health_comeback'],
      },
      {
        text: '接着做康复理疗，慢慢养',
        summary: '{name}又续了康复科的卡，技师都换了两茬了，膝盖时好时坏',
        effects: [
          { money: -2500 },
          { attr: 'stress', delta: -1 },
        ],
        delayed: [
          { years: 1, money: -2500, attr: 'health', delta: 1, repeat: 2, summary: '理疗又续了一年，疼痛管住了大半' },
        ],
        addTags: ['rehab_program'],
      },
      {
        text: '这个年纪，不折腾了',
        summary: '{name}把同意书折成四折塞回口袋，出门时腿又沉了几分',
        effects: [{ attr: 'stress', delta: 2 }],
        delayed: [
          { years: 1, attr: 'health', delta: -4, summary: '旧伤跟着又一个冬天，走得越来越慢了' },
        ],
      },
    ],
  },
  {
    id: 'late_quit_smoking',
    category: 'health',
    title: '胸片上的疑点',
    text: '拍胸片的时候医生多看了两眼，让{name}过三个月再来复查。楼道里的老烟友们听说了，递烟的手第一次悬在了半空。',
    minAge: 55,
    maxAge: 75,
    once: true,
    weight: 11,
    priority: 1,
    requires: { tagsAny: ['light_smoker'] },
    choices: [
      {
        text: '把烟和打火机一起扔了',
        tooltip: '难熬三个月，换来干干净净的肺',
        summary: '戒断反应最难的头两周，{name}嗑掉的瓜子比抽掉的烟还多，但扛过来了',
        effects: [
          { attr: 'stress', delta: 3 },
          { attr: 'happiness', delta: -2 },
          { attr: 'health', delta: 3 },
        ],
        delayed: [
          { years: 1, attr: 'health', delta: 4, summary: '复查的片子干干净净，医生难得夸了人' },
        ],
        removeTags: ['light_smoker'],
        addTags: ['quit_smoking'],
      },
      {
        text: '减量，一天就三根',
        summary: '{name}把烟拆散了藏进三个口袋，一天下来总能找齐',
        effects: [
          { attr: 'health', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
      {
        text: '抽了半辈子，随缘吧',
        summary: '烟照抽，茶照喝，只是咳嗽声比去年又沉了一些',
        effects: [
          { attr: 'stress', delta: -2 },
          { attr: 'happiness', delta: 1 },
        ],
        delayed: [
          { years: 1, attr: 'health', delta: -5, summary: '晨起的那阵咳嗽越来越长，像旧房子在漏风' },
        ],
      },
    ],
  },
  {
    id: 'late_health_debt',
    category: 'health',
    title: '欠了半辈子的体检',
    text: '社区医院给65岁以上老人建电子健康档案，护士打电话来时{name}才想起，那张"建议进一步检查"的报告单，已经在抽屉里躺了好几年。',
    minAge: 51,
    maxAge: 75,
    once: true,
    weight: 11,
    priority: 1,
    requires: { tagsAny: ['avoided_doctor'] },
    choices: [
      {
        text: '做个全面检查，把债一次还清',
        tooltip: '查得全，花钱也不少',
        summary: '一上午跑遍五层楼，报告出来那天，{name}握着单子的手心全是汗——还好，都还来得及',
        effects: [
          { money: -25000 },
          { attr: 'health', delta: 5 },
          { attr: 'stress', delta: -2 },
        ],
        requires: { moneyAtLeast: 25000 },
        removeTags: ['avoided_doctor'],
      },
      {
        text: '只查最担心的那一项',
        summary: '单项结果没问题，{name}松了口气，医生叮嘱的那句"其余也要查"没太听进去',
        effects: [
          { money: -5000 },
          { attr: 'health', delta: 2 },
        ],
      },
      {
        text: '没病没灾，查什么查',
        summary: '护士又打来一次电话，{name}客气地说"不用了"，抽屉照旧关着',
        effects: [{ attr: 'stress', delta: 1 }],
        delayed: [
          { years: 1, attr: 'health', delta: -5, summary: '身体不会说话，但它一笔一笔记着账' },
        ],
      },
    ],
  },
  {
    id: 'late_age_friendly_home',
    category: 'health',
    title: '浴室里的防滑垫',
    text: '上个月在浴室滑了一下，所幸扶住了洗衣机的角。夜里{name}盯着天花板盘算：这房子，还跟得上自己的岁数吗？',
    minAge: 58,
    maxAge: 75,
    once: true,
    weight: 10,
    requires: { tagsAll: ['homeowner'] },
    choices: [
      {
        text: '全面适老化改造',
        tooltip: '扶手、防滑、夜间地灯一步到位',
        summary: '改造完的浴室亮堂堂，{name}踩上去的第一脚，稳得像年轻了二十岁',
        effects: [
          { money: -30000 },
          { attr: 'health', delta: 3 },
          { attr: 'happiness', delta: 2 },
        ],
        requires: { moneyAtLeast: 30000 },
        addTags: ['age_friendly_home'],
      },
      {
        text: '先装扶手和防滑垫',
        summary: '五金店老板送了{name}一句"叔叔您想得周到"，一百块钱办了大事',
        effects: [
          { money: -4000 },
          { attr: 'health', delta: 1 },
        ],
        addTags: ['age_friendly_home'],
      },
      {
        text: '住了几十年，将就惯了',
        summary: '{name}把那块旧防滑垫又铺正了些，日子照旧',
        effects: [{ attr: 'stress', delta: 1 }],
        delayed: [
          { years: 1, attr: 'health', delta: -3, summary: '夜里起夜的路，走得一年比一年小心' },
        ],
      },
    ],
  },
  // ─── 传承 ───────────────────────────────────────────────
  {
    id: 'late_mentor_young',
    category: 'education',
    title: '车间里的年轻人',
    text: '街道的技能工作站来人请{name}出山带徒弟："现在肯学手艺的年轻人少，您这样的老师傅，是宝贝。"',
    minAge: 51,
    maxAge: 72,
    once: true,
    weight: 16,
    requires: { tagsAny: ['cert_track', 'mentor_bond'], careerKinds: ['employed', 'retired', 'none'] },
    choices: [
      {
        text: '收两个徒弟，倾囊相授',
        summary: '徒弟第一次独立干完活，冲{name}敬了个不标准的礼，眼眶有点热',
        effects: [
          { attr: 'social', delta: 2 },
          { attr: 'happiness', delta: 3 },
        ],
        addTags: ['late_mentor'],
      },
      {
        text: '去夜校讲课，赚份课时费',
        summary: '{name}的课没有PPT，全是年头，教室后排都站着人',
        effects: [
          { money: 6000 },
          { attr: 'smarts', delta: 1 },
        ],
      },
      {
        text: '婉拒：想清静几年了',
        summary: '{name}送走来客，把工具箱擦了擦，又放回了原处',
        effects: [{ attr: 'happiness', delta: -1 }],
      },
    ],
  },
  {
    id: 'late_dream_legacy',
    category: 'life',
    title: '热爱的下一棒',
    text: '这些年攒下的作品堆满了半面墙。社区文化站愿意给{name}办一场小型回顾展，邻居家的娃也总扒着门缝看，眼睛亮得像当年的自己。',
    minAge: 56,
    maxAge: 75,
    once: true,
    weight: 16,
    requires: { tagsAny: ['dream_full', 'side_creates', 'dream_bloom', 'artist_path'] },
    choices: [
      {
        text: '办一场小型回顾展',
        tooltip: '搭进去一笔钱，换来一个句号和一个逗号',
        summary: '开展那天来了不少人，{name}站在自己几十年的日子里，被拍了好多照片',
        effects: [
          { money: -12000 },
          { attr: 'happiness', delta: 6 },
          { attr: 'social', delta: 3 },
        ],
        requires: { moneyAtLeast: 12000 },
        addTags: ['dream_legacy'],
      },
      {
        text: '把家伙什传给邻居家娃',
        summary: '孩子抱着画架出门时回头喊了声"谢谢爷爷"，{name}半天没舍得关门',
        effects: [{ attr: 'happiness', delta: 3 }],
        addTags: ['dream_legacy'],
      },
      {
        text: '悄悄收山，不办了',
        summary: '{name}把墙上的作品一幅幅取下来，包好，收进了柜子最深处',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'late_shop_handover',
    category: 'money',
    title: '小店的下一步',
    text: '跟了{name}十年的小店，最近站一天柜台腰就酸一天。跟了多年的伙计有意接手，街对面的连锁店也递来了收购意向书。',
    minAge: 56,
    maxAge: 75,
    once: true,
    weight: 10,
    requires: { tagsAny: ['shop_dream'] },
    choices: [
      {
        text: '交给伙计，自己退居二线',
        summary: '招牌没换，只是柜台后多了一把留给{name}的藤椅',
        effects: [
          { money: 15000 },
          { attr: 'happiness', delta: 3 },
          { attr: 'social', delta: 2 },
        ],
        addTags: ['shop_handover'],
      },
      {
        text: '盘给连锁品牌，套现离场',
        summary: '签字那天{name}没有回头，卡里的数字很安心，门口的梧桐树很旧',
        effects: [
          { money: 40000 },
          { attr: 'stress', delta: -3 },
          { attr: 'happiness', delta: -2 },
        ],
        addTags: ['shop_handover'],
      },
      {
        text: '再守一年是一年',
        summary: '卷帘门还是每天准时拉起来，只是收银台边多了一个软和的凳子',
        effects: [
          { money: 9000 },
          { attr: 'stress', delta: 3 },
        ],
        delayed: [
          { years: 1, attr: 'health', delta: -3, summary: '站柜台的老腰又熬过一个冬天' },
        ],
      },
    ],
  },
  // ─── 人生回顾与晚年生计 ─────────────────────────────────
  {
    id: 'late_memoir',
    category: 'life',
    title: '柜子底的旧相册',
    text: '整理柜子时翻出那本旧相册，塑料膜都黄了。第一页是{name}十八岁的证件照，眼神生涩，倔得很。窗外下着雨，正好适合回忆。',
    minAge: 51,
    maxAge: 75,
    cooldown: 5,
    weight: 15,
    choices: [
      {
        text: '把故事写下来，装订成册',
        tooltip: '给儿孙，也给自己',
        summary: '三万字的回忆录打印装订好了，扉页写着：献给所有陪我走过的人',
        effects: [
          { attr: 'smarts', delta: 2 },
          { attr: 'happiness', delta: 3 },
          { attr: 'stress', delta: -1 },
        ],
        addTags: ['memoir'],
      },
      {
        text: '把照片按年份理好，配上手写注',
        summary: '每张照片背后都补了一行小字，相册厚了，日子也清晰了',
        effects: [{ attr: 'happiness', delta: 2 }],
      },
      {
        text: '翻了两页就合上了',
        summary: '{name}把相册放回柜底，雨还没停，往事留在原地',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'late_tight_years',
    category: 'money',
    title: '退休金的算术题',
    text: '记账本摊在桌上，进项一栏短短几行，出项一栏排得满满当当。{name}戴上老花镜算了三遍，决定给日子找点新办法。',
    minAge: 51,
    maxAge: 75,
    cooldown: 4,
    weight: 11,
    requires: { moneyBelow: 20000 },
    choices: [
      {
        text: '去街道申请老年补助',
        tooltip: '手续琐碎，但每一分都踏实',
        summary: '表格跑了三趟终于交上去，{name}把回执单抚得平平整整收进了文件袋',
        effects: [
          { money: 6000 },
          { attr: 'happiness', delta: -1 },
        ],
        delayed: [
          { years: 1, money: 6000, summary: '补助按时到账，柴米油盐的底气厚了一层' },
        ],
        addTags: ['low_income_aid'],
      },
      {
        text: '和老伙计们拼团搭伙过日子',
        summary: '三家人合请了一位做饭阿姨，饭桌从一张变成一排，笑声也翻了一倍',
        effects: [
          { money: -2000 },
          { attr: 'stress', delta: -4 },
          { attr: 'social', delta: 3 },
        ],
        addTags: ['co_living'],
      },
      {
        text: '支个修理摊，接着干',
        summary: '{name}的修理摊在银行门口支了起来，老主顾们排着队来叙旧',
        effects: [
          { money: 5000 },
          { attr: 'stress', delta: 3 },
          { attr: 'health', delta: -1 },
        ],
        addTags: ['silver_hustle'],
      },
    ],
  },
  // ─── 时代氛围（第 27 轮：纯氛围事件，无机制效果或极轻） ───
  {
    id: 'late_group_rumor',
    category: 'life',
    title: '群里的养生文',
    text: '老同学群里，有人转了一篇《这三种东西再馋也要忌口》，标题缀着感叹号，配图的红字一张比一张吓人。群里安静了一阵，有人回了句"转发提醒家人"。{name}点开那篇文章，越看眉头皱得越紧。',
    minAge: 55,
    maxAge: 75,
    weight: 6,
    cooldown: 5,
    choices: [
      {
        text: '认真查了查，把辟谣发回群里',
        summary: '{name}翻了翻官方科普号，把辟谣链接发回群里，两个老同学回了"还好你说了"',
        effects: [{ attr: 'smarts', delta: 1 }],
      },
      {
        text: '点个赞，不多嘴',
        summary: '谁都有个爱好，{name}选择成全这篇惊心动魄的文章',
        effects: [{ attr: 'stress', delta: -1 }],
      },
      {
        text: '顺手转给老伙计们',
        summary: '转是转了，{name}自己倒是半句没信',
        effects: [{ attr: 'social', delta: 1 }],
      },
    ],
  },
  // ─── 晚年窗口加密（第 29 轮：数字生活/凋零与告别/身后安排/单身情感/孙辈互动/社区/再学习） ───
  {
    id: 'late_smartphone',
    category: 'life',
    title: '智能手机的第二课',
    text: '社区活动室的黑板上写着"智能手机课堂：本周教视频通话"。{name}揣着那部只用来看时间和接电话的旧手机，在门口站了一会儿——手机里装着的那个世界，好像比客厅还大。',
    minAge: 60,
    maxAge: 77,
    cooldown: 3,
    weight: 10,
    choices: [
      {
        text: '从视频通话学起，一步一个脚印',
        summary: '第一通视频打给老伙计时，对方愣了三秒才认出人，俩人隔着屏幕笑得像小孩',
        effects: [
          { attr: 'smarts', delta: 1 },
          { attr: 'social', delta: 1 },
        ],
        addTags: ['digital_savvy'],
      },
      {
        text: '报个班，跟着小老师慢慢学',
        tooltip: '十二节课，从开机学到挂号',
        summary: '十二节课下来，{name}的通讯录里多了三个群、一款打车软件，还学会了网上挂号',
        effects: [
          { money: -600 },
          { attr: 'smarts', delta: 2 },
          { attr: 'happiness', delta: 1 },
        ],
        addTags: ['digital_savvy'],
      },
      {
        text: '好好一部手机，学那些干什么',
        summary: '手机还是那部手机，只是缴个水电费，{name}还得专门跑一趟银行',
        effects: [{ attr: 'stress', delta: 1 }],
      },
    ],
  },
  {
    id: 'late_friends_fade',
    category: 'relationship',
    title: '老友的讣告',
    text: '手机在清晨响起，是老友的女儿打来的，声音压得很低。葬礼定在周五。{name}握着手机坐了很久——上个月还约着下棋的人，怎么说走就走了。',
    minAge: 60,
    maxAge: 77,
    once: true,
    weight: 9,
    priority: 1,
    requires: { relationKinds: ['friend'] },
    choices: [
      {
        text: '拖着老腿，去送最后一程',
        tooltip: '这岁数的送别，去一次少一次',
        summary: '灵堂里{name}鞠了三个躬，回头对老友的女儿说："你爸是我这辈子最好的棋友"',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: 2 },
          { attr: 'social', delta: 1 },
        ],
        requires: { moneyAtLeast: 2000 },
      },
      {
        text: '把老友的照片和来往的信整理成册',
        summary: '四十年的合影按年份排好，最后一页留给那张下棋的照片，扉页写着：来生再做朋友',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'smarts', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
      {
        text: '看淡些，人总有这一遭',
        summary: '{name}把讣告折好收进抽屉，那天傍晚的棋摊上，少摆了一副棋',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'late_will',
    category: 'life',
    title: '一份郑重的清单',
    text: '老伙计的后事刚办完，{name}夜里翻来覆去睡不着。这大半辈子的家当和没说出口的心意，趁头脑还清楚，是不是该有个交代？',
    minAge: 62,
    maxAge: 77,
    once: true,
    weight: 8,
    choices: [
      {
        text: '去公证处，立一份正式遗嘱',
        tooltip: '白纸黑字盖了章，往后轻快',
        summary: '从公证处出来，{name}长舒一口气——该安排的都安排了，剩下的日子只管好好过',
        effects: [
          { money: -3000 },
          { attr: 'stress', delta: -2 },
          { attr: 'happiness', delta: 1 },
        ],
        requires: { moneyAtLeast: 3000 },
        addTags: ['will_done'],
      },
      {
        text: '把想说的话，写成一封长信',
        summary: '写了整整三页纸，开头是"见字如面"，写完那天，{name}把信压进了证件盒最底下',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'smarts', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
        addTags: ['will_done'],
      },
      {
        text: '想这些做什么，不吉利',
        summary: '念头闪了一下就过去了，抽屉里那份清单，终究停在了草稿',
        effects: [{ attr: 'stress', delta: 2 }],
      },
    ],
  },
  {
    // 第 117 轮遗嘱与遗产分配：资格串联裁决——既有 late_will（一份郑重的清单）保留为
    // 「立遗嘱资格」（will_done 标记），本线三枚在其后串联（分配安排→修改→临终心愿），
    // 不硬改既有事件选项语义、不并行重复立遗嘱事件。
    // 分配方式落 will_mode_* 三标记，终局承继时由 willAllocationOf 归一入 bloodline.allocation。
    id: 'late_will_split',
    category: 'life',
    title: '分配的安排',
    text: '遗嘱立好了，可纸上的条款终究要落到人身上。夜里{name}把孩子们的照片挨张看过——手心手背都是肉，可每一只手的难处，不一样。',
    minAge: 63,
    maxAge: 77,
    once: true,
    weight: 8,
    requires: { tagsAny: ['will_done'], relationKinds: ['child'] },
    choices: [
      {
        text: '一视同仁，均分',
        summary: '{name}在纸上写下一人一份，笔迹很平——平得像称过的秤。手心手背都是肉，秤平了，心才安',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: 2 } },
        ],
        addTags: ['will_mode_even'],
      },
      {
        text: '多帮衬眼下最难的那个',
        summary: '{name}把大头划给了过得最难的孩子。手心手背都是肉，可肉也有厚薄——难的那个，多接一把',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: -1 } },
        ],
        addTags: ['will_mode_weighted'],
      },
      {
        text: '给孙辈留一份，隔代的心意',
        requires: { relationKinds: ['grandchild'] },
        summary: '{name}添了一条：给孙辈单独留一份学费钱。孩子那辈的事孩子自己当家，孙辈的，{name}自己当家',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: 1 } },
        ],
        addTags: ['will_mode_grandchild'],
      },
    ],
  },
  {
    id: 'late_will_amend',
    category: 'life',
    title: '改遗嘱的念头',
    text: '家里这几年又有新变化：有的孩子日子好过了，有的添了新丁。{name}翻出当年那份遗嘱，笔尖悬在纸上——改，还是不改？',
    minAge: 65,
    maxAge: 77,
    cooldown: 5,
    weight: 6,
    requires: { tagsAny: ['will_mode_even', 'will_mode_weighted', 'will_mode_grandchild'] },
    choices: [
      {
        text: '改回均分，谁也不偏',
        summary: '{name}把当初的倾斜条款一条条划平。偏心是一时的心软，公平是一世的交代',
        effects: [
          { attr: 'stress', delta: -1 },
        ],
        addTags: ['will_mode_even'],
        removeTags: ['will_mode_weighted', 'will_mode_grandchild'],
      },
      {
        text: '就按当初想的，不改了',
        summary: '{name}把遗嘱折好放回原处。当初想明白的事，现在也一样明白',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    id: 'late_final_wish',
    category: 'life',
    title: '最后的心愿清单',
    text: '该安排的都安排了。{name}忽然想起年轻时列过一张单子：想去看的海，想学的琴，想再回一次的老屋。清单黄了，名字还醒着。',
    minAge: 73,
    maxAge: 77,
    once: true,
    weight: 6,
    requires: { tagsAny: ['will_done'] },
    choices: [
      {
        text: '把心愿清单重新写一遍，能完成的都去完成',
        summary: '{name}挑了两件最近的一一去了。回来的路上买了往常舍不得吃的糕点——有些心愿，完成比完美重要',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'smarts', delta: 1 },
        ],
      },
      {
        text: '都安排好了，剩下的随缘',
        summary: '{name}把旧清单压在新遗嘱上面，一并收好。心里那块悬了几年的石头，落了地',
        effects: [{ attr: 'stress', delta: -2 }],
      },
    ],
  },
  {
    id: 'late_late_companion',
    category: 'relationship',
    title: '搭伴过日子的提议',
    // 第 44 轮：搭伴对象从写死的「老吴」升级为取名池具名的真实 partner 关系
    // （late_companionship 标记在场时年度结算有 8% 离世判定，身后事复用第 41 轮语义）。
    text: '晨练队的老姐姐们撮合了一桩事：公园那头独居多年的老人，人实在，会修电器，想找个能说上话的伴。两人见过一面，都有些意思，就等{name}松口。',
    minAge: 58,
    maxAge: 75,
    once: true,
    weight: 9,
    requires: { relationKindsNone: ['partner', 'spouse'] },
    choices: [
      {
        text: '处处看吧，搭伴过日子',
        tooltip: '两个家并成一个，日子有个照应',
        summary: '两个加起来一百多岁的老人在公园分一副耳机听戏，路过的鸟都多停了一会儿',
        effects: [
          { money: -1500 },
          { attr: 'happiness', delta: 4 },
          { attr: 'social', delta: 2 },
          // 名字缺省 → 引擎从伴侣名池 seed 确定具名（data/names.ts）
          { relation: { kind: 'partner', add: true, closeness: 55 } },
        ],
        requires: { moneyAtLeast: 1500 },
        addTags: ['late_companion', 'late_companionship'],
      },
      {
        text: '先当朋友处着，不急着定',
        summary: '两家的饭桌上多了一副碗筷的走动，谁也没提"以后"，日子倒自在',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'social', delta: 1 },
        ],
      },
      {
        text: '一个人过惯了，婉言谢绝',
        summary: '对方托人捎来一句"理解"，{name}那晚多下了两盘棋，说不清心里是轻了还是空了',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'late_grand_rules',
    category: 'relationship',
    title: '隔代的规矩之争',
    text: '孙辈的晚饭桌上，一块糖引发了一场家庭辩论：{name}觉得"孩子哭两声怎么了，给块糖天塌不下来"，孩子却把脸一沉——"医生说了，不能惯。"',
    minAge: 58,
    maxAge: 74,
    once: true,
    weight: 9,
    // 孩子在场的 AND 存在性检查（对齐 mid_sandwich 口径）：教养之争需要真实的孩子关系
    requires: { tagsAll: ['has_child'], minCloseness: { child: 0 } },
    choices: [
      {
        text: '坚持老办法：孩子就得有个孩子的样',
        summary: '"我们那辈七八个都这么带大的。"话是硬气的，孩子挂电话的速度也是快的',
        effects: [
          { relation: { kind: 'child', deltaCloseness: -4 } },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '听孩子的：疼爱归疼爱，规矩归规矩',
        summary: '{name}把糖罐收进了柜顶，周末的游乐场照去，只是约定了"每周一块糖"',
        effects: [
          { relation: { kind: 'child', deltaCloseness: 4 } },
          { attr: 'happiness', delta: -1 },
        ],
      },
      {
        text: '白纸黑字，爷俩约法三章',
        summary: '一张"带娃公约"贴在冰箱上，签名处两个名字并排，像极了多年前的一张成绩单',
        effects: [
          { relation: { kind: 'child', deltaCloseness: 2 } },
          { attr: 'smarts', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'late_farewell_preparation',
    category: 'life',
    title: '想说的话，趁早说',
    text: '社区生命教育课的最后一讲，是"给牵挂的人留言"。散场时工作人员递给{name}一张卡片："不着急，想想有什么话，是希望他们一直记得的。"',
    minAge: 70,
    maxAge: 77,
    once: true,
    weight: 7,
    priority: 1,
    choices: [
      {
        text: '把想说的话，一段段录进手机',
        summary: '录到第三段{name}笑了——原来最放不下的，是那口腌菜的坛子和每年冬至那顿饺子',
        effects: [
          { attr: 'happiness', delta: 3 },
          { attr: 'stress', delta: -2 },
          { attr: 'smarts', delta: 1 },
        ],
        addTags: ['farewell_ready'],
      },
      {
        text: '把在意的事，一件件交代清楚',
        summary: '证件放在哪、卡和密码在哪、和谁该说声对不起，{name}在纸上列了又改，改完心里踏实了',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: -3 },
          { attr: 'social', delta: 1 },
        ],
        addTags: ['farewell_ready'],
      },
      {
        text: '身子骨还硬朗，说这些太早',
        summary: '卡片压进了抽屉。可那天夜里，{name}又把它挪到了更好找的地方',
        effects: [{ attr: 'stress', delta: 1 }],
      },
    ],
  },
  {
    id: 'late_volunteer_lead',
    category: 'life',
    title: '社区要找个带头人',
    text: '社区公告栏贴出新告示：志愿服务队招队长，管楼道清理、独居老人探访和节日活动。主任远远看见{name}就笑："这摊子事，全社区就服您。"',
    minAge: 58,
    maxAge: 75,
    cooldown: 4,
    weight: 8,
    choices: [
      {
        text: '把担子接过来，队伍带起来',
        tooltip: '物料自己先垫上，人心聚起来',
        summary: '红袖章一发队伍真拉起来了，{name}排的值班表贴在公告栏，比物业的通知还管用',
        effects: [
          { money: -1000 },
          { attr: 'social', delta: 4 },
          { attr: 'happiness', delta: 3 },
          { attr: 'stress', delta: 2 },
        ],
        addTags: ['volunteer_lead'],
      },
      {
        text: '报个名，跟着干点实事',
        summary: '探访独居老人的名单上有了{name}，敲门时那句"是我"换来一声惊喜的"哎，快进来"',
        effects: [
          { attr: 'social', delta: 2 },
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: 1 },
        ],
      },
      {
        text: '看了一眼告示，走了',
        summary: '帽子是好看的，事也是实在的，只是{name}想先把自己的日子过明白',
        effects: [{ attr: 'stress', delta: -1 }],
      },
    ],
  },
  {
    id: 'late_story_grandchild',
    category: 'relationship',
    title: '再讲一遍那时候',
    text: '小家伙翻出一张黑白照片，踮着脚问这是谁。{name}凑近一看，笑了——那是自己二十岁出头，站在厂门口照的第一张相。',
    minAge: 62,
    maxAge: 77,
    once: true,
    // 第 62 轮：资格校准「须孙辈在册」（原仅查孩子在册——讲古对象是孙辈，
    // 无孙辈家庭不该触发）+ weight 8→14（R62 漏斗实证：资格年 100% 入候选、
    // 467 年仅抽中 2 次=纯竞争落败；资格修正后分母缩小，提权补竞争力学）。
    weight: 14,
    requires: { tagsAll: ['has_child'], minCloseness: { grandchild: 0 } },
    choices: [
      {
        text: '把老故事讲成"连载"，一周一段',
        tooltip: '从厂门口的第一张相讲起',
        summary: '小家伙每周日准时来催更，比动画片还上心，{name}翻出压箱底的老物件当"教具"',
        effects: [
          { relation: { kind: 'child', deltaCloseness: 3 } },
          { attr: 'happiness', delta: 4 },
          { attr: 'stress', delta: -1 },
        ],
        addTags: ['story_teller'],
      },
      {
        text: '讲一段是一段，随缘',
        summary: '那天的故事讲到了一半，剩下的，小家伙记在了心里，也记在了本子上',
        effects: [{ attr: 'happiness', delta: 2 }],
      },
      {
        text: '"去去去，自己玩去"',
        summary: '小家伙噘着嘴走了，照片被随手放回抽屉，这一放又是半年',
        effects: [
          { relation: { kind: 'child', deltaCloseness: -3 } },
          { attr: 'happiness', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'late_senior_college',
    category: 'education',
    title: '老年大学的招生单',
    text: '老年大学秋季班开始报名，书法、合唱、太极、手机摄影。{name}盯着招生单看了很久——年轻时学东西是为了糊口，这回，能纯粹为高兴学一回。',
    minAge: 55,
    maxAge: 72,
    cooldown: 4,
    weight: 8,
    choices: [
      {
        text: '报个班，正经当回学生',
        tooltip: '新笔记本都买好了',
        summary: '开学第一课{name}坐进了第一排，笔记记得比旁边年轻人还工整',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 3 },
          { attr: 'smarts', delta: 1 },
          { attr: 'social', delta: 1 },
        ],
        requires: { moneyAtLeast: 2000 },
        addTags: ['senior_college'],
      },
      {
        text: '蹭公开课和社区讲座，一分不花',
        summary: '图书馆的公开课场场不落，笔记记了半本，同桌换了三拨',
        effects: [
          { attr: 'smarts', delta: 1 },
          { attr: 'social', delta: 1 },
        ],
      },
      {
        text: '年轻时没赶上，现在也不想赶了',
        summary: '招生单在手里折了两折，放回了公告栏，{name}转身走向熟悉的棋摊',
        effects: [{ attr: 'happiness', delta: -1 }],
      },
    ],
  },
  // ── 第 47 轮：年龄热力补密（66-77 为全池最薄桶，覆盖 52/权重 550，基线见
  //    scripts/age_heatmap.ts）——8 个事件：6 个 64-77 专属 + 2 个 58/60-77 跨窗
  //    兼顾次薄桶 56-65。处境覆盖：独居（钥匙/旧信/生日均无家庭门槛）、低收入
  //    （假牙/菜市场的将就与精打细算选项）、文本零配偶/子女/房产假设。
  {
    id: 'late_morning_walk',
    category: 'health',
    title: '清晨的固定路线',
    text: '六点半，{name}沿着河边走同一条路线：早市的后门、修鞋摊、报刊亭，最后在石凳上歇五分钟。路线上的熟人不用约，到点就碰面。',
    minAge: 58,
    maxAge: 77,
    cooldown: 3,
    weight: 6,
    priority: 1,
    choices: [
      {
        text: '老路线走一圈，顺路帮修鞋摊搭把手',
        tooltip: '腿脚是自己的，人情也是自己的',
        summary: '三公里的路走了一个钟头，{name}帮着抬了半趟货',
        effects: [
          { attr: 'health', delta: 2 },
          { attr: 'social', delta: 1 },
        ],
      },
      {
        text: '今天懒得动，在石凳上晒会儿太阳',
        summary: '太阳很好，{name}坐到早市散场才慢悠悠往回走',
        effects: [{ attr: 'happiness', delta: 2 }],
      },
    ],
  },
  {
    id: 'late_teeth',
    category: 'health',
    title: '一口假牙',
    text: '牙科诊所的报价单压在玻璃板下：种植牙一颗上万，活动假牙全套三千出头。{name}用剩下的几颗牙嚼了半年，终于承认这事拖不过去了。',
    minAge: 64,
    maxAge: 77,
    once: true,
    weight: 6,
    priority: 1,
    // 零事件门槛（低收入覆盖）：高价档放选项级，负债/低收入时仍保「补牙+将就」两选项可见
    choices: [
      {
        text: '咬牙上活动假牙，吃饭是大事',
        tooltip: '三千出头，能把后半辈子的饭吃踏实',
        summary: '新牙装上的第一顿饭，{name}终于又尝出了排骨的味道',
        effects: [
          { money: -3200 },
          { attr: 'health', delta: 2 },
        ],
        requires: { moneyAtLeast: 3200 },
      },
      {
        text: '先补能补的，一颗一颗来',
        summary: '{name}和牙医约好了分次治疗，账单分成了一张张小条',
        effects: [
          { money: -800 },
          { attr: 'health', delta: 1 },
        ],
      },
      {
        text: '再凑合凑合，烂就烂吧',
        summary: '粥熬得越来越烂，{name}的食谱越来越短',
        effects: [{ attr: 'health', delta: -3 }],
      },
    ],
  },
  {
    id: 'late_old_letter',
    category: 'life',
    title: '一封迟到的信',
    text: '收拾柜顶的时候，一封没有寄出的信掉了下来——落款的日期是二十多年前。信纸上的字迹是{name}的，收信人的名字却怎么也想不起该怎么念出口。',
    minAge: 64,
    maxAge: 77,
    once: true,
    weight: 6,
    choices: [
      {
        text: '按信封上的地址，把它寄出去',
        tooltip: '迟到的诚意也是诚意',
        summary: '信寄出去的第二个月，回信来了——对方也老了，字迹发颤',
        effects: [
          { money: -20 },
          { attr: 'happiness', delta: 5 },
          { attr: 'social', delta: 2 },
        ],
      },
      {
        text: '重新读一遍，然后收进抽屉',
        summary: '{name}在灯下把信读了两遍，折好，压回了柜顶',
        effects: [{ attr: 'happiness', delta: 2 }],
      },
      {
        text: '烧了。有些话本来就不该寄',
        summary: '火盆里的纸灰打着旋，{name}觉得轻了不少',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: -2 },
        ],
      },
    ],
  },
  {
    id: 'late_neighbor_watch',
    category: 'relationship',
    title: '对门的钥匙',
    text: '对门的老太太要去女儿家住阵子，临走前把一把备用钥匙塞给{name}：「我那屋的花，劳您两三天浇一回。」{name}回屋也翻出了自己那把——万一呢。',
    minAge: 62,
    maxAge: 77,
    cooldown: 5,
    weight: 6,
    priority: 1,
    choices: [
      {
        text: '应下，从此两家的花都归你管',
        tooltip: '远亲不如对门',
        summary: '两家的门铃串在了一起，谁家炖了汤都多一碗',
        effects: [
          { attr: 'social', delta: 3 },
          { attr: 'happiness', delta: 3 },
        ],
        addTags: ['neighbor_bond'],
      },
      {
        text: '只答应浇花，钥匙就不留了',
        summary: '花浇得尽心，门还是各关各的',
        effects: [{ attr: 'social', delta: 1 }],
      },
      {
        text: '婉拒了。自己家的事自己扛惯了',
        summary: '老太太愣了一下，笑着说了句「也是」，两扇门轻轻关上',
        effects: [{ attr: 'happiness', delta: -1 }],
      },
    ],
  },
  {
    id: 'late_cheap_eats',
    category: 'life',
    title: '收摊前的菜市场',
    text: '傍晚六点半，菜市场的吆喝声变成了「全部两块」。{name}拎着布袋子在摊位间踱步——这个点，是一天里精打细算的人的主场。',
    minAge: 60,
    maxAge: 77,
    cooldown: 2,
    weight: 6,
    choices: [
      {
        text: '挑一堆处理的青菜，回去做一锅好汤',
        summary: '五块钱的菜做出了三菜一汤，{name}的手艺没得说',
        effects: [
          { money: -50 },
          { attr: 'health', delta: 1 },
        ],
      },
      {
        text: '和摊主聊聊，砍下来两毛是一毛',
        summary: '砍价的功夫顺便听了一肚子新鲜事，摊主抹了零头还搭了根葱',
        effects: [
          { money: -30 },
          { attr: 'social', delta: 1 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '今天想吃点好的，不省这个钱',
        summary: '{name}割了半斤五花肉，晚上给自己炖了',
        effects: [
          { money: -350 },
          { attr: 'happiness', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'late_solo_birthday',
    category: 'life',
    title: '今年的生日',
    text: '日历翻到那一页，{name}停了一下。没有蛋糕也没有惊喜的安排，但冰箱里有一块前一天买的芝士蛋糕，窗台上的花开得正好。',
    minAge: 62,
    maxAge: 77,
    cooldown: 4,
    weight: 6,
    choices: [
      {
        text: '给自己切一块蛋糕，配一壶好茶',
        tooltip: '自己把自己的日子过好，是本事',
        summary: '蜡烛用火柴代替，{name}许了个只有自己知道的愿望',
        effects: [
          { money: -100 },
          { attr: 'happiness', delta: 4 },
        ],
      },
      {
        text: '给老朋友打个电话，让TA随便聊聊',
        summary: '电话那头唱了首跑调的生日歌，{name}笑着笑着眼眶就热了',
        requires: { relationKinds: ['friend'] },
        effects: [
          { attr: 'happiness', delta: 5 },
          { relation: { kind: 'friend', deltaCloseness: 3 } },
        ],
      },
      {
        text: '当普通一天过，睡前才想起来',
        summary: '躺下的时候想起来了，{name}对着天花板说了句「又一年」',
        effects: [{ attr: 'happiness', delta: -1 }],
      },
    ],
  },
  {
    id: 'late_balcony_plants',
    category: 'life',
    title: '阳台上的花',
    text: '阳台上七八个花盆，是{name}一点点攒起来的家当。今早浇水时发现，那株养了三年都没动静的兰草，抽了一支新芽。',
    minAge: 60,
    maxAge: 77,
    cooldown: 3,
    weight: 6,
    choices: [
      {
        text: '换个大盆，郑重其事地伺候它',
        summary: '新盆垫了陶粒上了底肥，{name}逢人就说兰草抽芽的事',
        effects: [
          { money: -150 },
          { attr: 'happiness', delta: 4 },
        ],
      },
      {
        text: '剪一枝分给楼上楼下的邻居',
        summary: '一支兰草在三家窗台上轮着开，谁路过都要看一眼',
        effects: [
          { attr: 'social', delta: 2 },
          { attr: 'happiness', delta: 2 },
        ],
      },
      {
        text: '由它去，花有花的时候',
        summary: '{name}照旧浇水，不多看也不少看',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    id: 'late_old_radio',
    category: 'life',
    title: '老收音机',
    text: '用了三十年的收音机这几天只剩沙沙声。维修摊的年轻人捣鼓了半天：「大爷，这老古董零件都停产了，我给您看看还有没有替代件。」{name}摆摆手又坐了回去。',
    minAge: 64,
    maxAge: 77,
    once: true,
    weight: 6,
    choices: [
      {
        text: '送去修，修不好就当听个响',
        tooltip: '三十年习惯了的声音，值得',
        summary: '三天后收音机又响了，滋滋的电流声里评书字正腔圆',
        effects: [
          { money: -400 },
          { attr: 'happiness', delta: 4 },
        ],
      },
      {
        text: '用手机接着听，收音机留着当念想',
        tooltip: '新物件也好使，老物件不扔',
        summary: '评书App的进度条能拖了，收音机擦干净摆上了书架',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'smarts', delta: 1 },
        ],
      },
      {
        text: '静了就静了吧，正好清净',
        summary: '屋里安静了几天，{name}倒也睡得踏实',
        effects: [{ attr: 'stress', delta: -1 }],
      },
    ],
  },
  // ── 第 68 轮：倦怠晚年复发线——带着倦怠过日子，也是一种韧性（不摘标记）──
  {
    id: 'late_burnout_rekindle',
    category: 'health',
    title: '提不起劲的日子',
    text: '退休好些年了，那种使不上力的感觉却偶尔还来。{name}坐在阳台上晒了一上午太阳，什么也没干——老邻居探过头来：「今天不上公园啊？」',
    minAge: 58,
    maxAge: 77,
    cooldown: 3,
    weight: 9,
    requires: { tagsAll: ['burnout'] },
    choices: [
      {
        text: '翻出老相册，从第一页看起',
        summary: '看到第三十页，{name}给老照片拍了照，发给了孩子',
        effects: [
          { attr: 'happiness', delta: 4 },
          { attr: 'stress', delta: -5 },
        ],
      },
      {
        text: '去河边坐一下午，就钓鱼',
        summary: '鱼没钓着几条，但浮漂每动一下，心就跟着动一下',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: -3 },
        ],
      },
      {
        text: '应老邻居一声，明天去公园',
        summary: '第二天，{name}真的去了。步子慢，但去了',
        effects: [
          { attr: 'happiness', delta: 3 },
          { attr: 'health', delta: 1 },
        ],
      },
    ],
  },
  // ── 第 70 轮：时代纵深 II 纯氛围（56-64 / 58-66 / 66-77）——代际质感三则 ──
  {
    id: 'late_family_group_rumor',
    category: 'life',
    title: '家庭群里的养生文',
    text: '家族群一早上炸出十几条转发：《转疯了！这三种食物千万不能一起吃》。发最勤的是二姨，配了九个感叹号。{name}点进去一看，又是那套老话术。',
    minAge: 56,
    maxAge: 64,
    weight: 7,
    cooldown: 5,
    choices: [
      {
        text: '认真查证，把辟谣链接发回群里',
        summary: '二姨回了三个「哦」。但第二天，群里的转发少了',
        effects: [
          { attr: 'smarts', delta: 1 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '默默划过去，不扫长辈的兴',
        summary: '那年头的养生观，也是长辈们各自的铠甲',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    id: 'late_teach_ride_hailing',
    category: 'life',
    title: '教母亲用打车软件',
    text: '母亲把手机递过来，屏幕上是她研究了半天也没弄明白的打车软件。「去你妹夫家，人家说打这个车便宜。」{name}深吸一口气——这个app，上一周教过两遍了。',
    minAge: 58,
    maxAge: 66,
    weight: 7,
    cooldown: 5,
    choices: [
      {
        text: '拿纸笔画图，掰开揉碎地教',
        summary: '三天后母亲发来一张截图——她自己叫到了车，还挑了「推荐」',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'social', delta: 1 },
        ],
      },
      {
        text: '直接帮TA叫好，省事',
        summary: '车五分钟到了。母亲说了声「真方便」，{name}心里却有点不是滋味',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    id: 'late_old_phone_decade',
    category: 'life',
    title: '旧手机里的十年',
    text: '换新手机，营业员问旧数据要不要迁移。{name}翻开旧相册往下滑——2016 年的年夜饭、2019 年的公园、去年生日的蛋糕。十年，一万多张照片，一张都没舍得删。',
    minAge: 66,
    maxAge: 77,
    weight: 7,
    cooldown: 5,
    choices: [
      {
        text: '整理一遍，全部传上云相册',
        summary: '传了一整晚。十年被妥妥帖帖地收进了「云端」，四十年前的记忆还揣在怀里',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'smarts', delta: 1 },
        ],
      },
      {
        text: '旧手机擦干净收进抽屉，留着',
        summary: '新手机用新的，旧手机躺在抽屉里——像一位不说话的老朋友',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    id: 'late_donation',
    category: 'life',
    title: '一封来自母校的信',
    text: '母校的来信放在{name}手边：老旧的教学楼要翻新，校友会正在募捐。信纸的末尾有一行小字：「金额不限，心意无价。」',
    minAge: 60,
    maxAge: 75,
    once: true,
    requires: { moneyAtLeast: 100000 },
    choices: [
      {
        text: '捐 100,000，以家人之名冠名图书角',
        tooltip: '大额捐赠 100,000 元',
        summary: '新书进校那天，{name}受邀回去剪了彩。孩子们的书角上，钉着一块小小的铜牌',
        effects: [
          { money: -100000 },
          { attr: 'happiness', delta: 4 },
        ],
        addTags: ['donor'],
      },
      {
        text: '捐 10,000，尽一份心意',
        tooltip: '小额捐赠 10,000 元',
        summary: '{name}转了一笔不大不小的款。不为留名，只为那点念想',
        effects: [
          { money: -10000 },
          { attr: 'happiness', delta: 1 },
        ],
        addTags: ['donor'],
      },
    ],
  },

  // ─── 第 101 轮《时代纵深 III》：4 枚纯氛围事件，定向补 66-77 最薄桶 ──
  // 依据：age_heatmap 实测 66-77 桶覆盖 80（全池最薄），逐岁看 76/77 岁仅 39 条窗口、
  // 75 岁 58 条，为全龄段最薄两岁。四枚均落在 [70,77] 以覆盖最薄区。
  // 写法沿用 youth_livehouse / mid_nav_memory 蓝本：category 'life'、≥2 选项、
  // 金额零或小额、**无机制效果**（不加标签、不改属性、无比拟人关系、无延迟结算）。
  // 撞题扫描已核对 late.ts 全部 39 条 + 全池 62+ 事件标题，以下四主题均为空白位：
  // 老空位（vs late_friends_fade 讣告的不同处理面）／养老院参观（无既有时效事件）／
  // 远居他乡（vs city_return_retire 返乡机票的不同方向）／银发再就业（无同题）。
  {
    id: 'late_taoli_chair',
    category: 'life',
    title: '楼下那张空椅子',
    text: '楼下石桌旁的那张空椅子，摆了快一年了。以前老周每天这个点下楼雷打不动，坐下先抱怨两句天气，再把当天听来的闲话说一遍。现在没人坐了，边上的花盆倒了，{name}路过时顺手把它扶起来。',
    minAge: 70,
    maxAge: 77,
    weight: 6,
    cooldown: 8,
    choices: [
      {
        text: '买盆新的花，放回他常坐的位置',
        tooltip: '二十来块，不算什么',
        summary: '{name}挑了盆开得正好的绿萝放上去，路过的人偶尔会多看一眼',
        effects: [{ money: -25 }, { attr: 'happiness', delta: 1 }],
      },
      {
        text: '把椅子收进仓库，眼不见心不烦',
        summary: '搬进仓库那天，位置空出来一大片，{name}反而觉得太空了',
        effects: [{ attr: 'happiness', delta: -1 }],
      },
      {
        text: '每天下楼，在旁边站一会儿就走',
        summary: '不一定每天都去，但去的时候，{name}总会在那张椅子旁边停两分钟',
        effects: [{ attr: 'stress', delta: -1 }],
      },
    ],
  },
  {
    id: 'late_care_home_visit',
    category: 'life',
    title: '参观养老院',
    text: '老同学组了个局，去参观新开的养老院。样板间干净明亮，床是可升降的，卫生间扶手齐全，护工说一个班八个人。参观的人一路都在点头，走到院子里时，有人小声问：住这儿，一年得多少钱？',
    minAge: 70,
    maxAge: 77,
    weight: 5,
    cooldown: 10,
    requires: { tagsAny: ['retired'] },
    choices: [
      {
        text: '把宣传册带回家，夹在床头柜的抽屉里',
        summary: '{name}把它和身份证放在同一格，谁也没提，但那一晚睡得踏实',
        effects: [{ attr: 'stress', delta: -1 }],
      },
      {
        text: '当场把名额问清楚，回家路上算了两遍账',
        summary: '一整路都在默算数字，算到第三个路口时忽然不想算了——先吃饭',
        effects: [{ attr: 'stress', delta: 1 }],
      },
      {
        text: '跟老同学说：还早呢，看什么看',
        summary: '话说得硬朗，返程的车上窗外的路灯一盏一盏往后退，谁也没再接话',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    id: 'late_digital_nomad',
    category: 'life',
    title: '换个地方住一阵',
    text: '短视频上刷到有人五十来岁开始「数字游民」——半年住在某座海边小城，租个小院，日子过得比上班时还松。{name}顺手点了收藏，收藏夹里躺着七八条这样的视频，躺了两年了。',
    minAge: 70,
    maxAge: 77,
    weight: 5,
    cooldown: 12,
    choices: [
      {
        text: '先住一个月试试，短租不用办那么多手续',
        tooltip: '住一次，账不用算太细',
        summary: '第一个月新鲜，第二个月开始盼快递，第三个月{name}还是回来了，但会想起海风',
        effects: [{ money: -4000 }, { attr: 'happiness', delta: 1 }],
      },
      {
        text: '不动，把这条转发到家庭群',
        summary: '群里安静了两分钟，然后老伴发来一句：「你想去看就去看吧。」',
        effects: [{ attr: 'social', delta: 1 }],
      },
      {
        text: '关掉手机，去阳台把花浇了',
        summary: '有些地方听听就好，{name}的阳台和钓点都还在原地',
        effects: [{ attr: 'stress', delta: -1 }],
      },
    ],
  },
  {
    id: 'late_silver_rework',
    category: 'life',
    title: '六十五岁的新岗位',
    text: '社区群里转过一张招聘表：社区食堂帮厨只要六十五岁以上的，每天下午三点到七点，一个月两千七。「银发经济」这个词{name}在新闻里见过几次，真落到自己手机上时，还是愣了一会儿。',
    minAge: 70,
    maxAge: 77,
    weight: 5,
    cooldown: 10,
    requires: { tagsAny: ['retired'] },
    choices: [
      {
        text: '去试试，反正下午闲着',
        summary: '第一天切了三个小时的菜，手腕有点酸。第五天以后，食堂里的人开始喊「张姨」',
        effects: [{ money: 2700 }, { attr: 'health', delta: 1 }],
      },
      {
        text: '不去了，退休金够花，闲下来的时间想留给自己',
        summary: '{name}把表格转给了同住的老伴，权当没发过这条',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
      {
        text: '先问清楚有没有社保和体检',
        tooltip: '老年人的账往往不在工资上',
        summary: '问完心里有了底，也知道了这样的活不常有——名额比想报的人少',
        effects: [{ attr: 'stress', delta: 1 }],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // 第 102 轮：事件池扩容收尾 · 薄处补密（5 枚落在 56-65 桶专属位 + 4 枚落在 66-77 桶）
  // 设计基线：age_heatmap 实测 56-65 桶「专属覆盖」仅 1 枚、66-77 桶覆盖 84 为全池最薄。
  // 本组 9 枚窗口全部完全落在单桶内（专属），使两桶专属数分别 1→6、6→10。
  // 撞题扫描三轮（.r102/scan.ts、gap.ts、gap2.ts、gap3.ts）：
  //   「邻里互助 14 命中」「聚会饭局 26 命中」「旧友通讯录 10 命中」「独居远距 11 命中」
  //   「交通出行 10 命中」「身体就医 15 命中」六主题全部作废原候选，改走零命中与稀疏位。
  // category 严格限定在既有 6 类内（late.test.ts 断言恰好 6 种，加第 7 类别必挂红）。
  // 硬约束：minAge ≥ 51、maxAge ≤ 78。
  // ═══════════════════════════════════════════════════════════════════

  // ── 56-65 桶专属 ×5 ──

  // 半退休过渡：退休手续是既有事件（late_retirement_paperwork），此处只写「退而不休的那几年」
  {
    id: 'late_half_retire',
    category: 'career',
    title: '半退休的中间几年',
    text: '不坐班了，也没到完全不干活。单位说「每周来两天，剩下的你自己安排」。{name}算了算，一天六十，一天就少了一大半；可一年三百六十天，一下子又不那么满。',
    minAge: 56,
    maxAge: 63,
    cooldown: 5,
    weight: 9,
    choices: [
      {
        text: '每周去满两天，把这摊事收尾',
        tooltip: '彻底交出去之前，先把该教的教会',
        summary: '带出来两个能顶事的，然后真的把手上的活放下了',
        effects: [
          { money: 1600 },
          { attr: 'happiness', delta: 1 },
          { attr: 'social', delta: 1 },
        ],
      },
      {
        text: '一天都不去，界限划干净',
        summary: '工牌交回去那天，胸口空了一块，第二天就填上了',
        effects: [
          { attr: 'happiness', delta: 3 },
          { attr: 'stress', delta: -2 },
        ],
      },
      {
        text: '去了两次，发现还是累',
        summary: '从那以后每周改成了「有事叫我」',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },

  // 慢病日常管理：慢病既有关键事件是「确诊」与「发作」，此处补的是中间那些年的重复动作
  {
    id: 'late_chronic_routine',
    category: 'health',
    title: '一周七格的药盒',
    text: '星期三早上的降压药，上个月漏过两次。这回{name}买了个分格药盒，格子背面用笔标了「早」「晚」——字越写越大，因为眼睛已经有点花。',
    minAge: 57,
    maxAge: 65,
    cooldown: 4,
    weight: 10,
    choices: [
      {
        text: '定闹钟，老老实实按格吃',
        summary: '闹钟响三次，格子空三次，血压那页纸半年没大波动',
        effects: [
          { money: -400 },
          { attr: 'health', delta: 2 },
        ],
      },
      {
        text: '感觉好了就停，下次再说',
        summary: '指标看着稳了，其实是把反弹攒在了身体里',
        effects: [
          { attr: 'health', delta: -2 },
          { attr: 'stress', delta: 1 },
        ],
      },
      {
        text: '跑一趟大医院，问个明白',
        tooltip: '把小医院的方子和网上说的对一遍',
        summary: '排了四个小时队，医生改了两个剂量，还说了句「按时吃」',
        effects: [
          { money: -700 },
          { attr: 'health', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
    ],
  },

  // 楼道与停电：全池零命中（gap3.ts「楼道与电梯」0 命中）
  {
    id: 'late_elevator_wait',
    category: 'life',
    title: '电梯停在了十楼',
    text: '停电通知贴在电梯门上，纸质发黄。{name}拎着两袋菜站在楼梯口，往下看了一眼——七层，楼道灯有两层是坏的。',
    minAge: 58,
    maxAge: 65,
    cooldown: 3,
    weight: 10,
    choices: [
      {
        text: '慢慢下，一层一层扶着',
        summary: '下了四十分钟。到家把菜放进冰箱，手心全是汗',
        effects: [
          { attr: 'health', delta: -1 },
          { attr: 'happiness', delta: -1 },
        ],
      },
      {
        text: '在楼道口等，等电来',
        summary: '在楼道口坐了半小时，隔壁下来两个人，一起等',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'social', delta: 1 },
        ],
      },
      {
        text: '打电话叫人来接',
        summary: '半小时后下了楼。上车时对方说：「下回直接给我打。」',
        effects: [
          { attr: 'stress', delta: -1 },
          { attr: 'happiness', delta: 1 },
        ],
      },
    ],
  },

  // 修旧物：全池仅 4 命中且均为别的题材（late_old_radio 收老式收音机而非动手修）
  {
    id: 'late_repair_thing',
    category: 'life',
    title: '扳手和一盏台灯',
    text: '台灯的开关时灵时不灵。{name}从柜子底下翻出当年攒的一盒螺丝刀和一把小扳手，摆在桌上，忽然觉得手有点痒——这东西多少年没动过了。',
    minAge: 60,
    maxAge: 65,
    cooldown: 4,
    weight: 9,
    choices: [
      {
        text: '拆开修',
        tooltip: '一个接触不良，拧紧螺丝就行',
        summary: '半小时后灯亮了：那盏灯比自己岁数还大',
        effects: [
          { attr: 'happiness', delta: 3 },
          { attr: 'social', delta: 1 },
        ],
      },
      {
        text: '修不好，给它换掉',
        summary: '新的插上去就亮。旧的没扔，塞进了柜子最下层',
        effects: [
          { money: -300 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '先放着，反正不急',
        summary: '工具盒还是原样收回去，只是又挪到了顺手的位置',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },

  // 同辈参照：全池仅 2 命中，且都不是「同龄人对照」口径
  {
    id: 'late_peer_gap',
    category: 'relationship',
    title: '同学群里的两张照片',
    text: '同学群里有人晒带孙子去公园的照片，配文「老咯」。{name}点开看了看自己的相册——上一次出门，还是去年体检那天。',
    minAge: 59,
    maxAge: 65,
    cooldown: 5,
    weight: 8,
    choices: [
      {
        text: '这个周末也出门走走',
        summary: '走了两个小时，遇到三个认识的，三个都是一个人',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'health', delta: 1 },
          { attr: 'social', delta: 1 },
        ],
      },
      {
        text: '退群，清净',
        summary: '设了免打扰。晚上那点提示音不响了，屋子也安静了',
        effects: [
          { attr: 'stress', delta: -2 },
          { attr: 'happiness', delta: -1 },
        ],
      },
      {
        text: '给最熟的那个打个电话',
        summary: '聊了四十分钟，两人都说明年再来一次',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'social', delta: 1 },
        ],
      },
    ],
  },

  // ── 66-77 桶专属 ×4 ──

  // 听力与白内障：全池仅 3 稀疏命中，且均为「助听器」顺带一提
  {
    id: 'late_hearing_aid',
    category: 'health',
    title: '听不清的那句话',
    text: 'TA站在灶台前问「盐在哪儿」？{name}指了指——指错了。于是走过去再指一次，心里明白了一件事：这个毛病躲不过去，也躲不掉。',
    minAge: 66,
    maxAge: 74,
    cooldown: 6,
    weight: 10,
    choices: [
      {
        text: '配一副助听器',
        tooltip: '先做听力图再定，别自己随便买',
        summary: '戴上的第三天，第一次听清了电视里的一句台词',
        effects: [
          { money: -3000 },
          { attr: 'health', delta: 2 },
          { attr: 'happiness', delta: 2 },
        ],
      },
      {
        text: '把老花镜也一起配了',
        summary: '一趟跑了两家店，配完在路边眯着眼看了一会儿车流',
        effects: [
          { money: -800 },
          { attr: 'health', delta: 1 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '不用，该听见的我都听得见',
        summary: '说话不自觉地大了声，慢慢也不觉得需要对方回应了',
        effects: [
          { attr: 'health', delta: -1 },
          { attr: 'social', delta: -2 },
        ],
      },
    ],
  },

  // 老友离世：讣告/灵堂全池仅 2 命中，均在别的事件里一笔带过
  {
    id: 'late_friend_funeral',
    category: 'relationship',
    title: '又一个名字',
    text: '追悼会定在周三，很近。{name}到的时候，那张脸前站着的全是这个岁数的人——数了一圈，发现自己就是最年轻的那一个。',
    minAge: 66,
    maxAge: 75,
    cooldown: 8,
    weight: 9,
    requires: { relationKinds: ['friend'] },
    choices: [
      {
        text: '送到底，然后在门口和几个老同学多站一会儿',
        summary: '散了以后没人先走，站了二十分钟，说了些不痛不痒的话',
        effects: [
          { attr: 'happiness', delta: -3 },
          { attr: 'social', delta: 2 },
        ],
      },
      {
        text: '去，但不留下吃饭',
        summary: '鞠完躬就走了。走出两百米，又回头看了一眼',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: 1 },
        ],
      },
      {
        text: '没去，礼到了',
        summary: '礼金托人带过去了，名字没进那份名单',
        effects: [
          { money: -500 },
          { attr: 'happiness', delta: -3 },
        ],
      },
    ],
  },

  // 和孩子的距离：全池零命中（gap3.ts），资格由 child 关系门控而非事件级假设
  {
    id: 'late_kid_faraway',
    category: 'relationship',
    title: '通话时长：1分12秒',
    text: '上次通话是一分十二秒，其中四十秒在说明孩子学校下学期的缴费时间。{name}看着屏幕上的时长记录，忽然想问一句「你最近好吗」，又怕问出来只有一句「还行」。',
    minAge: 66,
    maxAge: 77,
    cooldown: 5,
    weight: 9,
    requires: { relationKinds: ['child'] },
    choices: [
      {
        text: '订张票，去那边住一阵',
        tooltip: '当面比电话快，一顿饭的工夫能聊完三个月的量',
        summary: '住了十九天，走的时候行李箱比来时多了一半',
        effects: [
          { money: -1500 },
          { attr: 'happiness', delta: 3 },
          { attr: 'social', delta: 1 },
        ],
      },
      {
        text: '把「你最近好吗」改成「吃了吗」',
        summary: '问得少了，回得也快，两个人都不觉得有什么不对',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: -1 },
        ],
      },
      {
        text: '约好以后每周固定视频',
        summary: '每周日晚上八点，雷打不动——执行了两个月，然后断在第三个月',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'social', delta: 1 },
        ],
      },
    ],
  },

  // 手抖拿不稳：全池仅 2 命中，属未占用的身体细节位
  {
    id: 'late_body_shake',
    category: 'health',
    title: '水洒在了桌上',
    text: '倒水的时候手抖了半下，一小股水淌到了写字的那张纸上，笔画洇开。{name}把纸拿起来晾着，忽然发现拿纸的那只手也在抖。',
    minAge: 68,
    maxAge: 77,
    cooldown: 5,
    weight: 9,
    choices: [
      {
        text: '去查一查，是药还是病',
        summary: '医生调了两种药，说是这个年纪常见的副作用，换了之后手稳了大半',
        effects: [
          { money: -600 },
          { attr: 'health', delta: 2 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '用两只手扶着，慢慢来',
        summary: '端水必扶桌，写字必垫本子，速度慢了一半，但没洒过第二回',
        effects: [
          { attr: 'health', delta: -1 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '少用笔，改用说的',
        summary: '家里的话变少了；有些事就这么咽回去了',
        effects: [
          { attr: 'social', delta: -2 },
          { attr: 'happiness', delta: -1 },
        ],
      },
    ],
  },

  // ── 第 108 轮：晚年丧偶与独居重建线（4 枚）────────────────────────────
  //
  // 空洞成因：全池 `丧偶/老伴去世/先走/鳏/寡/配偶去世` 六词扫描命中 0，
  // `late_growing_old_together`（老伴手术单）与 `mar_*` 全部只写「老伴在」，
  // 56 岁以后已婚角色的另一半**从未离开过**——晚年的失去与重建整条线是空的。
  //
  // 方案：真实状态变更，不做叙事模拟。任务书设计决策 1 的兜底条款明文写着
  // 「若盘点发现引擎已有 relation.remove 类效果则优先用之；若无，则采用反向门控
  // + 叙事」——盘点结果是**有**（relations.ts:109，且 relationship.ts:206 的
  // 分手事件早就在用），故走 remove 这条更靠前的路。
  //
  // 为什么不能用「反向门控 + 叙事」（任务书兜底方案），本轮据实偏离并记录：
  //   ① 反向门控（要求无 spouse）对**从未结婚的人**成立，等于凭空给他发一段丧偶
  //      ——违反 §7 资格红线「新事件不假设玩家有配偶」，且 addTags:['widowed']
  //      会把一个单身汉标成丧偶者；
  //   ② 「叙事说TA 走了、状态里 spouse 仍在册」本身就是矛盾：结局 `family_hearth`
  //      的判定含 `spouseAlive(s)`，叙事说人没了、判定还当人活着；
  //   ③ 引擎的效果校验器（validateEvents.ts:189-193）本就禁止这种写法——
  //      「remove 需要存活的 spouse 关系，但事件与选项条件都未保证其存在，效果必然无效」。
  //   引擎的裁决与上述两条一致，故按引擎走。
  //
  // 为什么必须同步摘 `married`（否则是隐藏 bug，不是风格问题）：
  //   ① 结局 `family_hearth` 判定为 `tags.includes('married') && spouseAlive(s)`——
  //      只摘关系不摘标记，玩家会永远卡在这个 A 级结局门口却再也进不去；
  //   ② `marriage_v5` 的 `div_single_life` 按 `divorced` 标记门控，若只摘关系不摘标记，
  //      丧偶者会同时挂着 `married` 与 `divorced` 两个互斥身份。
  //   引擎 `Effect.divorce` 走的就是「移出关系 + 摘标记」双动作，本轮复用同一套语义，
  //   区别只在触发路径（丧偶不是玩家选项，是事件后果）。
  //
  // 四枚的分工与门控（A2 的实际口径，见账本）：
  //   ① late_widow_first_year  —— **配偶在册**才触发，选择后真移除 spouse。
  //      这是「防凭空丧偶」的正确形态：叙事说的每一句都在状态里兑现了。
  //   ②③ —— **要求 widowed 标记或无配偶**，是①的下游（重建线），单身的终身者也能触发。
  //   ④  —— 要求无配偶，任何单身者都可触发（对标 late_late_companion 的搭伴门控）。
  {
    id: 'late_widow_first_year',
    category: 'relationship',
    title: '第一年',
    text: '老伴是开春走的。{name}把两个人的碗筷分开放好的时候才发现，抽屉最下面那双筷子，TA用了四十年，磨得发亮。第一个冬天最难——不是难过，是不知道该跟谁说今天路上看见了什么。',
    minAge: 56,
    maxAge: 65,
    once: true,
    priority: 1,
    weight: 13,
    // 刻意**不设 priority**（即 0），这是本轮留下的一条已量化的待决项，不是疏漏：
    //   weightedPick 只在最高优先级层里挑，同窗口的 priority≥1 晚期事件会把整层锁死。
    //   实测（.r108/prio_sweep.ts，432 局 × 4 档扫描）：
    //     不设 priority → 本事件只在 19.6% 的候选年能进抽取层，432 局仅遭遇 1 次，
    //                      占全部人生 0.23%、占「有资格的人生」8.3%；
    //     取 priority=1 → 遭遇 12 次（2.78%），且恰等于「能把配偶带进 56-65」的人生总数，
    //                      即凡走到这一步的人都会遇到它；
    //     取 2/3 → 与 chronic/父母离世两类更重的转折同层，会抢占它们，故不取。
    //   本轮未采纳 priority=1 的原因：它会让 round29 的「有偶线 68 岁家庭完整」断言必然翻红，
    //   而那条断言是「引擎根本没有配偶死亡机制」时的产物（它断言的是功能缺失，不是产品承诺）。
    //   改一条跨轮不变量属于产品级裁决，超出本轮「data 为主、机制值冻结」的范围，
    //   故留待 R110/R111 由任务书裁决。届时若采纳 1，须同步改 round29 两条断言。
    requires: { relationKinds: ['spouse'] },
    choices: [
      {
        text: '把 TA 的照片摆出来，不收',
        tooltip: '让屋子还是两个人的样子',
        summary: '相框摆在老位置，饭还是摆两副筷子。{name}说，这样说话时不觉得是对空气说',
        effects: [
          { relation: { kind: 'spouse', remove: true } },
          { attr: 'happiness', delta: -3 },
          { attr: 'stress', delta: 2 },
          { attr: 'social', delta: -2 },
        ],
        addTags: ['widowed'],
        removeTags: ['married'],
      },
      {
        text: '收进柜子，日子往前挪',
        tooltip: '该关的门得关，不然后面二十年走不动',
        summary: '照片收进柜子，碗筷收成一副。头一年很难，第二年春天{name}把窗子重新打开了',
        effects: [
          { relation: { kind: 'spouse', remove: true } },
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: -1 },
        ],
        addTags: ['widowed'],
        removeTags: ['married'],
      },
      {
        text: '先睡一觉，这件事明天再办',
        tooltip: '身体先垮下来就什么都办不了了',
        summary: '{name}那天什么也没做。躺了一整天，第三天把该办的都办了，人反而稳住了',
        effects: [
          { relation: { kind: 'spouse', remove: true } },
          { attr: 'happiness', delta: -2 },
          { attr: 'health', delta: -1 },
          { attr: 'stress', delta: 3 },
        ],
        addTags: ['widowed'],
        removeTags: ['married'],
      },
    ],
  },
  {
    id: 'late_widow_social_rebuild',
    category: 'relationship',
    title: '重新排班表',
    text: '老伴走后第二个春天，{name}发现自己是所有人里最晚回消息的那个——不是不想说话，是不知道该跟谁说。社区老年大学的活动表贴出来了，一整排时间，从周二排到周日。',
    minAge: 56,
    maxAge: 65,
    cooldown: 8,
    weight: 11,
    requires: { tagsAny: ['widowed'], relationKindsNone: ['spouse', 'partner'] },
    choices: [
      {
        text: '报个班，学点用得上的',
        tooltip: '手机摄影、智能手机、合唱——挑一个不丢人的',
        summary: '报了合唱团。第一次张嘴时没人鼓掌，但也没人跑调',
        effects: [
          { attr: 'social', delta: 4 },
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'friend', add: true, name: '合唱团的老陈', closeness: 55 } },
        ],
        addTags: ['rebuilding_social'],
      },
      {
        text: '不报班，还是老几个朋友',
        tooltip: '旧关系够用，不必重新认识人',
        summary: '推掉了三回邀约，还是那几个老伙计的局。{name}说，认识的这几个人够了',
        effects: [
          { attr: 'social', delta: 1 },
          { attr: 'happiness', delta: -1 },
          { relation: { kind: 'friend', deltaCloseness: 3 } },
          { relation: { kind: 'friend', add: true, name: '楼下棋友老吴', closeness: 50 } },
        ],
      },
      {
        text: '去当个志愿者，帮人比被帮容易',
        tooltip: '有事干的日子过得快',
        summary: '在阅览室帮着登记，一周两个半天。{name}说，反正一个人在家也是坐着',
        effects: [
          { attr: 'social', delta: 3 },
          { attr: 'stress', delta: -3 },
          { attr: 'happiness', delta: 1 },
        ],
        addTags: ['rebuilding_social'],
      },
    ],
  },
  {
    id: 'late_widow_living_alone',
    category: 'life',
    title: '四层楼的楼梯',
    text: '楼下的老周搬走了。{name}一个人扛了一袋米上了四楼，中间歇了两次。第二天{name}开始认真地算一笔账：洗衣做饭、看病拿药、哪天跌倒了谁来开门——这些事，以前都是两个人分着做的。',
    minAge: 66,
    maxAge: 77,
    cooldown: 8,
    weight: 11,
    requires: { relationKindsNone: ['spouse', 'partner'] },
    choices: [
      {
        text: '装扶手、买呼叫器，把风险掐在前面',
        tooltip: '花一笔小钱，换不用开口求助',
        summary: '卫生间加了扶手，床头挂了个呼叫器。{name}说，这东西不一定用得上，但买回来那天晚上睡得踏实',
        effects: [
          { money: -4800 },
          { attr: 'health', delta: 1 },
          { attr: 'stress', delta: -3 },
        ],
        requires: { moneyAtLeast: 4800 },
        addTags: ['living_alone'],
      },
      {
        text: '只换个新门铃，凑合用',
        tooltip: '不花钱，但要跑一趟儿女那边',
        summary: '只把门口那个旧铃换了新的。{name}说，真到了那天，麻烦孩子一次也没什么',
        effects: [
          { money: -600 },
          { attr: 'health', delta: -1 },
          { attr: 'stress', delta: -1 },
        ],
        addTags: ['living_alone'],
      },
      {
        text: '再养一只猫——有个会喘气的，家里就不一样',
        tooltip: '有活物在，出事时能早半分钟知道',
        summary: '领养了一只八岁的橘猫。{name}说，它半夜在客厅走动的声音，比开着的电视踏实',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 3 },
          { attr: 'social', delta: 1 },
          { relation: { kind: 'pet', add: true, name: '老黑', closeness: 60 } },
        ],
        addTags: ['pet_owner', 'living_alone'],
      },
    ],
  },
  {
    id: 'late_widow_new_mate_boundary',
    category: 'relationship',
    title: '不必再找一个人',
    text: '楼下老周走后，隔壁搬来一位，姓什么不知道，只在电梯里点过头。社区群里有人热心，要给两个人牵个线。{name}回了一句「不用了」，发完盯着屏幕看了很久——不是拒绝，是怕开了这个头，就再也收不回来。',
    minAge: 66,
    maxAge: 77,
    cooldown: 10,
    weight: 9,
    requires: { relationKindsNone: ['spouse', 'partner'] },
    choices: [
      {
        text: '跟邻居交个朋友，别的先不想',
        tooltip: '搭伙过日子那条道留给 late_late_companion；这里写的是「先不说出口」',
        summary: '电梯里的点头变成了敲门。{name}想清楚了一层：先做朋友这一步，谁也不欠谁',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'social', delta: 2 },
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'friend', add: true, name: '隔壁的老方', closeness: 50 } },
        ],
        addTags: ['mate_boundary'],
      },
      {
        text: '把话说死：一个人挺好的',
        tooltip: '不去想了，也不用跟谁解释',
        summary: '在群里回了那两个字就下了线。{name}把手机放回桌上，想一个人待着',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'social', delta: -2 },
          { attr: 'stress', delta: -1 },
        ],
        addTags: ['mate_boundary'],
      },
      {
        text: '去老年大学看看，不承诺什么',
        tooltip: '先去人多的地方坐着',
        summary: '去了老年大学，坐了一下午什么也没干。回家路上想，也许不用现在就决定',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'social', delta: 1 },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
  // 第 110 轮（V6）：记忆与认知主题 2 枚——全池「忘事/记性/认知」六词扫描零命中的补缺。
  // 刻意做成**可逆的早期信号**，不做确诊式判决（任务书设计决策 2）：
  //   文案里不出现「阿尔茨海默/失智/痴呆」三个重词——游戏不制造恐慌、不把 aging 写成必然；
  //   「忘事/记性/认知」三个轻词进文案，使主题词表与文本双向可扫描。
  //   两枚均**独立门控**（仅年龄窗），不读 lifestyle.ts 的 healthRisk 链、
  //   不加任何新标记、不挂 fameChance/散列门——与慢性病链零耦合。
  {
    id: 'late_memory_early_sign',
    category: 'health',
    title: '同一件事讲了第三遍',
    text: '活动站的老伙计笑{name}，上个月讲过的事这个月又讲了一遍，讲得一字不差。{name}也跟着笑，心里却咯噔了一下——最近确实总有这样的时候：钥匙攥在手里，还满屋子找钥匙；话到嘴边，忽然忘了要说啥。是普通的忘事，还是记性真的不行了？{name}没敢往下想。',
    minAge: 56,
    maxAge: 65,
    cooldown: 8,
    weight: 10,
    choices: [
      {
        text: '去医院的记忆门诊查一查',
        tooltip: '挂号检查 800 元；查清楚，心里有底',
        summary: '量表、抽血，折腾了一上午。医生说属于和年纪相称的健忘，睡得差和操心是主因，教了一套认知训练。{name}走出医院，脚步轻了',
        effects: [
          { money: -800 },
          { attr: 'stress', delta: -3 },
          { attr: 'health', delta: 1 },
        ],
      },
      {
        text: '把日子过成清单，便签贴满门后',
        tooltip: '用外部记性替脑子分担',
        summary: '门后三张便签：钥匙、燃气、周三复诊。忘的事没变少，慌的事变少了',
        effects: [
          { attr: 'stress', delta: -2 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '谁也不说，自己硬扛',
        tooltip: 'stress+2',
        summary: '「说了又能怎样」——{name}把担忧咽了回去。只是那之后，活动站去得少了',
        effects: [
          { attr: 'stress', delta: 2 },
          { attr: 'social', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'late_mind_rhythm',
    category: 'life',
    title: '脑子越用越活',
    text: '活动站里下棋，老张总输，却每盘都到。他说：记性这东西跟腿脚一样，越不用越废。{name}琢磨这话，是这个理——可怎么个用法，各人有各人的过法。',
    minAge: 66,
    maxAge: 77,
    cooldown: 10,
    weight: 9,
    choices: [
      {
        text: '报个老年大学的书法班和算盘班',
        tooltip: '学费 1,200 元；脑子有新活儿了',
        summary: '{name}把课程表贴在冰箱上。算盘打得慢，但拨一个响一个，心里踏实',
        effects: [
          { money: -1200 },
          { attr: 'smarts', delta: 1 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '每天遛弯换新路线，逼自己记路',
        tooltip: '零花费；身体和记性一起练',
        summary: '左转右转，到第三周，{name}已经能给迷路的老伙计指路了',
        effects: [
          { attr: 'health', delta: 1 },
          { attr: 'smarts', delta: 1 },
        ],
      },
      {
        text: '记不住的就由它去，不跟自己较劲',
        tooltip: '心态放宽',
        summary: '忘就忘了——记性年轻时候都用过了头，如今该歇歇了。嗯，刚才想说什么来着？{name}自己先笑了',
        effects: [{ attr: 'happiness', delta: 2 }],
      },
    ],
  },
  {
    // ── 第 120 轮（V7）：养老方式线——怎么老去 ──
    // 撞题差异化：适老化改造（late.ts 475）=居家内部改造单事件；搭伴（late_late_companion）=
    // 婚姻线；返聘（career.ts 469/late.ts 61）=职业线。本线=居所方式抉择层，方式 tag
    // （elder_home/elder_with_child/elder_institution）为纯增量层，不劫持既有晚年事件网。
    id: 'elder_how',
    category: 'life',
    title: '怎么老去',
    text: '身体一年比一年诚实。{name}开始认真想一件事：往后的日子，在哪里过、跟谁过、怎么过。这不是一时兴起的问题——这是下半生的选址。',
    minAge: 60,
    maxAge: 72,
    once: true,
    weight: 10,
    requires: { tagsNone: ['elder_home', 'elder_with_child', 'elder_institution'] },
    choices: [
      {
        text: '守着老窝，居家养老',
        summary: '金窝银窝不如自己的老窝。{name}摸着用了几十年的门框——就在这儿，慢慢来',
        effects: [{ attr: 'happiness', delta: 1 }],
        addTags: ['elder_home'],
      },
      {
        text: '搬去和子女一起住',
        summary: '热闹是真热闹，拘束也是真拘束。{name}收拾行李时忽然明白：从今往后，要学着当「家里的客人」了',
        effects: [
          { attr: 'happiness', delta: -1 },
          { relation: { kind: 'child', deltaCloseness: 2 } },
        ],
        addTags: ['elder_with_child'],
        requires: { relationKinds: ['child'] },
      },
      {
        text: '去养老院，不给孩子添负担',
        tooltip: '需 20 万积蓄保障，押金与安置 30,000 元',
        summary: '{name}自己相中的养老院，院子里有树。交押金那天手续办得干脆——这是{name}自己做的主，做得心安',
        effects: [
          { money: -30000 },
          { attr: 'stress', delta: -1 },
        ],
        addTags: ['elder_institution'],
        requires: { moneyAtLeast: 200000 },
      },
    ],
  },
  {
    id: 'elder_institution_life',
    category: 'life',
    title: '养老院的黄昏',
    text: '养老院的黄昏很长，长得够下一整盘棋。{name}搬来半年，院子里的规律摸清了：几点下棋、几点散步、几点听隔壁屋的老姐妹讲电视剧。',
    minAge: 62,
    maxAge: 75,
    cooldown: 4,
    weight: 10,
    requires: { tagsAny: ['elder_institution'] },
    choices: [
      {
        text: '棋友局，杀三盘',
        summary: '老周棋风稳，{name}棋风野，输赢参半，骂声不断——护工都习惯了。这半年的棋瘾，比过去十年加起来过得都足',
        effects: [{ attr: 'happiness', delta: 2 }],
      },
      {
        text: '想家了，就给家里打个电话',
        summary: '电话里什么正事都没说，翻来覆去就是「吃了吗」「都好」。挂了电话，{name}在院子里走了两圈，心里踏实了',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'elder_two_gen',
    category: 'life',
    title: '一屋两代',
    text: '和子女住的第 N 个月，磨合期比想象中长：酱油放哪儿、空调开几度、晚上几点熄灯——每件小事都是一道题。但也有另一面：饭桌，终于又坐满了。',
    minAge: 62,
    maxAge: 75,
    cooldown: 4,
    weight: 10,
    requires: { tagsAny: ['elder_with_child'] },
    choices: [
      {
        text: '为小事拌了两句嘴',
        summary: '起因是袜子，升级成习惯，收尾是一整天的冷战。晚上孩子端来一碗汤，{name}就着台阶下了——一家人，没有隔夜仇',
        effects: [
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'child', deltaCloseness: -1 } },
        ],
      },
      {
        text: '学着当「家里的客人」，也当自家人',
        summary: '{name}承包了晚饭后那顿水果，孩子周末张罗着带了老人下馆子。各有各的边界，也各有各的心疼',
        effects: [
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'child', deltaCloseness: 2 } },
        ],
      },
    ],
  },
  {
    id: 'elder_home_tweak',
    category: 'life',
    title: '家里的小改动',
    text: '在老窝养老，讲究的是「顺手」二字。{name}围着屋子转了一圈，记下几处别扭：门槛有点绊脚，起夜的路上有点黑。',
    minAge: 62,
    maxAge: 75,
    cooldown: 4,
    weight: 10,
    requires: { tagsAny: ['elder_home'] },
    choices: [
      {
        text: '装个扶手，添一盏夜灯',
        tooltip: '小额改造 800 元',
        summary: '扶手钉在马桶旁，感应夜灯亮在走廊。花小钱办大事——老窝更顺手了，日子更稳当了',
        effects: [
          { money: -800 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '都住熟了，习惯就好',
        summary: '{name}最后什么也没动。住了几十年的地方，闭着眼都能走——习惯，就是最好的改造',
        effects: [{ attr: 'stress', delta: -1 }],
      },
    ],
  },
]
