// 第 12 轮：健康与生活方式事件
// 设计要点：每个事件都有"有代价的恢复机会"（花钱/断收成/关系代价）；
// 单步即时健康伤害 ≤ -6（HEALTH_SINGLE_HIT_LIMIT），大伤害走延迟并给预警窗口。
// 第 24 轮扩充（+5）：生活方式长因果的授予与兑现事件——
// 授予：hlt_drink_toast（长期饮酒）、hlt_desk_years（久坐）；
// 兑现：hlt_checkup_mild_flags（风险 25~49 轻度异常）、hlt_checkup_red_flags（风险 ≥50 亮红灯）、
// hlt_chronic_onset（62+ 且风险 ≥45 慢性病确诊）——资格读累积风险值而非仅年龄。
import type { GameEvent } from '../../engine/types'

export const HEALTH_EVENTS: GameEvent[] = [
  {
    id: 'hlt_late_night_spiral',
    category: 'health',
    title: '越刷越精神的深夜',
    text: '凌晨十二点半，{name}对自己说"就刷半小时"。屏幕的光照在脸上，时间以一种不体面的速度奔向两点。',
    minAge: 18,
    maxAge: 35,
    cooldown: 3,
    choices: [
      {
        text: '再刷一会儿，反正明天能补觉',
        tooltip: '快乐是真的，黑眼圈也是真的',
        summary: '{name}刷到凌晨三点，第二天顶着黑眼圈去上班',
        effects: [
          { attr: 'health', delta: -2 },
          { attr: 'happiness', delta: 3 },
        ],
        addTags: ['night_owl'],
      },
      {
        text: '把手机放到客厅充电，睡觉',
        summary: '{name}把手机留在了客厅，很久没这么快入睡了',
        effects: [
          { attr: 'health', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
      {
        text: '睡不着就起来看会儿书',
        summary: '{name}深夜里读了四十页书，困意来得刚刚好',
        effects: [
          { attr: 'smarts', delta: 2 },
          { attr: 'health', delta: -1 },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'hlt_night_owl_change',
    category: 'health',
    title: '黑眼圈在提醒你',
    text: '镜子里的人眼圈发青，爬三楼都喘。{name}忽然意识到，熬夜这件事已经从"偶尔"变成了"体质"。',
    minAge: 18,
    maxAge: 40,
    cooldown: 4,
    requires: { tagsAny: ['night_owl'] },
    choices: [
      {
        text: '循序渐进，把觉一点点睡回来',
        tooltip: '过程枯燥，但身体会领情',
        summary: '{name}花了大半年，终于把入睡时间从两点挪回十一点',
        effects: [
          { attr: 'health', delta: 2 },
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: -2 },
        ],
        removeTags: ['night_owl'],
      },
      {
        text: '干脆晨跑，用困意换多巴胺',
        tooltip: '买双跑鞋，把作息连着运动一起换掉',
        summary: '{name}现在六点半出现在公园，跑得慢，但每天都在',
        effects: [
          { money: -500 },
          { attr: 'health', delta: 3 },
          { attr: 'stress', delta: -2 },
        ],
        addTags: ['routine_exercise'],
        removeTags: ['night_owl'],
      },
      {
        text: '道理都懂，接着熬',
        summary: '{name}保存了那份《长期熬夜的危害》，然后继续熬夜',
        effects: [
          { attr: 'health', delta: -1 },
          { attr: 'happiness', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'hlt_overwork_warning',
    category: 'health',
    title: '身体先撑不住了',
    text: '连续加班的第二个月，{name}在工位上眼前一黑，扶着桌子才站稳。体检单上的箭头和心悸一起找上了门。',
    minAge: 25,
    maxAge: 55,
    cooldown: 5,
    requires: { careerKinds: ['employed'], minAttr: { stress: 60 } },
    choices: [
      {
        text: '把年假一次休完，彻底断联一周',
        tooltip: '损失一些收入和存在感，换来一次深呼吸',
        summary: '{name}关掉工作机一周，回来时脸色终于不像报表了',
        effects: [
          { money: -3000 },
          { attr: 'stress', delta: -15 },
          { attr: 'health', delta: 2 },
        ],
      },
      {
        text: '找领导谈，把节奏调下来',
        summary: '{name}据理力争，砍掉了三成的无效加班',
        effects: [
          { attr: 'stress', delta: -8 },
          { attr: 'smarts', delta: 1 },
        ],
      },
      {
        text: '项目要紧，扛过去再说',
        tooltip: '身体不是项目，延期没有缓冲期',
        summary: '{name}咬着牙扛完了项目，也把身体扛出了内伤',
        effects: [
          { attr: 'health', delta: -3 },
          { attr: 'stress', delta: 2 },
        ],
        delayed: [
          {
            years: 1,
            attr: 'health',
            delta: -2,
            addTags: ['chronic_pain'],
            summary: '那口没喘上来的气，最终落成了病根',
          },
        ],
      },
    ],
  },
  {
    id: 'hlt_gym_injury',
    category: 'health',
    title: '跑步膝',
    text: '坚持锻炼的第N周，{name}的膝盖在一次配速提升后肿了起来，下楼梯时每一步都在抗议。',
    minAge: 20,
    maxAge: 60,
    cooldown: 4,
    requires: { tagsAny: ['routine_exercise'] },
    choices: [
      {
        text: '去医院康复科，认真治',
        summary: '{name}做了两周康复理疗，医生说恢复得比想象中好',
        effects: [
          { money: -4000 },
          { attr: 'health', delta: 3 },
          { attr: 'stress', delta: -1 },
        ],
      },
      {
        text: '停练静养，等它自己好',
        summary: '{name}歇了两周，膝盖不肿了，人也懒了',
        effects: [
          { attr: 'health', delta: 1 },
          { attr: 'stress', delta: 2 },
        ],
      },
      {
        text: '贴块膏药，继续练',
        tooltip: '疼痛被按了静音，但没有消失',
        summary: '{name}贴着膏药跑完了当月跑量，膝盖在暗中记账',
        effects: [
          { money: -200 },
          { attr: 'health', delta: -2 },
        ],
        delayed: [
          {
            years: 1,
            attr: 'health',
            delta: -2,
            addTags: ['chronic_pain'],
            summary: '膝盖的旧账翻了出来，阴雨天隐隐作痛',
          },
        ],
      },
    ],
  },
  {
    id: 'hlt_partner_checkup',
    category: 'health',
    title: 'TA 把两个人的体检都约好了',
    text: '爱人在医院公众号上挂好了号，把两张体检单拍在桌上："别跟我讨价还价，我都交好钱了。周六早上，空腹。"这话不容拒绝，{name}心里却有点暖。',
    minAge: 28,
    maxAge: 70,
    cooldown: 6,
    requires: { relationKinds: ['spouse'] },
    choices: [
      {
        text: '一起去，加钱做个全面套餐',
        tooltip: '查得细，睡得香',
        summary: '{name}和爱人做完全套检查，两个人都拿到了安心的报告',
        effects: [
          { money: -8000 },
          { attr: 'health', delta: 4 },
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'spouse', deltaCloseness: 5 } },
        ],
        requires: { moneyAtLeast: 8000 },
      },
      {
        text: '按TA安排的基础套餐来',
        summary: '{name}陪爱人做完基础体检，常规项目一切正常',
        effects: [
          { money: -2000 },
          { attr: 'health', delta: 2 },
        ],
      },
      {
        text: '浪费这个钱干什么',
        summary: '{name}嘴上嫌贵，爱人沉默地把一张体检单收了回去',
        effects: [
          { attr: 'health', delta: -1 },
          { relation: { kind: 'spouse', deltaCloseness: -4 } },
        ],
      },
    ],
  },
  {
    id: 'hlt_old_body_maintenance',
    category: 'health',
    title: '老寒腿和保健品',
    text: '变天的时候膝盖先知道。电视购物在推销"祖传秘方"，社区医院在推销理疗年卡，公园里的老伙计在招呼快走——{name}得选一条路。',
    minAge: 55,
    maxAge: 80,
    cooldown: 4,
    choices: [
      {
        text: '办正规理疗年卡，按疗程来',
        tooltip: '头年五千，之后每年三千',
        summary: '{name}办了社区医院的理疗年卡，腿脚一年比一年听使唤',
        effects: [
          { money: -5000 },
          { attr: 'health', delta: 2 },
        ],
        delayed: [
          {
            years: 1,
            money: -3000,
            attr: 'health',
            delta: 2,
            repeat: 2,
            summary: '理疗又做了一年，效果实在',
          },
        ],
      },
      {
        text: '听直播间的，买一疗程秘方',
        tooltip: '便宜、热闹，就是成分成谜',
        summary: '{name}吃了三个月"秘方"，精神头没见涨，钱包先瘦了',
        effects: [
          { money: -3000 },
          { attr: 'happiness', delta: 1 },
          { attr: 'health', delta: 1 },
        ],
        delayed: [
          {
            years: 1,
            attr: 'health',
            delta: -1,
            summary: '秘方停了之后才明白，那些功效大半是心理作用',
          },
        ],
      },
      {
        text: '什么都不买，每天去公园快走',
        summary: '{name}加入了公园快走团，风雨无阻',
        effects: [
          { attr: 'health', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
        addTags: ['routine_exercise'],
      },
    ],
  },
  {
    id: 'hlt_body_intensive',
    category: 'health',
    title: '身体发出的最后通牒',
    text: '又一次在深夜心悸惊醒后，{name}盯着天花板到天亮。医生的话不重，但每个字都很沉："再这么下去，下次就不是预警了。"',
    minAge: 25,
    maxAge: 75,
    cooldown: 5,
    priority: 5,
    requires: { maxAttr: { health: 20 } },
    // 第 19 轮单选例外（全池唯一，测试锁定清单）：健康 ≤20 的强制剧情事件。
    // 待业+负债的组合会把它过滤到只剩"换一种活法"一个可见选项——但预警年志
    // 指向的干预出口不能在最需要它的人面前消失，单选语义在此依然成立
    //（免费换活法正是低收入者真实可走的路）。
    singleChoiceOk: true,
    choices: [
      {
        text: '听医生的，住院系统调理',
        tooltip: '花销不小，但这是最稳的一条路',
        summary: '{name}住了三周院，出院时各项指标终于回到安全线内',
        effects: [
          { money: -20000 },
          { attr: 'health', delta: 18 },
          { attr: 'stress', delta: 5 },
        ],
      },
      {
        text: '请长病假，回家慢慢养',
        tooltip: '收入打折，命保住了',
        summary: '{name}办了长病假，薪水打了对折，但睡了个把月的好觉',
        effects: [
          { salaryMul: 0.6 },
          { attr: 'health', delta: 10 },
          { attr: 'stress', delta: -20 },
          { attr: 'happiness', delta: 2 },
        ],
        requires: { careerKinds: ['employed'] },
      },
      {
        text: '不住院也不辞职，换一种活法',
        summary: '{name}戒了熬夜和烟，把日子过成了疗养院的样子',
        effects: [
          { attr: 'health', delta: 6 },
          { attr: 'stress', delta: -10 },
          { attr: 'happiness', delta: 3 },
        ],
        addTags: ['routine_exercise'],
        removeTags: ['night_owl', 'light_smoker'],
      },
    ],
  },
  {
    id: 'hlt_checkup_mild_flags',
    category: 'health',
    title: '体检单上的小箭头',
    text: '年度体检报告出来了：轻度脂肪肝，转氨酶偏高，还有几个向上小箭头。医生笔尖点了点纸面："还没到病，但再往下走一步就是了。{name}的生活习惯，医生隔着报告都看出来了。"',
    minAge: 35,
    maxAge: 58,
    once: true,
    weight: 12,
    priority: 1,
    requires: { healthRiskAtLeast: 25, healthRiskBelow: 50 },
    choices: [
      {
        text: '认真调理三个月，外卖和酒局都停了',
        summary: '{name}的厨房重新开了火，三个月后复查，小箭头消下去两个',
        effects: [{ money: -2000 }],
        delayed: [
          { years: 1, attr: 'health', delta: 3, summary: '清淡的三个月见了效，复查单好看多了' },
        ],
        removeTags: ['desk_bound'],
      },
      {
        text: '买点护肝片，接着熬',
        summary: '护肝片摆上了桌面，{name}的心态稳住了，作息纹丝没动',
        effects: [
          { money: -600 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '小箭头而已，谁还没几个',
        summary: '报告被压进了抽屉最底层，{name}偶尔想起，又觉得应该没事',
        effects: [{ attr: 'stress', delta: 1 }],
        delayed: [
          { years: 1, attr: 'health', delta: -2, summary: '被无视的小箭头，悄悄连成了一行' },
        ],
        addTags: ['avoided_doctor'],
      },
    ],
  },
  {
    id: 'hlt_checkup_red_flags',
    category: 'health',
    title: '满页的红字',
    text: '这一次的体检报告不再客气：整页的向上箭头，两项指标直接标红。医生把"生活方式"四个字圈了出来，笔压得很重："再不改，下一步就不是门诊，是病房。"',
    minAge: 48,
    maxAge: 64,
    once: true,
    weight: 12,
    priority: 2,
    requires: { healthRiskAtLeast: 50 },
    choices: [
      {
        text: '请长假住院，系统查个明白',
        tooltip: '花销不小，但这是最稳的一条路',
        summary: '{name}住了两周院，出院时那页红字终于淡了下去',
        effects: [
          { money: -15000 },
          { attr: 'health', delta: 2 },
        ],
        delayed: [
          { years: 1, attr: 'health', delta: 3, summary: '系统的调理给身体缓过来了一口气' },
        ],
        requires: { moneyAtLeast: 15000 },
      },
      {
        text: '酒局全推，烟也戒了，每天走一万步',
        tooltip: '难受几个月，换之后几十年',
        summary: '头一个月最难熬，{name}靠嗑瓜子和走路把瘾压了过去',
        effects: [
          { attr: 'stress', delta: 3 },
          { attr: 'happiness', delta: -2 },
        ],
        delayed: [
          { years: 1, attr: 'health', delta: 4, summary: '一年后的复查，医生第一次点了头' },
        ],
        removeTags: ['light_smoker', 'heavy_drinker', 'desk_bound'],
      },
      {
        text: '人到这岁数，该吃吃该喝喝',
        summary: '{name}把报告折了折垫了桌脚，饭照吃，酒照满',
        effects: [{ attr: 'happiness', delta: 2 }],
        delayed: [
          { years: 1, attr: 'health', delta: -5, summary: '标红的那两项，开始联手发力了' },
        ],
        addTags: ['avoided_doctor'],
      },
    ],
  },
  {
    id: 'hlt_drink_toast',
    category: 'health',
    title: '这杯不喝就是不给面子',
    text: '桌上的酒过三巡，前辈把杯子满上推了过来："年轻人，这点面子总要给吧？"满桌的眼睛都看着{name}，杯壁上的水珠一路往下淌。',
    minAge: 18,
    maxAge: 28,
    cooldown: 3,
    weight: 10,
    choices: [
      {
        text: '仰头干了，从此是自己人',
        summary: '{name}的杯子见底的那刻，桌上的气氛热了一度——酒量，也是要练的',
        effects: [
          { attr: 'social', delta: 3 },
          { attr: 'stress', delta: -2 },
          { attr: 'happiness', delta: 1 },
        ],
        addTags: ['heavy_drinker'],
      },
      {
        text: '抿一口意思意思',
        summary: '{name}嘴唇沾了沾杯沿，前辈笑着摇头，这页算是翻过去了',
        effects: [{ attr: 'social', delta: 1 }],
      },
      {
        text: '以茶代酒，把话说在明处',
        summary: '{name}举起茶杯说了句"我以茶代酒"，愣了几秒，桌上还是有人笑了',
        effects: [
          { attr: 'social', delta: -1 },
          { attr: 'stress', delta: -1 },
          { attr: 'happiness', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'hlt_desk_years',
    category: 'health',
    title: '工位上的第三年',
    text: '体检报告上多了两行小字：颈椎曲度变直，建议减少久坐。{name}看着屏幕右下角的时间——从坐下到现在，六个小时没起来过，外卖盒还在手边。',
    minAge: 22,
    maxAge: 34,
    cooldown: 4,
    weight: 10,
    choices: [
      {
        text: '习惯成自然，外卖上楼，一坐一天',
        summary: '{name}把"起来活动"的闹钟一个个划掉，椅子越坐越陷',
        effects: [
          { attr: 'stress', delta: -1 },
          { attr: 'happiness', delta: 1 },
        ],
        addTags: ['desk_bound'],
      },
      {
        text: '午休绕着园区走两圈',
        summary: '{name}把外卖换成了楼下食堂，午休的四十分钟归两条腿管',
        effects: [
          { attr: 'health', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
      {
        text: '咬牙换升降桌，每小时站一站',
        tooltip: '花点小钱，给老腰上个保险',
        summary: '升降桌装好的那天，{name}站着改完了方案，腰板直了不少',
        effects: [
          { money: -1200 },
          { attr: 'health', delta: 1 },
        ],
        removeTags: ['desk_bound'],
      },
    ],
  },
  {
    id: 'hlt_chronic_onset',
    category: 'health',
    title: '慢性病确诊那天',
    text: '社区医院的随访电话打到了家里：血压、血糖，两项都过了线，正式建档。年轻时候欠下的账，如今一笔一笔来了对账单——药要长期吃，嘴要长期管。',
    minAge: 62,
    maxAge: 77,
    once: true,
    weight: 12,
    priority: 2,
    requires: { healthRiskAtLeast: 45 },
    choices: [
      {
        text: '规范用药，按时复查',
        tooltip: '药费长期支出，但指标压得住',
        summary: '药盒按周分好了格，{name}把复查日期圈在了挂历上',
        effects: [
          { money: -2400 },
          { attr: 'health', delta: 1 },
        ],
        addTags: ['chronic_condition', 'chronic_managed'],
        delayed: [
          {
            years: 1,
            money: -2400,
            attr: 'health',
            delta: 1,
            repeat: 4,
            summary: '药没断过，指标被稳稳压在了线下',
          },
        ],
      },
      {
        text: '住一段院，把指标一口气压下去',
        tooltip: '花销不小，但这是最稳的一条路',
        summary: '出院那天，护士站叫住了{name}："大爷，这回可要按时吃药了。"',
        effects: [
          { money: -12000 },
          { attr: 'health', delta: 3 },
        ],
        addTags: ['chronic_condition', 'chronic_managed'],
        requires: { moneyAtLeast: 12000 },
      },
      {
        text: '是药三分毒，能省则省',
        summary: '药盒在抽屉里落了灰，{name}觉得身体的事，身体自己会商量',
        effects: [{ attr: 'happiness', delta: 1 }],
        addTags: ['chronic_condition'],
        delayed: [
          { years: 1, attr: 'health', delta: -4, summary: '没管住的指标，开始一件一件讨债' },
        ],
      },
    ],
  },
  // ── 第 43 轮：慢病复查（managed 刷新线）——患病不是终点，是长期管理状态；
  //    按时复查/遵医嘱刷新 chronic_managed（2 年有效，年度结算到期即失访失控）；
  //    「先缓缓」选项是真实的失控路径（不授 managed，风险增速吃失控档）。
  {
    id: 'hlt_chronic_checkup',
    category: 'health',
    title: '复查的日子',
    text: '挂历上圈着的复查日到了。清晨的医院，抽血窗口前排着队，{name}攥着缴费单，心里有点像等着批改作业的学生。',
    minAge: 62,
    maxAge: 77,
    cooldown: 2,
    weight: 12,
    priority: 1,
    requires: { tagsAll: ['chronic_condition'] },
    choices: [
      {
        text: '抽血化验，按医嘱调药',
        tooltip: '指标平稳，大夫点头',
        summary: '指标压在了线下，大夫把药量的「减半」两个字圈了出来',
        effects: [
          { money: -800 },
          { attr: 'health', delta: 1 },
        ],
        addTags: ['chronic_managed'],
      },
      {
        text: '血压计自己量，网上复购续方',
        tooltip: '会管理的人，把医院装进手机里',
        summary: '{name}的血压记录表做得比病历本还工整',
        effects: [
          { money: -300 },
          { attr: 'smarts', delta: 1 },
        ],
        addTags: ['chronic_managed'],
      },
      {
        text: '最近感觉还好，先缓缓',
        summary: '{name}想了想，把挂号单退了',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  // ── 第 43 轮：并发症（失控恶化线）——资格读累积风险值（≥58，确诊线 45 之上）：
  //    失控增速快更早触发，控制良好线更晚乃至终生不触发；cd3 允许反复恶化。
  //    负债时 15000/2500 中 2500 与零成本出口保持 ≥2 可见。
  {
    id: 'hlt_chronic_flare',
    category: 'health',
    title: '并发症来了',
    text: '脚上的小口子两个星期不收口，看东西也开始发糊。医生把化验单推过来，一个一个箭头指给{name}看：再这么下去，就要出大问题了。',
    minAge: 62,
    maxAge: 77,
    cooldown: 3,
    weight: 14,
    priority: 3,
    requires: { tagsAll: ['chronic_condition'], healthRiskAtLeast: 58 },
    choices: [
      {
        text: '住院，系统调理一次',
        tooltip: '花销不小，但这是最稳的一条路',
        summary: '两周住院，出院时医生的话写满了两页纸',
        effects: [
          { money: -15000 },
          { attr: 'health', delta: 2 },
        ],
        addTags: ['chronic_managed'],
        requires: { moneyAtLeast: 15000 },
      },
      {
        text: '门诊加药，把嘴管住',
        summary: '药单加了两行，餐桌上的规矩多了三条',
        effects: [
          { money: -2500 },
          { attr: 'health', delta: 1 },
        ],
        addTags: ['chronic_managed'],
      },
      {
        text: '药吃完了，就没再去开',
        summary: '{name}把药盒收进了抽屉最深处',
        effects: [
          { attr: 'health', delta: -5 },
          { attr: 'stress', delta: 3 },
        ],
      },
    ],
  },
  {
    // 死亡窄门·意外向（第 112 轮）：lethal 首批两枚之一。年检散列门 3%（独立盐），
    // risk_taker 性格才入卡；A 选项=事件直接致死（lethal 效果+lethal_struck 标记），
    // 千局 death_young 的主通道。文案克制：不渲染血腥，只写那个来不及反应的瞬间。
    id: 'hlt_accident_blink',
    category: 'health',
    title: '那一眨眼的工夫',
    text: '下坡的路灯坏了很多年，{name}早已习惯了摸黑抄近道。那天傍晚的风很大，谁也没想到，意外和晚风是一起到的——它快得没有给任何思考留时间。',
    minAge: 18,
    maxAge: 35,
    once: true,
    weight: 12,
    requires: { tagsAny: ['risk_taker'], accidentRisk: true },
    choices: [
      {
        text: '那个瞬间，终究没能躲开',
        tooltip: '命运的窄门：这一步之后没有下一步',
        summary: '后来人们说起那天，都只记得风很大。{name}的故事，停在了那个来不及眨眼的傍晚',
        effects: [{ lethal: true }],
      },
      {
        text: '千钧一发——死死抓住了护栏',
        summary: '{name}在护栏边站了很久，手心全是汗。回家路上买了两斤橘子，像刚从很远的地方回来',
        effects: [
          { attr: 'health', delta: -4 },
          { attr: 'stress', delta: 2 },
        ],
      },
    ],
  },
  {
    // 死亡窄门·急病向（第 112 轮）：lethal 首批两枚之二。年检散列门 3%（独立盐），
    // 且要求健康 ≤45（身体真的已经亮过灯）。硬扛=lethal；静养零花费保证贫困局
    // 恒有 ≥2 个可见选项（致命抉择不得只属于付得起钱的人）。
    id: 'hlt_verge_fever',
    category: 'health',
    title: '高烧不退的那一周',
    text: '烧到第三天，{name}已经分不清天花板的花纹是真实的还是想出来的。体检报告压在枕头底下，上面几个箭头，每一个都朝着不好的方向。身体在用最后的方式把话挑明：它撑不住了。',
    minAge: 30,
    maxAge: 50,
    once: true,
    weight: 12,
    requires: { illnessRisk: true, maxAttr: { health: 45 } },
    choices: [
      {
        text: '吃片退烧药，硬扛过去',
        tooltip: '命运的窄门：这一步之后没有下一步',
        summary: '药片压不住身体里翻涌的旧账。那一周之后，{name}的故事只剩别人转述的版本',
        effects: [{ lethal: true }],
      },
      {
        text: '把一切放下，回家静养',
        summary: '{name}请了长假，关掉闹钟，睡了这些年最沉的几觉。身体没有骗人，好在还来得及',
        effects: [
          { attr: 'health', delta: 3 },
          { attr: 'stress', delta: -2 },
        ],
      },
      {
        text: '住院，从头到尾查一遍',
        tooltip: '20,000 元；最稳的一条路',
        summary: '两周的系统检查换来一沓正常单子和一句「还好来得早」。{name}把复查提醒设成了每年两次',
        effects: [
          { money: -20000 },
          { attr: 'health', delta: 8 },
          { attr: 'stress', delta: 3 },
        ],
      },
    ],
  },
]
