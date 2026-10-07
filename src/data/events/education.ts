// 第 8 轮：教育事件（6 个）
// 覆盖：升学成功（录取通知书）、失败（落榜之后）、转向（转专业/休学）、
// 成年后再次学习（自考/在职提升）、学生日常（社团与自习、学业倦怠）。
// 教育的系统性结算（高考放榜、毕业升学历、每年技能成长）在 engine/education.ts。
import type { GameEvent } from '../../engine/types'

export const EDUCATION_EVENTS: GameEvent[] = [
  {
    id: 'edu_admission_notice',
    category: 'education',
    title: '录取通知书',
    text: '快递员在楼下喊了好几遍。牛皮纸信封上印着校徽——是{name}的那份。同一间屋里，还躺着几张招聘传单。',
    minAge: 18,
    maxAge: 25,
    once: true,
    priority: 3,
    requires: { tagsAny: ['admitted_bachelor', 'admitted_college'] },
    choices: [
      {
        text: '收拾行李，去本科报到',
        tooltip: '四年学制，把学历变成真本事',
        summary: '{name}在校门口拍了张照片，发给了全家',
        effects: [
          { attr: 'happiness', delta: 4 },
          { attr: 'social', delta: 2 },
          { attr: 'stress', delta: -2 },
          { startEducation: { stage: 'bachelor' } },
        ],
        requires: { tagsAll: ['admitted_bachelor'] },
        addTags: ['college_life'],
      },
      {
        text: '收拾行李，去大专报到',
        tooltip: '三年学制，早毕业早立足',
        summary: '{name}在校门口拍了张照片，发给了全家',
        effects: [
          { attr: 'happiness', delta: 3 },
          { attr: 'social', delta: 2 },
          { startEducation: { stage: 'college' } },
        ],
        requires: { tagsAll: ['admitted_college'] },
        addTags: ['college_life'],
      },
      {
        text: '放弃升学，直接去工作',
        tooltip: '学历止步于此，但工龄从今天开始',
        summary: '{name}把通知书压进了抽屉底层，第二天去上了班',
        effects: [
          { attr: 'social', delta: 2 },
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: 2 },
        ],
        removeTags: ['admitted_bachelor', 'admitted_college', 'elite_school'],
        addTags: ['work_early'],
      },
    ],
  },
  {
    id: 'edu_first_year_crossroads',
    category: 'education',
    title: '社团还是自习室',
    text: '开学一个月，招新摊位从食堂门口排到操场。室友问{name}：晚上是一起去社团，还是照老规矩泡自习室？',
    minAge: 18,
    maxAge: 30,
    cooldown: 4,
    weight: 10,
    requires: { careerKinds: ['student'] },
    choices: [
      {
        text: '泡自习室，把专业课啃透',
        summary: '{name}的自习室座位有了固定的水渍印',
        effects: [
          { addSkill: { id: 'academics', delta: 5 } },
          { attr: 'stress', delta: 3 },
        ],
      },
      {
        text: '加两个社团，把日子过热闹',
        summary: '{name}学会了活动策划，通讯录厚了一倍',
        effects: [
          { addSkill: { id: 'vocational', delta: 2 } },
          { attr: 'social', delta: 4 },
          { attr: 'happiness', delta: 2 },
        ],
      },
      {
        text: '课余兼职，把生活费挣出来',
        tooltip: '钱和经验都有，就是更累',
        summary: '{name}在奶茶店站了一个学期的吧台',
        effects: [
          { money: 6000 },
          { addSkill: { id: 'vocational', delta: 3 } },
          { addSkill: { id: 'academics', delta: -2 } },
          { attr: 'stress', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'edu_mid_dropout_wobble',
    category: 'education',
    title: '读不下去的时候',
    text: '期中成绩出来了，几门课亮着刺眼的红。{name}盯着成绩单想：这条到底还走不走得下去？',
    minAge: 18,
    maxAge: 32,
    cooldown: 5,
    weight: 8,
    requires: { careerKinds: ['student'] },
    choices: [
      {
        text: '咬牙坚持下去',
        tooltip: '难，但不会后悔',
        summary: '{name}把红灯科目一门门补了回来',
        effects: [
          { attr: 'stress', delta: 4 },
          { attr: 'smarts', delta: 1 },
          { addSkill: { id: 'academics', delta: 3 } },
        ],
      },
      {
        text: '转专业，换条赛道',
        tooltip: '理论落下一点，换实操的方向',
        summary: '{name}的课表全换了，累但眼睛里有光',
        effects: [
          { addSkill: { id: 'vocational', delta: 6 } },
          { addSkill: { id: 'academics', delta: -2 } },
          { attr: 'stress', delta: 5 },
        ],
        addTags: ['switched_major'],
      },
      {
        text: '休学一年，先去打工',
        tooltip: '离开学校，但随时可以回来',
        summary: '{name}办了休学，工牌上的名字比学生证上的旧',
        effects: [
          { money: 5000 },
          { addSkill: { id: 'vocational', delta: 2 } },
          { attr: 'happiness', delta: 2 },
          { quitEducation: true },
        ],
        addTags: ['gap_year'],
      },
    ],
  },
  {
    id: 'edu_gaokao_failed_regroup',
    category: 'education',
    title: '落榜之后',
    text: '分数出来的那晚，{name}把查分页面开了又关。饭桌上没人提这件事，但所有人都知道：路还得接着走。',
    minAge: 18,
    maxAge: 23,
    // 不用 once：复读后再落榜（20、21 岁…）同样需要引导，冷却 1 年允许连败链每年触发
    cooldown: 1,
    priority: 2,
    requires: { tagsAll: ['gaokao_failed'] },
    choices: [
      {
        text: '再复读一年',
        tooltip: '再来一次，压力不小',
        summary: '{name}又回到了那张熟悉的书桌前',
        effects: [
          { attr: 'stress', delta: 5 },
          { money: -3000 },
          { startEducation: { stage: 'highschool', years: 1 } },
        ],
        removeTags: ['gaokao_failed'],
        addTags: ['gaokao_retry'],
      },
      {
        text: '进厂学门手艺',
        tooltip: '技能路线，从学徒干起',
        summary: '{name}的师傅说：手艺学到手，走遍天下都不怕',
        effects: [
          { addSkill: { id: 'vocational', delta: 6 } },
          { attr: 'social', delta: 2 },
          { money: 8000 },
        ],
        removeTags: ['gaokao_failed'],
        addTags: ['work_early'],
      },
      {
        text: '边打工边自学自考',
        tooltip: '辛苦，但学历和工龄都不丢',
        summary: '{name}的枕头边换成了自考教材',
        effects: [
          { addSkill: { id: 'academics', delta: 3 } },
          { attr: 'stress', delta: 4 },
          { money: 4000 },
        ],
        removeTags: ['gaokao_failed'],
        addTags: ['self_exam', 'work_early'],
      },
    ],
  },
  {
    id: 'edu_adult_selfexam',
    category: 'education',
    title: '成年后的自习室',
    text: '夜校招生简章贴在了小区公告栏，塑封膜被风掀起一角。下了晚班路过的{name}停下了脚。',
    minAge: 25,
    maxAge: 45,
    cooldown: 6,
    requires: { education: ['junior', 'highschool'], careerKinds: ['none', 'unemployed', 'employed'] },
    choices: [
      {
        text: '报自考大专，把学历补上',
        tooltip: '两年后拿证',
        summary: '{name}重新当回了学生，尽管只有夜里那两小时',
        effects: [
          { money: -4000 },
          { addSkill: { id: 'academics', delta: 2 } },
          { attr: 'stress', delta: 3 },
        ],
        delayed: [{ years: 2, education: 'college', summary: '自考大专的毕业证书寄到了家里' }],
        addTags: ['self_exam'],
      },
      {
        text: '只买网课和教材，自己啃',
        summary: '{name}的书包里常年装着一本翻旧的高数，通勤路上还多了几节录播',
        effects: [
          { money: -200 },
          { addSkill: { id: 'academics', delta: 3 } },
          { attr: 'stress', delta: 1 },
        ],
      },
      {
        text: '算了，下班只想躺着',
        summary: '{name}刷了半小时短视频，把那页简章从记忆里划掉了',
        effects: [
          { attr: 'happiness', delta: 1 },
          { addSkill: { id: 'academics', delta: -1 } },
        ],
      },
    ],
  },
  {
    id: 'edu_adult_upgrade',
    category: 'education',
    title: '要不要再读一点书',
    text: '同学群里有人晒出了研究生录取截图，有人劝{name}「这个年纪别折腾了」。夜里加完班，这道选择题突然变得很具体。',
    minAge: 25,
    maxAge: 48,
    cooldown: 6,
    requires: { education: ['college', 'bachelor', 'master'], careerKinds: ['none', 'unemployed', 'employed'] },
    choices: [
      {
        text: '在职考研，辞了工作去读',
        tooltip: '需要足够的学业功底',
        summary: '{name}在录取名单里找到了自己的名字',
        effects: [
          { money: -6000 },
          { attr: 'stress', delta: 6 },
          { startEducation: { stage: 'master' } },
        ],
        requires: { education: ['college', 'bachelor'], minSkills: { academics: 45 } },
        addTags: ['grad_school'],
      },
      {
        text: '破釜沉舟，申请读博',
        tooltip: '需要硕士学历和过硬的学术功底',
        summary: '{name}收到了导师的回信：欢迎来读',
        effects: [
          { attr: 'stress', delta: 8 },
          { attr: 'happiness', delta: -2 },
          { startEducation: { stage: 'phd' } },
        ],
        requires: { education: ['master'], minSkills: { academics: 60 } },
        addTags: ['phd_journey'],
      },
      {
        text: '报个职业资格班，考个硬证书',
        tooltip: '不换赛道，给手艺镀金',
        summary: '{name}的证书墙又多了一块，同行开始主动来问价',
        effects: [
          { money: -9000 },
          { addSkill: { id: 'vocational', delta: 8 } },
          { attr: 'stress', delta: 2 },
        ],
        addTags: ['certified'],
      },
      {
        text: '稳住现状，不再折腾',
        summary: '{name}关掉了招生页面，把时间还给了生活',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
    ],
  },
  // ── 第 63 轮：教育纵深——在职深造链（备考→录取→兑现）──────────────
  // 引擎侧学历收入修正已存在（computeSalary 按学历超出岗位门槛级数每级 +5%，
  // 年度结算按当前学历重推）——本链不新增第二套收入公式；「学历兑现」用事件层
  // salaryMul/promote 做一次性谈判出口。读研→读博共用链：硕士毕业后经既有
  // edu_adult_upgrade「破釜沉舟，申请读博」选项接续（requires master+academics 60）。
  {
    id: 'edu_exam_prep',
    category: 'education',
    title: '书桌上的第二盏灯',
    text: '下班的疲惫还没散，{name}把台灯拧亮了一档。桌上摊开的，是研究生考试的全套教材——白天卖给公司的时间，晚上要一点一点赎回来。',
    minAge: 24,
    maxAge: 45,
    cooldown: 4,
    weight: 9,
    requires: { education: ['college', 'bachelor', 'master'], careerKinds: ['employed'], tagsNone: ['exam_prep'] },
    choices: [
      {
        text: '报个周末冲刺班，系统备考',
        tooltip: '花钱买约束和节奏',
        summary: '{name}的周末被课程表填满，笔记越记越厚',
        effects: [
          { money: -3000 },
          { attr: 'stress', delta: 4 },
          { addSkill: { id: 'academics', delta: 3 } },
        ],
        addTags: ['exam_prep'],
      },
      {
        text: '买套教材自学，省下学费',
        summary: '{name}把通勤的地铁车厢变成了自习室',
        effects: [
          { money: -200 },
          { attr: 'stress', delta: 2 },
          { addSkill: { id: 'academics', delta: 2 } },
        ],
        addTags: ['exam_prep'],
      },
      {
        text: '今年先顾工作，备考下次再说',
        summary: '{name}合上教材，把它放回了书架最顺手的位置',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'edu_admit_master',
    category: 'education',
    title: '录取通知·成人版',
    text: '拟录取名单公示的那一刻，{name}把页面刷新了三遍——自己的名字真的在上面。这一次没有宿舍和开学典礼，只有一份要郑重签下的培养协议。',
    minAge: 24,
    maxAge: 48,
    cooldown: 4,
    priority: 2,
    weight: 10,
    requires: { tagsAll: ['exam_prep'], education: ['bachelor'], careerKinds: ['none', 'unemployed', 'employed'] },
    choices: [
      {
        text: '辞掉工作，全日制去读',
        tooltip: '两年学制，收入归零但心无旁骛',
        summary: '{name}办完离职手续，把工牌换成了学生证',
        effects: [
          { money: -6000 },
          { attr: 'stress', delta: 5 },
          { attr: 'happiness', delta: 3 },
          { startEducation: { stage: 'master' } },
        ],
        removeTags: ['exam_prep'],
        addTags: ['grad_school'],
      },
      {
        text: '婉拒名额，工作要紧',
        summary: '{name}在确认截止日的深夜关掉了页面，没跟任何人说',
        effects: [
          { attr: 'happiness', delta: -2 },
        ],
        removeTags: ['exam_prep'],
      },
    ],
  },
  {
    id: 'edu_degree_payoff',
    category: 'education',
    title: '文凭放到会议桌上',
    text: '年度评定表交上去之前，{name}把刚到手的学位证书复印了一份，夹进述职报告的封面。该让这些年熬过的灯，照见一点回响。',
    minAge: 24,
    maxAge: 70,
    cooldown: 8,
    weight: 9,
    requires: { tagsAny: ['graduated_master', 'graduated_phd'], careerKinds: ['employed'] },
    choices: [
      {
        text: '拿新学历谈一次加薪',
        tooltip: '一次性调薪，此后按新基数逐年重推',
        summary: '{name}的薪资单上多了一行「学历调整」，数字不大，但是自己谈来的',
        effects: [
          { salaryMul: 1.06 },
          { attr: 'social', delta: 2 },
          { attr: 'stress', delta: 2 },
        ],
      },
      {
        text: '申请晋升答辩，往上走一级',
        tooltip: '职级到顶时此项隐藏',
        summary: '{name}的述职获得了通过，新职级的工牌下个月发',
        effects: [
          { promote: true },
          { attr: 'stress', delta: 3 },
        ],
        requires: { promotionAvailable: true },
      },
      {
        text: '深藏功与名，把证书收进抽屉',
        summary: '证书压在了抽屉底层，和当年那张录取通知书叠在一起',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
    ],
  },
]
