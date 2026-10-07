// 第 9 轮：职业事件（11 个）
// 覆盖职业全循环：求职（招工启事/写字楼招聘/校园招聘）、入职体验（第一笔工资）、
// 升职（部门提人/重点班）、转行（老同学的出路）、行业寒冬（裁员压力）、
// 35 岁危机（程序员）、再就业（老东家返聘），以及岗位专属内容（护士夜班/教师重点班）。
// 五大方向均有入口：手艺（招工/转行）、行政（写字楼）、医护（校招/夜班）、
// 技术（校招/35岁）、学术（校招/教师）。系统性结算在 engine/career.ts。
import type { GameEvent } from '../../engine/types'

export const CAREER_EVENTS: GameEvent[] = [
  {
    id: 'car_job_board',
    category: 'career',
    title: '电线杆上的招工启事',
    text: '公交站的电线杆上贴着一排招工启事，浆糊还没干。{name}站在那儿，把联系电话一张张抄进手机。',
    minAge: 18,
    maxAge: 60,
    cooldown: 3,
    weight: 12,
    requires: { careerKinds: ['none', 'unemployed'], education: ['junior', 'highschool'] },
    choices: [
      {
        text: '跟着师傅练摊，做个市集摊主',
        tooltip: '门槛最低的小本生意，起早贪黑',
        summary: '{name}批发市场进了第一批货，凌晨四点的闹钟从此定上了',
        effects: [
          { attr: 'stress', delta: 2 },
          { attr: 'social', delta: 2 },
          { startJob: { jobId: 'stall_vendor' } },
        ],
        requires: { minSkills: { vocational: 20 } },
      },
      {
        text: '去物流园应聘仓储管理员',
        tooltip: '需要高中学历和一点动手经验',
        summary: '{name}领到了扫描枪，仓库的货架编号背了一星期',
        effects: [
          { attr: 'stress', delta: 1 },
          { startJob: { jobId: 'warehouse_keeper' } },
        ],
        requires: { education: ['highschool'], minSkills: { vocational: 25 } },
      },
      {
        text: '先送外卖过渡，边送边看机会',
        summary: '{name}的头盔上多了几道划痕，手机里存了十几个招聘群',
        effects: [
          { money: 9000 },
          { attr: 'stress', delta: 3 },
          { addSkill: { id: 'vocational', delta: 2 } },
        ],
        addTags: ['gig_work'],
      },
    ],
  },
  {
    id: 'car_office_recruit',
    category: 'career',
    title: '写字楼的招聘会',
    text: '招聘 App 上约好的初面，到了才发现是写字楼大堂里摆开的折叠桌，每张桌子后面都是一摞简历。{name}把简历又捋平了一遍，排进了队伍。',
    minAge: 20,
    maxAge: 50,
    cooldown: 4,
    weight: 10,
    requires: {
      careerKinds: ['none', 'unemployed'],
      education: ['college', 'bachelor', 'master', 'phd'],
    },
    choices: [
      {
        text: '投行政文员，先求个安稳',
        tooltip: '需要大专以上学历和过得去的学业功底',
        summary: '{name}的工牌挂上了脖子，邮箱里塞满了会议通知',
        effects: [
          { attr: 'happiness', delta: 2 },
          { startJob: { jobId: 'office_clerk' } },
        ],
        requires: { minSkills: { academics: 35 } },
      },
      {
        text: '先接些零活干着，等更好的机会',
        summary: '{name}把招聘会的宣传袋留下了，里面装满了各家公司的册子',
        effects: [
          { money: 6000 },
          { attr: 'stress', delta: 2 },
        ],
        addTags: ['gig_wait'],
      },
      {
        text: '报个面试培训班，把简历磨亮',
        tooltip: '花钱买敲门砖',
        summary: '{name}的自我介绍背了两百遍，梦想是「贵公司」',
        effects: [
          { money: -2500 },
          { addSkill: { id: 'academics', delta: 3 } },
        ],
        addTags: ['interview_prep'],
      },
    ],
  },
  {
    id: 'car_campus_recruit',
    category: 'career',
    title: '秋招的最后一班地铁',
    text: '毕业季的招聘会散场了，{name}攥着几份没投出去的简历挤上地铁。车厢里全是同样疲惫又不安的年轻人。',
    minAge: 18,
    maxAge: 32,
    once: true,
    priority: 2,
    weight: 12,
    requires: {
      careerKinds: ['none', 'unemployed'],
      tagsAny: ['graduated_college', 'graduated_bachelor', 'graduated_master', 'graduated_phd'],
    },
    choices: [
      {
        text: '投互联网公司，从写代码干起',
        tooltip: '起薪高，压力大，吃的是青春饭',
        summary: '{name}的工位上多了一盆多肉和三块显示器',
        effects: [
          { attr: 'stress', delta: 3 },
          { attr: 'smarts', delta: 2 },
          { startJob: { jobId: 'junior_dev' } },
        ],
        requires: { education: ['bachelor', 'master', 'phd'], minSkills: { academics: 55 } },
      },
      {
        text: '备考教师编制，回学校去',
        tooltip: '需要本科学历和扎实的学业功底',
        summary: '{name}把教育学课本摆上了床头',
        effects: [
          { attr: 'social', delta: 2 },
          { attr: 'happiness', delta: 1 },
          { startJob: { jobId: 'teacher' } },
        ],
        requires: { education: ['bachelor', 'master', 'phd'], minSkills: { academics: 60 } },
      },
      {
        text: '应聘医院的护理岗',
        tooltip: '三班倒，但稳定',
        summary: '{name}的白大褂洗得发白，排班表贴在了冰箱上',
        effects: [
          { attr: 'stress', delta: 2 },
          { attr: 'social', delta: 1 },
          { startJob: { jobId: 'nurse' } },
        ],
        requires: {
          education: ['college', 'bachelor', 'master', 'phd'],
          minSkills: { vocational: 45 },
        },
      },
      {
        text: '先休息一年，想清楚再出发',
        summary: '{name}给自己放了个假，简历在抽屉里睡了一觉',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 3 },
        ],
        addTags: ['gap_year'],
      },
    ],
  },
  {
    id: 'car_first_paycheck',
    category: 'career',
    title: '第一笔像样的工资',
    text: '工资到账的短信响了一声。{name}盯着屏幕上那串数字看了很久——这是第一次靠自己的名字挣到的钱。',
    minAge: 18,
    maxAge: 30,
    once: true,
    weight: 12,
    requires: { careerKinds: ['employed'], jobLevels: [1] },
    choices: [
      {
        text: '给家里包个大红包',
        summary: '{name}妈在电话里嘴上说乱花钱，声音却明显亮了',
        effects: [
          { money: -3000 },
          { attr: 'happiness', delta: 3 },
          { relation: { kind: 'parent', deltaCloseness: 8 } },
        ],
      },
      {
        text: '咬牙买台好电脑，给自己充电',
        summary: '{name}的睡前时间从短视频换成了网课',
        effects: [
          { money: -6000 },
          { addSkill: { id: 'vocational', delta: 4 } },
        ],
      },
      {
        text: '请同事吃饭，把人缘处好',
        summary: '{name}的饭局让全组记住了这个新人的名字',
        effects: [
          { money: -1500 },
          { attr: 'social', delta: 4 },
        ],
      },
    ],
  },
  {
    id: 'car_promotion_push',
    category: 'career',
    title: '部门要提一个人',
    text: '例会上领导的话敲在每个人心上：「部门要提一个人，大家都有机会。」{name}感觉好几道目光在办公室里无声地交锋。',
    minAge: 22,
    maxAge: 58,
    cooldown: 5,
    weight: 8,
    requires: { careerKinds: ['employed'] },
    choices: [
      {
        text: '主动请缨，走管理线',
        tooltip: '管人比管事累，但位子高一层',
        summary: '{name}的名字出现在了新组织架构图的上层',
        effects: [
          { promote: true },
          { attr: 'stress', delta: 5 },
          { attr: 'social', delta: 3 },
        ],
        requires: { minSkills: { academics: 40 }, promotionAvailable: true },
      },
      {
        text: '深耕专业，走技术线',
        tooltip: '把手艺磨到极致，靠本事说话',
        summary: '{name}带起了自己的课题，评优名单上有了名字',
        effects: [
          { promote: true },
          { addSkill: { id: 'vocational', delta: 4 } },
          { attr: 'stress', delta: 2 },
        ],
        requires: { minSkills: { vocational: 40 }, promotionAvailable: true },
      },
      {
        text: '继续沉淀，明年再说',
        summary: '{name}把竞聘表塞回了抽屉，笔记倒是多做了两页',
        effects: [
          { addSkill: { id: 'academics', delta: 2 } },
          { addSkill: { id: 'vocational', delta: 2 } },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'car_industry_winter',
    category: 'career',
    title: '行业寒冬',
    text: '降本增效的通知贴了出来，茶水间的议论声压得很低。{name}的工位离领导办公室不远，能听见里面关门的声音。',
    minAge: 24,
    maxAge: 55,
    cooldown: 6,
    weight: 6,
    requires: { careerKinds: ['employed'] },
    choices: [
      {
        text: '硬扛，用加班证明自己的价值',
        tooltip: '拿健康换安全感，公司会给点补偿',
        summary: '{name}的加班审批没被拒过，体检报告倒多了两个箭头',
        effects: [
          { attr: 'stress', delta: 6 },
          { attr: 'health', delta: -2 },
          { salaryMul: 1.05 },
        ],
      },
      {
        text: '主动辞职，骑驴找马换个赛道',
        tooltip: '离开岗位，先歇口气再找工作',
        summary: '{name}抱着纸箱走出大楼时，天反而晴了',
        effects: [
          { attr: 'stress', delta: -3 },
          { attr: 'happiness', delta: 1 },
          { quitJob: true },
        ],
      },
      {
        text: '接受降薪，留在熟悉的岗位上',
        summary: '{name}在新合同上签了字，工位还是原来那个',
        effects: [
          { attr: 'happiness', delta: -3 },
          { salaryMul: 0.88 },
        ],
      },
    ],
  },
  {
    id: 'car_skill_pivot',
    category: 'career',
    title: '老同学介绍的出路',
    text: '老同学的电话打过来，说他们那边缺人手，问{name}有没有兴趣换条道走走。「反正现在这行，也就那样。」',
    minAge: 24,
    maxAge: 48,
    cooldown: 5,
    weight: 8,
    requires: { careerKinds: ['employed', 'none', 'unemployed'] },
    choices: [
      {
        text: '转行考电工证，投奔师傅去',
        tooltip: '手艺人的铁饭碗，需要过硬的动手能力',
        summary: '{name}的工具包从此常备在电动车后备箱里',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: 2 },
          { startJob: { jobId: 'electrician' } },
        ],
        requires: { minSkills: { vocational: 45 }, tagsNone: ['job_electrician'] },
      },
      {
        text: '辞了，跟他一起做市集生意',
        tooltip: '小本生意，自由但辛苦',
        summary: '{name}和老同学盘下了早市拐角的摊位',
        effects: [
          { attr: 'social', delta: 2 },
          { attr: 'stress', delta: 3 },
          { startJob: { jobId: 'stall_vendor' } },
        ],
        requires: { minSkills: { vocational: 20 }, tagsNone: ['job_stall_vendor'] },
      },
      {
        text: '谢谢好意，留在原行业不动',
        summary: '{name}请老同学吃了顿饭，各自说了保重',
        effects: [
          { attr: 'stress', delta: -1 },
          { attr: 'happiness', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'car_dev_midlife',
    category: 'career',
    title: '35 岁的工位',
    text: '新来的实习生喊{name}「老师」的时候，{name}愣了一下。招聘软件上「35 岁以下」的字样，最近总是跳进眼睛里。',
    minAge: 33,
    maxAge: 45,
    once: true,
    weight: 10,
    requires: { tagsAll: ['job_junior_dev'] },
    choices: [
      {
        text: '冲刺一把，转去研发岗',
        tooltip: '需要硕士以上学历和过硬的学业功底',
        summary: '{name}的名字进了研发中心的花名册',
        effects: [
          { attr: 'stress', delta: 3 },
          { attr: 'smarts', delta: 2 },
          { startJob: { jobId: 'rd_engineer' } },
        ],
        requires: { education: ['master', 'phd'], minSkills: { academics: 70 } },
      },
      {
        text: '转去物流园做仓储管理，求个安稳',
        summary: '{name}的键盘换成了扫描枪，晚上总算能睡整觉',
        effects: [
          { attr: 'stress', delta: -2 },
          { attr: 'happiness', delta: 1 },
          { startJob: { jobId: 'warehouse_keeper' } },
        ],
        requires: { minSkills: { vocational: 25 } },
      },
      {
        text: '谈一笔体面的赔偿金，离开',
        tooltip: '拿钱走人，重新开始',
        summary: '{name}把工牌放进纸箱最上面，赔偿金到账提示紧跟着响了',
        effects: [
          { money: 40000 },
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: 2 },
          { loseJob: true },
        ],
      },
      {
        text: '死磕一线，跟年龄死磕到底',
        summary: '{name}的技术博客更新得比谁都勤，评论区有人叫「活着的传说」',
        effects: [
          { attr: 'stress', delta: 4 },
          { attr: 'happiness', delta: 2 },
          { addSkill: { id: 'academics', delta: 3 } },
        ],
      },
    ],
  },
  {
    id: 'car_nurse_shifts',
    category: 'career',
    title: '夜班的第三年',
    text: '凌晨三点的走廊静得能听见输液滴答的声音。{name}揉了揉眼睛，在交班本上写下今天第三十几条记录。',
    minAge: 23,
    maxAge: 48,
    cooldown: 4,
    weight: 9,
    requires: { tagsAll: ['job_nurse'] },
    choices: [
      {
        text: '考护师职称，把路走宽',
        tooltip: '花钱花时间，但职级和工资都会认',
        summary: '{name}的证书又厚了一本，护士长看她的眼神不一样了',
        effects: [
          { money: -3000 },
          { addSkill: { id: 'vocational', delta: 6 } },
          { attr: 'stress', delta: 2 },
        ],
        addTags: ['nurse_certified'],
      },
      {
        text: '申请调去做行政班，少点夜班',
        summary: '{name}的排班表终于见了太阳，工资条倒是薄了一层',
        effects: [
          { attr: 'stress', delta: -3 },
          { attr: 'happiness', delta: 2 },
          { salaryMul: 0.9 },
        ],
      },
      {
        text: '辞职，拿积蓄开个社区小店',
        tooltip: '离开医院，把日子攥在自己手里',
        summary: '{name}的小店挂了牌，老病人们都来捧场',
        effects: [
          { money: -15000 },
          { attr: 'happiness', delta: 4 },
          { attr: 'stress', delta: 2 },
          { quitJob: true },
        ],
        addTags: ['shop_dream'],
      },
    ],
  },
  {
    id: 'car_teacher_class',
    category: 'career',
    title: '重点班的邀请',
    text: '教务主任把一份名单推到{name}面前：下一届重点班，缺一个班主任。「想好再答复我，这可是个苦差事。」',
    minAge: 26,
    maxAge: 50,
    cooldown: 4,
    weight: 9,
    requires: { tagsAll: ['job_teacher'] },
    choices: [
      {
        text: '接下重点班，往高级职称冲',
        tooltip: '职级和名声都在前头，压力也是',
        summary: '{name}的名字出现在了重点班的门牌上',
        effects: [
          { promote: true },
          { attr: 'stress', delta: 5 },
        ],
        requires: { minSkills: { academics: 68 }, promotionAvailable: true },
      },
      {
        text: '婉拒，把时间留给自己的生活',
        summary: '{name}傍晚六点准时下班，操场上正在拍毕业照',
        effects: [
          { attr: 'happiness', delta: 3 },
          { attr: 'stress', delta: -2 },
        ],
      },
      {
        text: '带竞赛小组，冲一份教学成果',
        summary: '{name}的学生拿了市里的奖，喜报贴上了光荣榜',
        effects: [
          { money: 3000 },
          { addSkill: { id: 'academics', delta: 5 } },
          { attr: 'stress', delta: 4 },
        ],
      },
    ],
  },
  {
    id: 'car_old_boss_call',
    category: 'career',
    title: '老东家的返聘电话',
    text: '陌生号码打进来，却是以前的老领导：「最近怎么样？这边缺人，你要不要回来？」{name}握着手机，一时没说话。',
    minAge: 24,
    maxAge: 60,
    cooldown: 4,
    weight: 8,
    requires: {
      careerKinds: ['none', 'unemployed'],
      tagsAny: [
        'ex_nurse', 'ex_teacher', 'ex_junior_dev', 'ex_rd_engineer', 'ex_researcher',
        'ex_office_clerk', 'ex_warehouse_keeper', 'ex_electrician', 'ex_stall_vendor',
      ],
    },
    choices: [
      {
        text: '回医院上班，老本行熟门熟路',
        tooltip: '需要护理技能还过得去',
        summary: '{name}重新挂上了工牌，走廊还是那条走廊',
        effects: [
          { attr: 'happiness', delta: 1 },
          { startJob: { jobId: 'nurse' } },
        ],
        requires: { tagsAll: ['ex_nurse'], minSkills: { vocational: 45 } },
      },
      {
        text: '回学校代课，把书再教起来',
        tooltip: '需要学业功底还在',
        summary: '{name}的教案本翻开了新的一页',
        effects: [
          { attr: 'happiness', delta: 2 },
          { startJob: { jobId: 'teacher' } },
        ],
        requires: { tagsAll: ['ex_teacher'], minSkills: { academics: 60 } },
      },
      {
        text: '不吃回头草，自己摆摊干',
        tooltip: '自由归自由，辛苦也归自己',
        summary: '{name}的摊位挂上了新手写的招牌',
        effects: [
          { attr: 'social', delta: 2 },
          { attr: 'stress', delta: 2 },
          { startJob: { jobId: 'stall_vendor' } },
        ],
        requires: { minSkills: { vocational: 20 } },
      },
      {
        text: '再看看，手上还有几个机会',
        summary: '{name}客气地挂了电话，把简历又刷新了一遍',
        effects: [
          { money: 2000 },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
  // 第 13 轮因果链：mid_promotion_race「全力争那个位置」(workaholic_streak) → 本事件。
  // 抢来的位置自带利息：拼出来的成就记在履历上，也记在身体上。
  {
    id: 'car_workaholic_bill',
    category: 'career',
    title: '拼命三郎的账单',
    text: '自打坐上那个抢来的位置，{name}的日历上就没再出现过"下班"两个字。这晚加完班，镜子里的黑眼圈比工牌上的照片老了好几岁。',
    minAge: 26,
    maxAge: 55,
    cooldown: 4,
    weight: 10,
    requires: { tagsAll: ['workaholic_streak'], careerKinds: ['employed'] },
    choices: [
      {
        text: '再拼一年，先把位子坐稳',
        tooltip: '成绩会记在账上，身体也会',
        summary: '{name}把闹钟又调早了半小时，工位上的咖啡从一杯变成了三杯',
        effects: [{ attr: 'stress', delta: 6 }],
        delayed: [{ years: 1, attr: 'health', delta: -3, summary: '拼出来的成绩单很亮，体检单上的箭头也很多' }],
      },
      {
        text: '学着带人，把活分出去',
        tooltip: '短期慢，长期稳',
        summary: '{name}第一次把方案交给组员去做，盯着改了三稿，居然没自己动手',
        effects: [
          { attr: 'stress', delta: -3 },
          { attr: 'social', delta: 2 },
          { addSkill: { id: 'academics', delta: 1 } },
        ],
      },
      {
        text: '休个年假，手机开飞行模式',
        summary: '两周后回来，世界没塌，反而转得挺顺',
        effects: [
          { money: -3000 },
          { attr: 'stress', delta: -5 },
          { attr: 'happiness', delta: 3 },
        ],
        requires: { moneyAtLeast: 3000 },
      },
    ],
  },
  // 第 13 轮因果链：car_nurse_shifts「考下职称」(nurse_certified) → 本事件。
  // 证书到手只是中途站，用证的方式才是真正的分岔。
  {
    id: 'car_nurse_certificate',
    category: 'career',
    title: '职称证到了',
    text: '护士执业资格证下来那天，护士长拿着证看了看{name}："行啊，考下来了。接下来怎么打算的？"',
    minAge: 23,
    maxAge: 55,
    once: true,
    weight: 12,
    priority: 2,
    requires: { tagsAll: ['nurse_certified'], careerKinds: ['employed'] },
    choices: [
      {
        text: '竞聘护理组长',
        tooltip: '职级与薪资都往上走一步',
        summary: '竞聘答辩那天，{name}把三年来记的护理笔记摆了一桌',
        effects: [{ promote: true }],
        requires: { promotionAvailable: true },
      },
      {
        text: '跳去私立医院，薪水涨三成',
        tooltip: '钱多了，强度也上去了',
        summary: '私立医院的排班表更密，但工资条上的数字也确实更精神',
        effects: [
          { salaryMul: 1.3 },
          { attr: 'stress', delta: 4 },
          { attr: 'health', delta: -1 },
        ],
      },
      {
        text: '把证收进抽屉，稳定就好',
        summary: '{name}把证和第一张工牌放在一起，继续上熟悉的班',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
    ],
  },
  // 第 13 轮因果链：youth_family_bankroll「接受这笔钱」(family_backed) → 本事件。
  // 家里递过的不只是钱，还有一条铺好的路——走不走，由你。
  {
    id: 'car_family_business',
    category: 'career',
    title: '家里的公司',
    text: '饭桌上，长辈放下筷子："公司最近缺人手，你要是外面漂得累了，回来有个位子给你留着。"{name}夹菜的手停了一下。',
    minAge: 24,
    maxAge: 45,
    once: true,
    weight: 11,
    requires: { tagsAny: ['family_backed'], careerKinds: ['none', 'unemployed'] },
    choices: [
      {
        text: '进公司，从坐办公室做起',
        tooltip: '家里人看着，路要自己走端正',
        summary: '{name}去公司报到的第一天，长辈只交代了一句"别说是我介绍来的"',
        effects: [{ startJob: { jobId: 'office_clerk' } }],
        requires: { education: ['college', 'bachelor', 'master', 'phd'] },
      },
      {
        text: '去家里的铺子帮忙，先干起来',
        tooltip: '不问学历，只看手脚勤不勤',
        summary: '{name}系上围裙的那一刻，长辈难得地没说话，只是点了点头',
        effects: [{ startJob: { jobId: 'stall_vendor' } }],
      },
      {
        text: '谢绝安排：路我自己走',
        summary: '{name}把碗里最后一口饭吃完，说"谢谢，但我再试试"',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'smarts', delta: 1 },
        ],
        addTags: ['self_made'],
      },
    ],
  },
]
