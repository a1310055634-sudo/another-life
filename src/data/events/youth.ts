// 第 14 轮：青年内容扩充（18～30 岁，17 个独立事件）
// 主题覆盖：离家（city_or_hometown / rent_storm / holiday_dilemma）、
// 求学（exchange_quota / study_abroad / exam_winter）、
// 工作起步（overtime_culture / first_project / night_shift_gig / resign_impulse /
// college_jobfair——大专毕业生专属补强入口，修复第 9 轮留档的"秋招对大专单薄"缺口）、
// 朋友（friend_startup / group_dinner / basketball_court）、
// 理想与现实（dream_vs_job / vanity_phone / county_offer）。
// 其中 9 个事件带背景、技能、状态、财务或历史标记条件（rent_storm / exchange_quota /
// study_abroad / exam_winter / overtime_culture / first_project / night_shift_gig /
// resign_impulse / college_jobfair），选项级条件另见 holiday_dilemma、study_abroad、resign_impulse。
// 本轮新增的关键标记：go_big_city / stay_hometown / exchanged / grinder /
// mentor_bond / biz_partner / dream_kept / dream_bloom（供第 15/16 轮中年、晚年事件与成就引用）。
import type { GameEvent } from '../../engine/types'

export const YOUTH_EVENTS: GameEvent[] = [
  // ─── 离家 ───────────────────────────────────────────────
  {
    id: 'youth_city_or_hometown',
    category: 'life',
    title: '车票的目的地',
    text: '购票软件停在两趟车之间：一趟开往一千公里外的大城市，一趟三十分钟就到老家县城。{name}的手指悬在屏幕上方——去哪里，往后几年就都是哪里。',
    minAge: 18,
    maxAge: 26,
    once: true,
    priority: 1,
    choices: [
      {
        text: '去大城市，挤也要挤进去',
        tooltip: '搬迁是一大笔开销，机会也在那里',
        summary: '{name}拖着行李箱站上了跨城高铁，出租屋很小，天很大',
        effects: [
          { money: -8000 },
          { attr: 'social', delta: 2 },
          { attr: 'stress', delta: 4 },
          { attr: 'happiness', delta: 1 },
        ],
        addTags: ['go_big_city'],
      },
      {
        text: '留在家乡，离父母近一点',
        tooltip: '安稳、省钱，但天花板也低',
        summary: '{name}留在了熟悉的街道上，晚饭桌上多了一个人',
        effects: [
          { money: 6000 },
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'parent', deltaCloseness: 6 } },
        ],
        addTags: ['stay_hometown'],
      },
      {
        text: '先去闯两年，不行就回来',
        summary: '{name}给自己定了两年之期，把退路留在了身后也留在了心里',
        effects: [
          { money: -5000 },
          { attr: 'stress', delta: 3 },
          { attr: 'smarts', delta: 1 },
        ],
        addTags: ['go_big_city'],
      },
    ],
  },
  {
    id: 'youth_rent_storm',
    category: 'money',
    title: '涨房租的通知',
    text: '租客群里弹出房东的消息：下季度起，房租上涨。{name}盯着屏幕算了算，涨出来的钱正好是一个月伙食费。',
    minAge: 22,
    maxAge: 30,
    cooldown: 4,
    // 只有搬出来住的人才会遇到私人房东涨租：住家里没有房租，宿舍不归自己谈
    requires: { tagsAny: ['independent_living'] },
    choices: [
      {
        text: '咬牙接受，搬家更折腾',
        summary: '{name}回了个"好的房东"，为熟悉的路段和十五分钟通勤买了单',
        effects: [
          { money: -6000 },
          { attr: 'stress', delta: 2 },
        ],
      },
      {
        text: '搬到更远的郊区去',
        tooltip: '省下房租，付出通勤',
        summary: '{name}搬到了地铁终点站附近，每天多出一个小时在路上',
        effects: [
          { money: -2000 },
          { attr: 'stress', delta: 3 },
          { attr: 'health', delta: -1 },
          { attr: 'happiness', delta: -2 },
        ],
      },
      {
        text: '找个室友合租分摊',
        summary: '{name}在网上发了合租帖，一周后客厅多了一个人和一堆快递',
        effects: [
          { money: -3000 },
          { attr: 'social', delta: 3 },
          { attr: 'happiness', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'youth_holiday_dilemma',
    category: 'relationship',
    title: '春节的抢票页面',
    text: '腊月的抢票页面转着圈，母亲的语音躺在微信里："今年回来过年吗？"可公司年后的项目正好缺人，加班费是平时的三倍。',
    minAge: 20,
    maxAge: 30,
    cooldown: 3,
    choices: [
      {
        text: '回家，年只有父母能一起过',
        summary: '{name}挤上了回家的车，行李箱里塞满了给爸妈的东西',
        effects: [
          { money: -1500 },
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'parent', deltaCloseness: 6 } },
        ],
      },
      {
        text: '留城值班，三倍工资要紧',
        summary: '{name}在空荡荡的办公楼里吃了年夜饭外卖，视频里给爸妈拜了年',
        effects: [
          { money: 6000 },
          { attr: 'stress', delta: 3 },
          { attr: 'happiness', delta: -1 },
          { relation: { kind: 'parent', deltaCloseness: -4 } },
        ],
      },
      {
        text: '把父母接来城里过年',
        tooltip: '需要 5,000 元安排住宿与年货',
        summary: '{name}带爸妈逛了商场看了夜景，母亲把酒店的拖鞋悄悄收进了行李',
        requires: { moneyAtLeast: 5000 },
        effects: [
          { money: -5000 },
          { attr: 'happiness', delta: 2 },
          { attr: 'smarts', delta: 1 },
          { relation: { kind: 'parent', deltaCloseness: 8 } },
        ],
      },
    ],
  },

  // ─── 求学 ───────────────────────────────────────────────
  {
    id: 'youth_exchange_quota',
    category: 'education',
    title: '交换生的名额',
    text: '系里公示了一个外校交流名额，学费自理、学分互认。辅导员在名单后写了句"择优推荐"，{name}的绩点刚好够得着。',
    minAge: 18,
    maxAge: 24,
    once: true,
    // 在读学生专属；交流学习要求一定的学业功底，学业太差拿不到推荐
    requires: { studentStages: ['highschool', 'college', 'bachelor', 'master'], minSkills: { academics: 40 } },
    choices: [
      {
        text: '申请去交流，见见更大的世界',
        tooltip: '开销不小，见识与履历都是实打实的',
        summary: '{name}背着书包去了新的城市，笔记本上盖了三个图书馆的章',
        effects: [
          { money: -6000 },
          { attr: 'smarts', delta: 4 },
          { attr: 'social', delta: 3 },
          { attr: 'stress', delta: 3 },
        ],
        addTags: ['exchanged'],
      },
      {
        text: '把名额让给要好的同学',
        summary: '{name}把机会让了出去，从此异地多了一个随时视频的人',
        effects: [
          { attr: 'social', delta: 4 },
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'friend', deltaCloseness: 5 } },
        ],
      },
      {
        text: '不去，专注眼前的课程',
        summary: '{name}把公示栏的照片拍了下来又删掉，转身回了自习室',
        effects: [
          { addSkill: { id: 'academics', delta: 3 } },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'youth_study_abroad',
    category: 'education',
    title: '留学的计算题',
    text: '中介的朋友圈刷了半年，offer 与学费一起摆在天平两端。本科毕业证刚到手，{name}在"出去"和"留下"之间反复横跳。',
    minAge: 22,
    maxAge: 28,
    once: true,
    // 仅本科毕业生可触发：留学读硕恰好满足 enterEducation 的前置学历校验；
    // 硕士/博士在读或已持有者会被"无意义重读"守卫静默拒绝（钱照扣），故不放行
    requires: { education: ['bachelor'] },
    choices: [
      {
        text: '全额自费，出去读硕士',
        tooltip: '需要 100,000 元存款撑住第一年',
        summary: '{name}在异国的课堂里重新做起了小组作业，口音里多了点新的腔调',
        requires: { moneyAtLeast: 100000 },
        effects: [
          { money: -100000 },
          { attr: 'smarts', delta: 4 },
          { attr: 'stress', delta: 4 },
          { attr: 'social', delta: 2 },
          { startEducation: { stage: 'master' } },
        ],
        addTags: ['studied_abroad'],
      },
      {
        text: '申请奖学金，半奖也去',
        tooltip: '先交占位费，奖学金一年后批复',
        summary: '{name}交了占位费办了签证，把奖学金申请书写了十一稿',
        requires: { moneyAtLeast: 40000 },
        effects: [
          { money: -40000 },
          { attr: 'stress', delta: 3 },
          { attr: 'smarts', delta: 2 },
          { startEducation: { stage: 'master' } },
        ],
        delayed: [
          { years: 1, money: 60000, summary: '奖学金批复到账，半年的房租有了着落' },
        ],
        addTags: ['studied_abroad'],
      },
      {
        text: '算了，先把眼前的路走稳',
        summary: '{name}关掉了中介的聊天窗口，把"留学"从搜索记录里删了',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: -2 },
        ],
      },
    ],
  },
  {
    id: 'youth_exam_winter',
    category: 'education',
    title: '备考的寒冬',
    text: '期末和资格证书考试挤在同一个十二月。图书馆的暖气很足，{name}的复习计划表却越画越乱——身体、分数和睡眠，只能挑两样。',
    minAge: 18,
    maxAge: 28,
    cooldown: 3,
    // 在读学生专属：期末+证书季的取舍
    requires: { studentStages: ['highschool', 'college', 'bachelor', 'master', 'phd'] },
    choices: [
      {
        text: '连熬一周通宵，把分冲上去',
        summary: '{name}在自习室度过了七个凌晨，交卷铃响时眼前发黑',
        effects: [
          { addSkill: { id: 'academics', delta: 4 } },
          { attr: 'health', delta: -4 },
          { attr: 'stress', delta: 5 },
        ],
      },
      {
        text: '规律作息，能拿多少拿多少',
        summary: '{name}十一点准时睡觉，成绩单不惊艳，但每科都稳稳过线',
        effects: [
          { addSkill: { id: 'academics', delta: 2 } },
          { attr: 'stress', delta: 1 },
        ],
      },
      {
        text: '放弃证书，先保住身体',
        summary: '{name}合上证书教材，去操场跑了三圈，天冷得很干净',
        effects: [
          { addSkill: { id: 'academics', delta: -1 } },
          { attr: 'health', delta: 2 },
          { attr: 'stress', delta: -3 },
          { attr: 'happiness', delta: 1 },
        ],
      },
    ],
  },

  // ─── 工作起步 ───────────────────────────────────────────
  {
    id: 'youth_overtime_culture',
    category: 'career',
    title: '晚八点的办公室',
    text: '晚上八点，工位上的灯还亮着一半。工作群里，组长"顺口"发了一句"年轻人嘛，多干点不吃亏"，后面缀着个@所有人。{name}看着屏幕右下角的时间，做了个决定。',
    minAge: 20,
    maxAge: 30,
    cooldown: 3,
    // 在职专属：加班文化只属于上班族
    requires: { careerKinds: ['employed'] },
    choices: [
      {
        text: '卷起来，加班费和好感都要',
        summary: '{name}把工位坐成了部门最晚熄的灯，月底工资条厚了一截',
        effects: [
          { money: 3000 },
          { attr: 'health', delta: -3 },
          { attr: 'stress', delta: 4 },
        ],
        addTags: ['grinder'],
      },
      {
        text: '到点就走，效率说话',
        summary: '{name}六点半准时合上电脑，用白天的进度堵住了所有的闲话',
        effects: [
          { attr: 'happiness', delta: 3 },
          { attr: 'stress', delta: -2 },
          { attr: 'social', delta: -1 },
        ],
      },
      {
        text: '找组长谈流程，砍掉无效会议',
        summary: '{name}把会议记录整理成一页纸拍在桌上，会后真砍掉了两个周会',
        effects: [
          { money: 1500 },
          { attr: 'smarts', delta: 2 },
          { attr: 'happiness', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'youth_first_project',
    category: 'career',
    title: '第一次独当一面',
    text: '领导把一个不大不小的项目推到{name}面前："你来牵头，做砸了我兜着。"同事们的目光扫过来，这是机会，也是考卷。',
    minAge: 20,
    maxAge: 30,
    // "第一次"牵头只有一次（第 19 轮重复清点：cooldown 重播与标题矛盾）
    once: true,
    requires: { careerKinds: ['employed'] },
    choices: [
      {
        text: '自己扛下来，通宵也要做完',
        summary: '{name}把项目一页一页啃了下来，结项那天的汇报赢得了整间会议室的点头',
        effects: [
          { money: 4000 },
          { attr: 'smarts', delta: 3 },
          { attr: 'stress', delta: 4 },
          { attr: 'health', delta: -1 },
        ],
      },
      {
        text: '请教老前辈，带着小团队一起干',
        tooltip: '前辈的经验是最快的捷径',
        summary: '{name}端着咖啡在老张工位旁赖了一个星期，项目提前一周收官',
        effects: [
          { money: 2000 },
          { attr: 'social', delta: 3 },
          { relation: { kind: 'friend', deltaCloseness: 2 } },
        ],
        addTags: ['mentor_bond'],
      },
      {
        text: '按部就班，不求有功但求无过',
        summary: '{name}把任务拆成清单逐项打勾，项目平稳落地，波澜不惊',
        effects: [
          { attr: 'smarts', delta: 1 },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'youth_night_shift_gig',
    category: 'money',
    title: '深夜的外卖箱',
    text: '手机弹出平台推送：雨夜订单补贴翻倍。{name}看着账户余额，又看了看窗外的雨——那辆共享单车仿佛在冲自己招手。',
    minAge: 18,
    maxAge: 30,
    cooldown: 3,
    // 定位是"手头紧的人"的救急选项：积蓄宽裕的人刷到这种推送只会划掉
    requires: { moneyBelow: 30000 },
    choices: [
      {
        text: '这个月天天跑，雨夜补贴吃满',
        summary: '{name}的雨衣滴了一整月的水，账户数字涨了，体重秤数字掉了',
        effects: [
          { money: 9000 },
          { attr: 'health', delta: -4 },
          { attr: 'stress', delta: 3 },
        ],
      },
      {
        text: '只在周末跑，见好就收',
        summary: '{name}周六晚上出门跑单，周日早上睡到自然醒，两头都没耽误',
        effects: [
          { money: 4000 },
          { attr: 'health', delta: -1 },
          { attr: 'stress', delta: 1 },
        ],
      },
      {
        text: '不跑了，睡个整觉',
        summary: '{name}把推送划掉，关了灯。钱是挣不完的，觉睡一晚少一晚',
        effects: [
          { attr: 'health', delta: 1 },
          { attr: 'happiness', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'youth_resign_impulse',
    category: 'career',
    title: '辞职信在抽屉里',
    text: '那封辞职信在草稿箱里躺了三周，{name}每天打开又关上。地铁门开合之间，"再忍忍"和"现在就辞"在心里换了二十个来回。',
    minAge: 21,
    maxAge: 30,
    cooldown: 3,
    // 在职+高压力专属：压力不到临界的人不会盯着辞职信发呆
    requires: { careerKinds: ['employed'], minAttr: { stress: 55 } },
    choices: [
      {
        text: '裸辞，世界很大先去看看',
        tooltip: '收入中断，但天亮得快',
        summary: '{name}按下了发送键，走出大楼时阳光晃得睁不开眼',
        effects: [
          { quitJob: true },
          { attr: 'happiness', delta: 4 },
          { attr: 'stress', delta: -6 },
        ],
      },
      {
        text: '忍住，骑驴找马悄悄投简历',
        summary: '{name}把辞职信锁回了抽屉，午休时在楼梯间接完了第三个面试电话',
        effects: [
          { attr: 'stress', delta: 2 },
          { attr: 'smarts', delta: 1 },
        ],
        addTags: ['job_hunting'],
      },
      {
        text: '找领导谈调岗，减薪换清闲',
        tooltip: '需要较好的口才与人缘（交际 ≥55）',
        summary: '{name}和领导聊了两个小时，调去了清闲的部门，工资条瘦了但眉头舒展了',
        requires: { minAttr: { social: 55 } },
        effects: [
          { salaryMul: 0.9 },
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: -3 },
        ],
      },
    ],
  },

  {
    id: 'youth_college_jobfair',
    category: 'career',
    title: '双选会角落的展位',
    text: '职校的双选会办在体育馆，热门展位前围了三层人，角落里几家本地企业的展架安静地立着。{name}攥着简历，在角落的展位前停了下来。',
    minAge: 20,
    maxAge: 30,
    once: true,
    priority: 2,
    weight: 12,
    // 大专毕业生专属补强入口（第 9 轮留档：普通秋招对大专只有护理/空窗两条路）。
    // education 精确匹配 ['college']，本科及以上不会被本事件重复服务。
    requires: {
      careerKinds: ['none', 'unemployed'],
      education: ['college'],
    },
    choices: [
      {
        text: '去本地公司做行政文员',
        tooltip: '需要学业功底 ≥35',
        summary: '{name}的工牌上印着新公司的名字，报表从此填得飞快',
        requires: { minSkills: { academics: 35 } },
        effects: [
          { attr: 'stress', delta: 2 },
          { attr: 'social', delta: 2 },
          { startJob: { jobId: 'office_clerk' } },
        ],
      },
      {
        text: '考下电工证，跟师傅进厂',
        tooltip: '需要职业技能 ≥45',
        summary: '{name}的工具包从此不离身，厂里的配电图闭着眼都能画',
        requires: { minSkills: { vocational: 45 } },
        effects: [
          { attr: 'stress', delta: 1 },
          { attr: 'health', delta: -1 },
          { attr: 'smarts', delta: 1 },
          { startJob: { jobId: 'electrician' } },
        ],
      },
      {
        text: '先进仓储干着，边干边看',
        tooltip: '需要职业技能 ≥25，门槛最低',
        summary: '{name}把手持终端用出了残影，货架编号倒背如流',
        requires: { minSkills: { vocational: 25 } },
        effects: [
          { attr: 'stress', delta: 1 },
          { attr: 'health', delta: -1 },
          { startJob: { jobId: 'warehouse_keeper' } },
        ],
      },
      {
        text: '简历还得再改改，先缓一缓',
        summary: '{name}把简历改到深夜，把下一场招聘会的日子圈在了日历上',
        effects: [
          { attr: 'smarts', delta: 1 },
          { attr: 'stress', delta: 1 },
        ],
        addTags: ['job_hunting'],
      },
    ],
  },

  // ─── 朋友 ───────────────────────────────────────────────
  {
    id: 'youth_friend_startup',
    category: 'money',
    title: '发小的合伙电话',
    text: '发小在电话里讲得眉飞色舞：社区团购驿站，铺面都看好了，就差最后一笔钱。"你不是一起干吗？利润四六开！"',
    minAge: 21,
    maxAge: 30,
    once: true,
    choices: [
      {
        text: '入伙，钱一起出事一起扛',
        tooltip: '投入 20,000 元，两年后见分红',
        summary: '{name}周末都泡在了驿站里，扫码枪的声音听久了竟有点上头',
        effects: [
          { money: -20000 },
          { attr: 'social', delta: 2 },
          { attr: 'stress', delta: 3 },
        ],
        delayed: [
          { years: 2, money: 8000, summary: '驿站熬过了头一年，第一次分红到账' },
        ],
        addTags: ['biz_partner'],
      },
      {
        text: '只出钱不出力，算我一份股',
        tooltip: '投入 10,000 元，坐等分红',
        summary: '{name}转了钱没掺和经营，只在朋友圈给驿站的广告点赞',
        effects: [
          { money: -10000 },
          { relation: { kind: 'friend', deltaCloseness: 3 } },
        ],
        delayed: [
          { years: 2, money: 4000, summary: '发小如约分来红利，附赠一箱橙子' },
        ],
      },
      {
        text: '婉拒：钱要留着自己用',
        summary: '{name}说了三遍"下次一定"，电话那头的热情淡了下去',
        effects: [
          { attr: 'stress', delta: -1 },
          { relation: { kind: 'friend', deltaCloseness: -5 } },
        ],
      },
    ],
  },
  {
    id: 'youth_group_dinner',
    category: 'relationship',
    title: '群里的聚会接龙',
    text: '大学毕业群的接龙又刷了一屏："周六老地方，AA。"去的人一半叫得出名，一半只存在于点赞列表里。{name}盯着接龙按钮。',
    minAge: 20,
    maxAge: 30,
    cooldown: 3,
    choices: [
      {
        text: '主动张罗，把局攒起来',
        summary: '{name}订了包间排了座位，散场时一群人勾着肩喊了下一次',
        effects: [
          { money: -1500 },
          { attr: 'social', delta: 4 },
          { attr: 'stress', delta: 2 },
        ],
      },
      {
        text: '跟着接龙，人到就好',
        summary: '{name}在饭桌上笑了一晚上，回家路上觉得这钱花得还行',
        effects: [
          { money: -800 },
          { attr: 'social', delta: 2 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '装没看见，省下这笔钱',
        summary: '{name}把群设了免打扰，周六晚上睡得格外踏实',
        effects: [
          { attr: 'social', delta: -2 },
          { attr: 'happiness', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'youth_basketball_court',
    category: 'life',
    title: '楼下的篮球场',
    text: '晚上九点，楼下球场差一个人，穿球衣的大叔冲{name}喊："哥们儿，来一个？"球在地板上弹着，像在催。',
    minAge: 18,
    maxAge: 28,
    cooldown: 4,
    choices: [
      {
        text: '上场，从此每周都来',
        summary: '{name}成了固定首发，球场上的外号比本名叫得还响',
        effects: [
          { attr: 'health', delta: 3 },
          { attr: 'social', delta: 4 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'friend', add: true } },
        ],
      },
      {
        text: '今天打一场，以后随缘',
        summary: '{name}出了一身汗，回家路上决定下周……再说吧',
        effects: [
          { attr: 'health', delta: 1 },
          { attr: 'social', delta: 1 },
        ],
      },
      {
        text: '摆摆手走人，回家躺着',
        summary: '{name}戴上耳机上了楼，球场上少了一个人也没人在意',
        effects: [
          { attr: 'health', delta: -1 },
          { attr: 'happiness', delta: -1 },
        ],
      },
    ],
  },

  // ─── 理想与现实 ─────────────────────────────────────────
  {
    id: 'youth_dream_vs_job',
    category: 'life',
    title: '画室的钥匙',
    text: '整理旧物时，高中画室的钥匙扣掉了出来。那年{name}的素描贴满了后墙，后来画板让给了行李箱。房东周五发来消息：楼下的画室在招会员。',
    minAge: 19,
    maxAge: 28,
    once: true,
    choices: [
      {
        text: '辞掉手头的事，全职去学画',
        tooltip: '把人生押给热爱',
        summary: '{name}把画架支在了出租屋正中央，颜料味盖过了泡面味',
        effects: [
          { quitJob: true },
          { money: -8000 },
          { attr: 'happiness', delta: 6 },
          { attr: 'stress', delta: 3 },
          { attr: 'smarts', delta: 2 },
        ],
        addTags: ['artist_path'],
      },
      {
        text: '周末去画室，把热爱养在业余',
        tooltip: '三年后看看会不会开花',
        summary: '{name}的周末有了固定的去处，速写本换到了第三本',
        effects: [
          { money: -3000 },
          { attr: 'happiness', delta: 3 },
          { attr: 'stress', delta: 1 },
        ],
        delayed: [
          {
            years: 3,
            addTags: ['dream_bloom'],
            attr: 'social',
            delta: 3,
            summary: '{name}的画入选了青年画展，展签上印着自己的名字',
          },
        ],
        addTags: ['dream_kept'],
      },
      {
        text: '把钥匙扣收进盒子，别做梦了',
        summary: '{name}把盒子推到柜子最深处，那一晚睡得很沉，也没做梦',
        effects: [
          { attr: 'happiness', delta: -3 },
          { attr: 'smarts', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'youth_vanity_phone',
    category: 'money',
    title: '发布会后的朋友圈',
    text: '新手机发布会结束的当晚，部门群里的"已下单"刷了屏。{name}的手机其实还能用——只是打开相机的那一刻，确实有点旧。',
    minAge: 20,
    maxAge: 28,
    cooldown: 4,
    choices: [
      {
        text: '分期上旗舰，面子也是生产力',
        tooltip: '首付 2,000，之后三年每年还 2,500',
        summary: '{name}的新手机在工位上闪闪发亮，分期短信也准时亮在还款日',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 4 },
          { attr: 'stress', delta: 2 },
        ],
        delayed: [
          {
            years: 1,
            money: -2500,
            repeat: 2,
            summary: '手机分期又到一期，{name}默默点了还款',
          },
        ],
        addTags: ['installment'],
      },
      {
        text: '买上一代旗舰，够用还便宜',
        summary: '{name}的上代旗舰只花了零头，拍照一样清晰，钱包毫发无损',
        effects: [
          { money: -1500 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '不换，旧手机再战三年',
        summary: '{name}给旧手机贴了张新膜，看着它突然觉得顺眼了不少',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'smarts', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'youth_county_offer',
    category: 'life',
    title: '老家来的电话',
    text: '母亲的电话带着电流声："你王叔说县里单位缺人，能内推……你考虑一下？"背景音里有电视声，她没催，就等着。',
    minAge: 24,
    maxAge: 30,
    once: true,
    choices: [
      {
        text: '回去，把手头的事安顿好',
        tooltip: '放弃大城市的一切，换一份安稳',
        summary: '{name}退了房加了油，后视镜里的城市越来越小，后座上的绿植越来越近',
        effects: [
          { money: -1000 },
          { attr: 'stress', delta: -5 },
          { attr: 'happiness', delta: 3 },
          { attr: 'social', delta: -2 },
          { relation: { kind: 'parent', deltaCloseness: 6 } },
          { quitJob: true },
        ],
        removeTags: ['go_big_city'],
        addTags: ['stay_hometown', 'stable_path'],
      },
      {
        text: '留在大城市，把闯劲进行到底',
        summary: '{name}说"再拼几年"，母亲说"好"，然后两人都没再说话',
        effects: [
          { attr: 'smarts', delta: 1 },
          { attr: 'stress', delta: 2 },
        ],
        addTags: ['go_big_city'],
      },
      {
        text: '说再想想，让子弹飞一会儿',
        summary: '{name}把决定往后推了推，反正内推的消息年年有——大概吧',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
  // ─── 时代氛围（第 27 轮：纯氛围事件，无机制效果或极轻） ───
  {
    id: 'youth_livehouse',
    category: 'life',
    title: '周五的 Livehouse',
    text: '关注的乐队周五来巡演，购票 App 上的票开售就空了。群里有人晒出排队的人龙，也有人问"有人转票吗"。{name}的周五晚上，忽然有了两种过法。',
    minAge: 18,
    maxAge: 30,
    weight: 7,
    cooldown: 5,
    choices: [
      {
        text: '蹲一张转票，去现场',
        summary: '{name}在人群里跟着合唱了一整晚，耳朵嗡嗡响到了周六',
        effects: [
          { money: -300 },
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: -1 },
        ],
      },
      {
        text: '等官方回放，在家听',
        summary: '{name}戴着耳机把整场听完，音质一般，但沙发很舒服',
        effects: [
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '转发一下，帮朋友问问票',
        summary: '{name}没去现场，群里倒因为这条转发热闹了一晚上',
        effects: [
          { attr: 'social', delta: 1 },
        ],
      },
    ],
  },
  // ── 第 70 轮：时代纵深 II 纯氛围（18-25 专属向）——外卖柜前的十分钟 ──
  {
    id: 'youth_takeout_shelf',
    category: 'life',
    title: '外卖柜前的十分钟',
    text: '晚下课高峰，外卖柜前的队伍排出了遮阳棚。取餐码一个接一个地响，骑手的电动车在路边排成一列，手机屏幕上「您的订单即将超时」。{name}踮着脚在格子间里找自己的那份。',
    minAge: 23,
    maxAge: 25,
    weight: 7,
    cooldown: 5,
    choices: [
      {
        text: '帮同宿舍带一份，顺手的事',
        summary: '{name}拎着两份饭从人堆里挤出来，宿舍群里的谢礼表情刷了一屏',
        effects: [
          { attr: 'social', delta: 1 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '戴上耳机刷视频，慢慢等叫号',
        summary: '取餐码跳到 {name} 的时候，那条视频刚好刷到「当代大学生的一天」',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    id: 'yk_sudden',
    category: 'health',
    title: '体检单上的阴影',
    text: '连着通宵之后，{name}在体检中心晕倒了。醒来时医生的话很轻，但每个字都很重：「先天性血管隐患，过度疲劳诱发了先兆。不能再熬任何一次夜——下一次，可能没有醒来的机会。」',
    minAge: 18,
    maxAge: 30,
    once: true,
    requires: { tagsAny: ['risk_taker'], maxAttr: { health: 40 }, suddenRisk: true },
    choices: [
      {
        text: '不就是个头晕吗，扛过去就好',
        tooltip: '极度危险：身体状况将继续恶化，来年可能不治',
        summary: '{name}把医嘱折起来塞进口袋，继续把咖啡当水喝。身体里的那根弦，正在一寸寸松动',
        effects: [{ attr: 'health', delta: -6 }],
        delayed: [{ years: 1, money: 0, attr: 'health', delta: -100, summary: '那个医生说过的不治，来了' }],
      },
      {
        text: '立刻住院，彻底改变生活方式',
        tooltip: '手术+疗养 20,000 元；劫后余生',
        summary: '{name}请了长假住院干预。出院那天，{name}把手机里的闹钟从「起床」改成了「睡觉」',
        effects: [
          { money: -20000 },
          { attr: 'health', delta: 10 },
          { attr: 'stress', delta: 3 },
        ],
      },
    ],
  },
]
