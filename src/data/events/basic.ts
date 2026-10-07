// 第 6 轮：基础事件池（16 个，覆盖青年/中年/晚年）
// 本轮事件效果仅使用属性/金钱/关系/标记/延迟效果；
// 教育与职业的系统性变化分别留给第 8、9 轮，这里先用标记埋点。
import type { GameEvent } from '../../engine/types'

export const BASIC_EVENTS: GameEvent[] = [
  // ─── 青年 18～30 ───────────────────────────────────────────
  {
    id: 'youth_gap_decision',
    category: 'education',
    title: '人生的岔路口',
    text: '18 岁的夏天，成绩单拿在手里，不上不下。家里人围坐在饭桌旁，等{name}拿主意：接下来的路怎么走？',
    minAge: 18,
    maxAge: 20,
    once: true,
    priority: 2,
    choices: [
      {
        text: '复读一年，再冲一次高考',
        tooltip: '花一年时间和学费，换一次更高的起点',
        summary: '{name}背着书包重回教室，把不甘心写进了每一页笔记',
        effects: [
          { attr: 'smarts', delta: 3 },
          { attr: 'stress', delta: 7 },
          { attr: 'happiness', delta: -2 },
          { money: -3000 },
          { startEducation: { stage: 'highschool', years: 1 } },
        ],
        addTags: ['gaokao_retry'],
      },
      {
        text: '去读大专，早两年进入社会',
        tooltip: '三年学制，学历普通但扎实',
        summary: '{name}拖着行李箱住进了大专宿舍，打算用实践补齐文凭',
        effects: [
          { attr: 'smarts', delta: 1 },
          { attr: 'stress', delta: 2 },
          { money: -2000 },
          { startEducation: { stage: 'college', years: 3 } },
        ],
        addTags: ['went_college'],
      },
      {
        text: '直接打工，帮家里减轻负担',
        tooltip: '放弃升学，先挣眼前的生活费',
        summary: '{name}换上工装提前进了社会，第一笔工资寄回了家里',
        effects: [
          { attr: 'stress', delta: 4 },
          { attr: 'social', delta: 2 },
          { money: 10000 },
        ],
        addTags: ['work_early'],
      },
    ],
  },
  {
    id: 'youth_dorm_conflict',
    category: 'life',
    title: '深夜的键盘声',
    text: '室友总在凌晨开着语音打游戏，机械键盘噼啪作响，{name}第二天顶着黑眼圈醒来。这种日子过了一个月，火气已经压不住了。',
    minAge: 18,
    maxAge: 24,
    cooldown: 5,
    // 室友冲突只属于集体居住：独居或住在家里都没有室友（第 10 轮复验修复：
    // 实测独居次年仍抽到本事件；学生宿舍与合租者不受影响）
    requires: { tagsNone: ['independent_living', 'lived_with_parents'] },
    choices: [
      {
        text: '摊开来谈，定个作息公约',
        summary: '{name}和室友立下熄灯约定，宿舍终于能在十二点后安静下来',
        effects: [
          { attr: 'social', delta: 3 },
          { attr: 'stress', delta: -4 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '忍着，塞上耳塞睡',
        summary: '{name}把耳塞按进耳朵，把火气咽回肚子里',
        effects: [
          { attr: 'stress', delta: 5 },
          { attr: 'health', delta: -1 },
          { attr: 'happiness', delta: -2 },
        ],
      },
      {
        text: '搬出去校外合租',
        tooltip: '房租是一笔不小的开销',
        summary: '{name}搬出宿舍，花大价钱买回了安静的夜晚',
        effects: [
          { money: -12000 },
          { attr: 'happiness', delta: 3 },
          { attr: 'health', delta: 1 },
        ],
        addTags: ['independent_living'],
      },
    ],
  },
  {
    id: 'youth_crush',
    category: 'relationship',
    title: '心动的一瞬间',
    text: '图书馆靠窗的位置，那个人抬起头冲{name}笑了一下。心跳漏了一拍——这样的机会，也许只有一次。',
    minAge: 18,
    maxAge: 28,
    once: true,
    // 第 15 轮：有伴侣/配偶的人不再触发（原会让已婚角色凭空多出第二个恋人）
    requires: { relationKindsNone: ['partner', 'spouse'] },
    choices: [
      {
        text: '鼓起勇气，直接表白',
        tooltip: '可能开始一段恋情',
        summary: '{name}说出了心意，对方红着脸点了点头',
        effects: [
          { attr: 'happiness', delta: 6 },
          { attr: 'social', delta: 3 },
          { attr: 'stress', delta: 3 },
          // 第 39 轮平衡（300 局对照）：落地亲密度 50→60。求婚 minAge 25 + 资格线 50
          // 下，落地 55 的资格窗会被衰减吃掉大半（婚姻普遍推迟到 38+，育龄窗错过）；
          // 60 = 热恋溢价，给青年恋人 ~10 年求婚窗，让「早婚早育」重新成为可行剧本。
          { relation: { kind: 'partner', add: true, name: '林晓', closeness: 60 } },
        ],
        addTags: ['dated'],
      },
      {
        text: '先从朋友做起',
        summary: '{name}和那个人成了无话不谈的朋友，有些话先放在心里',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'social', delta: 2 },
          { relation: { kind: 'friend', add: true, name: '书友小杜' } },
        ],
      },
      {
        text: '把心事埋进心底',
        summary: '{name}什么也没说，那页书翻过去就再没读过',
        effects: [
          { attr: 'happiness', delta: -4 },
          { attr: 'stress', delta: 3 },
        ],
        addTags: ['walled_heart'],
      },
    ],
  },
  {
    id: 'youth_night_class',
    category: 'education',
    title: '晚上的一小时',
    text: '晚上八点以后，时间终于属于自己。同事在刷短视频，{name}盯着桌角那张培训班的传单发呆。',
    minAge: 19,
    maxAge: 32,
    cooldown: 5,
    choices: [
      {
        text: '报个培训班，考个有用的证书',
        tooltip: '花九千元，换来实打实的本领',
        summary: '{name}啃下了一本本教材，证书到手那天请自己吃了顿好的',
        effects: [
          { money: -9000 },
          { attr: 'smarts', delta: 3 },
          { attr: 'stress', delta: 3 },
        ],
        addTags: ['self_improver'],
      },
      {
        text: '办张借书证，自己啃书',
        summary: '{name}在图书馆泡了一整年，笔记记满了两个本子',
        effects: [
          { attr: 'smarts', delta: 2 },
          { attr: 'stress', delta: 2 },
        ],
      },
      {
        text: '追剧躺平，给自己放个假',
        summary: '{name}追完了三部长剧，日子舒服但原地踏步',
        effects: [
          { attr: 'happiness', delta: 2 },
          { attr: 'smarts', delta: -1 },
        ],
      },
    ],
  },
  {
    id: 'youth_first_salary_splurge',
    category: 'money',
    title: '第一笔像样的奖金',
    text: '账户里突然多出一笔奖金，数字后面的零比想象中多。{name}盯着手机银行，第一次觉得"钱"这个字有了温度。',
    minAge: 20,
    maxAge: 30,
    cooldown: 4,
    // "第一次觉得钱有温度"只有一次（第 19 轮重复清点：cooldown 到期重播与"第一笔"矛盾）
    once: true,
    requires: { moneyAtLeast: 15000 },
    choices: [
      {
        text: '奖励自己惦记了很久的数码产品',
        summary: '{name}抱着新设备回家，快乐来得直接又具体',
        effects: [
          { money: -9000 },
          { attr: 'happiness', delta: 5 },
        ],
      },
      {
        text: '存进理财，让钱慢慢生钱',
        tooltip: '三年后见分晓',
        summary: '{name}把钱转进了理财账户，学会了和欲望谈判',
        effects: [{ money: -8000 }],
        delayed: [{ years: 3, money: 1000, summary: '当年存的理财到期，小赚了一笔' }],
        addTags: ['saver'],
      },
      {
        text: '给爸妈包个大红包',
        summary: '{name}把红包塞进妈妈手里，她嘴上嫌多，转头就跟邻居炫耀',
        effects: [
          { money: -10000 },
          { attr: 'happiness', delta: 3 },
          { relation: { kind: 'parent', deltaCloseness: 8 } },
        ],
      },
    ],
  },
  {
    id: 'youth_friend_loan',
    category: 'money',
    title: '老友的求助电话',
    text: '深夜十一点，多年老友打来电话，声音疲惫："能借我五千块周转吗？下个月一定还。"',
    minAge: 20,
    maxAge: 36,
    cooldown: 6,
    choices: [
      {
        text: '二话不说，转了过去',
        tooltip: '钱可能回不来，情分也可能不一样了',
        summary: '{name}没多问一句就转了钱，老友在电话那头沉默了几秒',
        effects: [
          { money: -5000 },
          { relation: { kind: 'friend', deltaCloseness: 8 } },
        ],
        delayed: [{ years: 3, money: 5000, summary: '老友度过了难关，如约把钱还了回来' }],
        addTags: ['lent_money'],
      },
      {
        text: '委婉拒绝，手头也不宽裕',
        summary: '{name}找了个借口推掉，挂了电话心里堵得慌',
        effects: [
          { attr: 'stress', delta: 3 },
          { relation: { kind: 'friend', deltaCloseness: -10 } },
        ],
      },
      {
        text: '借两千，聊表心意',
        summary: '{name}转了两千块，量力而行，也留住了体面',
        effects: [
          { money: -2000 },
          { relation: { kind: 'friend', deltaCloseness: 2 } },
        ],
      },
    ],
  },
  {
    id: 'youth_move_out',
    category: 'life',
    title: '想有自己的门钥匙',
    text: '青春期早就过了，可住在家里总像半个孩子。{name}深夜刷着租房软件，想象一个人生活的样子。',
    minAge: 19,
    maxAge: 30,
    once: true,
    choices: [
      {
        text: '搬出去，一个人住',
        tooltip: '自由是要花钱的',
        summary: '{name}在出租屋里吃了第一顿自己做的饭，难吃但自由',
        effects: [
          { money: -18000 },
          { attr: 'happiness', delta: 4 },
          { attr: 'stress', delta: 2 },
          { attr: 'social', delta: 1 },
        ],
        addTags: ['independent_living'],
      },
      {
        text: '继续住家里，把钱存下来',
        summary: '{name}留在了家里，饭桌上多了笑声，也多了唠叨',
        effects: [
          { money: 12000 },
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'parent', deltaCloseness: 4 } },
        ],
        addTags: ['lived_with_parents'],
      },
      {
        text: '和好朋友合租，分摊房租',
        summary: '{name}和好友合了租，客厅的深夜聊天成了固定节目',
        effects: [
          { money: -8000 },
          { attr: 'happiness', delta: 2 },
          { attr: 'social', delta: 3 },
          { relation: { kind: 'friend', add: true } },
        ],
      },
    ],
  },
  {
    // 第 19 轮重复清点：同一家"新开"健身房的同一张传单不该多年后重播——改为 once；
    // 续卡阶段剧由 youth_gym_renew 按本次选择的标记（gym_committed/gym_wasted）承接。
    id: 'youth_gym_card',
    category: 'health',
    title: '健身房的传单',
    text: '新开的健身房就在下楼拐角，销售顾问笑容专业："年卡今天办有优惠。"镜子里的人，确实和两年前不太一样了。',
    minAge: 18,
    maxAge: 40,
    once: true,
    choices: [
      {
        text: '办年卡，并且真的坚持去',
        tooltip: '花钱是约束力的一部分',
        summary: '{name}一周三练风雨无阻，体测数据全线飘绿',
        effects: [
          { money: -3000 },
          { attr: 'health', delta: 5 },
          { attr: 'stress', delta: -3 },
        ],
        delayed: [{ years: 1, attr: 'health', delta: 3, summary: '健身习惯保持了一年，身体越来越轻快' }],
        addTags: ['gym_committed'],
      },
      {
        text: '办年卡，去了三次',
        summary: '{name}的年卡在抽屉里安静地过完了它的一生',
        effects: [
          { money: -3000 },
          { attr: 'stress', delta: 2 },
        ],
        addTags: ['gym_wasted'],
      },
      {
        text: '不花这个钱，改跑公园夜跑',
        summary: '{name}换上跑鞋，免费的路跑了一整年',
        effects: [
          { attr: 'health', delta: 2 },
          { attr: 'stress', delta: -2 },
        ],
        addTags: ['gym_declined'],
      },
    ],
  },
  {
    // 第 19 轮阶段性复现：由 youth_gym_card 的选择引起（办卡人持有 gym_committed /
    // gym_wasted 标记才触发），文案与选项真实推进续卡剧情；选"不续"转免费路线后
    // 标记清掉，事件自然停触发。夜跑放弃者（gym_declined）不再收到续卡短信。
    id: 'youth_gym_renew',
    category: 'health',
    title: '续卡的季节',
    text: '健身房的续费短信到了：「老会员续年卡，立减八百。」这一年，那张卡是陪着{name}练了一年，还是在抽屉里躺了一年，自己心里有数。',
    minAge: 19,
    maxAge: 45,
    cooldown: 4,
    requires: { tagsAny: ['gym_committed', 'gym_wasted'] },
    choices: [
      {
        text: '续上，这一年练出了感觉',
        tooltip: '续卡 2,200 元，接着来',
        summary: '{name}的会员卡又续了一年，教练说照这个频次，明年体测还能再进一步',
        requires: { tagsAll: ['gym_committed'] },
        effects: [
          { money: -2200 },
          { attr: 'health', delta: 4 },
          { attr: 'stress', delta: -2 },
        ],
        delayed: [{ years: 1, attr: 'health', delta: 2, summary: '健身的第二个年头，旧衣服一件件变宽松' }],
      },
      {
        text: '再给自己一次机会，这次认真去',
        tooltip: '上次去了三次，这次不一样（大概）',
        summary: '{name}把卡续了，头一个月一周三练——先别夸，坚持住再说',
        requires: { tagsAll: ['gym_wasted'] },
        effects: [
          { money: -2200 },
          { attr: 'health', delta: 3 },
          { attr: 'stress', delta: -2 },
        ],
        removeTags: ['gym_wasted'],
        addTags: ['gym_committed'],
      },
      {
        text: '不续了，公园夜跑一样练',
        tooltip: '免费的坚持也是坚持',
        summary: '{name}没回那条短信，换上跑鞋下了楼。卡到期那天，跑鞋接了班',
        effects: [
          { attr: 'health', delta: 2 },
          { attr: 'stress', delta: -1 },
        ],
        removeTags: ['gym_committed', 'gym_wasted'],
        addTags: ['gym_declined'],
      },
    ],
  },
  {
    id: 'youth_pet_stray',
    category: 'life',
    title: '楼道里的猫',
    text: '一只瘦得能摸到骨头的流浪猫蜷在楼道角落，看见{name}，虚弱地喵了一声。',
    minAge: 19,
    maxAge: 45,
    cooldown: 8,
    // 已经收养了猫（pet_owner）的人再"收养"只会被引擎 no-op 却谎报"家里多了一双眼睛"
    // （第 19 轮重复清点）；未收养者再遇"另一只"流浪猫剧情成立，保留冷却复现。
    requires: { tagsNone: ['pet_owner'] },
    choices: [
      {
        text: '带回家，收养它',
        tooltip: '从此多了一份牵挂和开销',
        summary: '{name}给猫取了名字，家里从此多了一双监视你的眼睛',
        effects: [
          { money: -3000 },
          { attr: 'happiness', delta: 5 },
          { relation: { kind: 'pet', add: true, name: '小猫' } },
        ],
        addTags: ['pet_owner'],
      },
      {
        text: '送去救助站',
        summary: '{name}把猫送去了救助站，回家的路走得很慢',
        effects: [
          { attr: 'social', delta: 1 },
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
      {
        text: '放点猫粮，继续赶路',
        summary: '{name}留下了猫粮和水，第二天碗已经空了',
        effects: [
          { money: -100 },
          { attr: 'happiness', delta: 1 },
        ],
      },
    ],
  },
  {
    // 第 19 轮重复清点：高中同桌只有一场婚礼——同一张请柬不该每六年重播一次
    id: 'youth_old_friend_wedding',
    category: 'relationship',
    title: '红色的请柬',
    text: '高中同桌的婚礼请柬送到手里，日期和一场重要的安排撞了车。份子钱、车程、人情，都在天平两端。',
    minAge: 23,
    maxAge: 34,
    once: true,
    choices: [
      {
        text: '推掉安排，盛装赴宴',
        summary: '{name}在婚礼上和老同学聊到散场，青春好像回来了一天',
        effects: [
          { money: -1000 },
          { attr: 'social', delta: 3 },
          { attr: 'happiness', delta: 3 },
        ],
      },
      {
        text: '人到礼到，吃完就走',
        summary: '{name}露了个面就赶回去处理自己的事，两不耽误',
        effects: [
          { money: -800 },
          { attr: 'social', delta: 1 },
          { attr: 'stress', delta: 1 },
        ],
      },
      {
        text: '托人带份子钱，人不到',
        summary: '{name}没去婚礼，朋友圈的九宫格里没有自己',
        effects: [
          { money: -800 },
          { attr: 'happiness', delta: -2 },
        ],
      },
    ],
  },
  // ─── 中年 31～50 ───────────────────────────────────────────
  {
    id: 'mid_promotion_race',
    category: 'career',
    title: '只有一个坑位',
    text: '部门主管的位置空了出来，{name}和共事多年的老搭档都是热门人选。会议室的灯最近都亮到很晚，跨城评审的视频会议一开就到深夜。',
    minAge: 30,
    maxAge: 50,
    // 同一个坑位、同一位老搭档只有一次（第 19 轮重复清点）；
    // 晋升通道仍由 car_promotion_push（冷却 5 年）与年度考核承担。
    once: true,
    requires: { careerKinds: ['employed'] }, // 主管坑位竞争只在在职时成立（第 9 轮职业状态衔接）
    choices: [
      {
        text: '全力争，这把拼了',
        tooltip: '身体和压力都会付出代价',
        summary: '{name}拿下了那个位置，庆功宴散场后在车里坐了很久',
        effects: [
          { money: 20000 },
          { attr: 'smarts', delta: 2 },
          { attr: 'stress', delta: 7 },
          { attr: 'health', delta: -3 },
        ],
        addTags: ['workaholic_streak'],
      },
      {
        text: '大方让给老搭档',
        summary: '{name}主动退了一步，老搭档红着眼圈说要记这份情',
        effects: [
          { attr: 'social', delta: 3 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'friend', deltaCloseness: 10 } },
        ],
        addTags: ['team_player'],
      },
      {
        text: '找领导摊牌，谈加薪不谈职位',
        summary: '{name}没要头衔，但要来了实实在在的薪水',
        effects: [
          { money: 8000 },
          { attr: 'smarts', delta: 1 },
          { attr: 'stress', delta: 3 },
        ],
      },
    ],
  },
  {
    id: 'mid_parent_health',
    category: 'relationship',
    title: '手术同意书',
    text: '家里老人的体检报告出了问题，医生把手术同意书推到{name}面前："家属签字吧。"',
    minAge: 33,
    maxAge: 58,
    cooldown: 6,
    requires: { relationKinds: ['parent'] },
    choices: [
      {
        text: '请长假，亲自陪护',
        summary: '{name}在病床边守了半个月，老人出院那天握着{name}的手没说话',
        effects: [
          { money: -8000 },
          { attr: 'stress', delta: 5 },
          { attr: 'health', delta: -2 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'parent', deltaCloseness: 12 } },
        ],
        addTags: ['cared_for_parents'],
      },
      {
        text: '花钱请最好的护工',
        summary: '{name}请了专业护工，老人康复得不错，只是总念叨想孩子',
        effects: [
          { money: -30000 },
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'parent', deltaCloseness: 4 } },
        ],
      },
      {
        text: '出钱但顾不上多过问',
        summary: '{name}转去了手术费，电话里的沉默比话多',
        effects: [
          { money: -15000 },
          { attr: 'happiness', delta: -3 },
          { relation: { kind: 'parent', deltaCloseness: -8 } },
        ],
      },
      {
        text: '手头再紧，跟亲戚周转也要治',
        tooltip: '当下拿不出钱：先欠着人情，手术不能等',
        summary: '{name}挨个打通了亲戚的电话，凑齐手术费那天在楼道里蹲了很久',
        effects: [
          { attr: 'stress', delta: 4 },
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'parent', deltaCloseness: 8 } },
        ],
        delayed: [{ years: 1, money: -6000, summary: '给亲戚周转的医药钱，省吃俭用一年才还清' }],
        addTags: ['borrowed_family', 'cared_for_parents'],
      },
    ],
  },
  {
    id: 'mid_house_down_payment',
    category: 'money',
    title: '首付的压力',
    text: '中介第三次打来电话，说看中的那套房有人出手了，就问{name}定不定。卡里的积蓄，刚刚够够到首付的门槛。',
    minAge: 28,
    maxAge: 48,
    once: true,
    requires: { moneyAtLeast: 120000 },
    choices: [
      {
        text: '掏空积蓄，上车大两居',
        tooltip: '首付 10 万，贷 30 万 20 年，年供约 2.4 万',
        summary: '{name}签完字在售楼处门口站了很久，从此是有房的人了——也是欠银行钱的人了',
        effects: [
          { money: -100000 },
          { attr: 'happiness', delta: 4 },
          { attr: 'stress', delta: 6 },
          { takeMortgage: { principal: 300000, years: 20 } },
          { buyHome: { total: 400000 } },
        ],
        delayed: [{ years: 1, money: -30000, summary: '装修和新家具掏去了又一笔积蓄' }],
        addTags: ['homeowner'],
      },
      {
        text: '买个小户型，少贷点款',
        tooltip: '首付 7 万，贷 18 万 20 年，年供约 1.4 万',
        summary: '{name}选了紧凑的小两房，房子不大，月供压力小了一半',
        effects: [
          { money: -70000 },
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: 3 },
          { takeMortgage: { principal: 180000, years: 20 } },
          { buyHome: { total: 250000 } },
        ],
        addTags: ['homeowner'],
      },
      {
        text: '攒够了全款，一步到位',
        tooltip: '25 万全款拿下小两房，不欠银行一分钱',
        summary: '{name}数清了卡里的存款，全款签下了自己的名字，无债一身轻',
        requires: { moneyAtLeast: 250000 },
        effects: [
          { money: -250000 },
          { attr: 'happiness', delta: 3 },
          { attr: 'stress', delta: -1 },
          { buyHome: { total: 250000 } },
        ],
        addTags: ['homeowner'],
      },
      {
        text: '再观望观望，钱放理财',
        tooltip: '错过也许就是错过',
        summary: '{name}顶着家人的埋怨没出手，把安全感留在了卡里',
        effects: [{ attr: 'happiness', delta: 1 }],
        delayed: [{ years: 2, money: 8000, summary: '房价没怎么动，理财的收益倒是很实在' }],
        addTags: ['prudent_saver'],
      },
    ],
  },
  // ─── 晚年 51+ ──────────────────────────────────────────────
  {
    id: 'late_hobby_club',
    category: 'life',
    title: '老年大学的招生简章',
    text: '社区活动中心的玻璃橱窗里换了新海报：老年大学春季班，书法、合唱、园艺……角落里还印着个报名二维码。{name}在橱窗前站了一会儿，忽然有了兴致——掏出手机研究了半天，居然自己扫码报上了名。',
    minAge: 52,
    maxAge: 78,
    cooldown: 4,
    choices: [
      {
        text: '报名书法班，一笔一划重新开始',
        summary: '{name}的隶书从歪歪扭扭写到了有模有样',
        effects: [
          { money: -2000 },
          { attr: 'smarts', delta: 2 },
          { attr: 'happiness', delta: 4 },
        ],
      },
      {
        text: '加入合唱团，图个热闹',
        summary: '{name}在合唱团找到了新朋友，嗓门比年轻时还亮',
        effects: [
          { money: -500 },
          { attr: 'social', delta: 4 },
          { attr: 'health', delta: 1 },
        ],
      },
      {
        text: '在家侍弄一阳台花草',
        summary: '{name}的阳台四季有花开，浇水成了每天的功课',
        effects: [
          { money: -800 },
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: -3 },
        ],
      },
    ],
  },
  {
    id: 'late_health_screen',
    category: 'health',
    title: '体检报告上的箭头',
    text: '社区组织的免费体检，报告单上多了几个向上的箭头。医生扶了扶眼镜："这个年纪，得重视了。"',
    minAge: 50,
    maxAge: 78,
    cooldown: 3,
    choices: [
      {
        text: '听医生的，住院系统治疗',
        summary: '{name}住了半个月院，出院时指标好看多了',
        effects: [
          { money: -20000 },
          { attr: 'health', delta: 6 },
          { attr: 'stress', delta: 3 },
        ],
      },
      {
        text: '严格改变生活方式',
        tooltip: '慢，但是自己的力量',
        summary: '{name}戒了酒局、加了步行，一年后复查箭头少了一半',
        effects: [
          { attr: 'health', delta: 3 },
          { attr: 'happiness', delta: -2 },
        ],
        delayed: [{ years: 1, attr: 'health', delta: 3, summary: '坚持了一年，复查时医生难得夸了人' }],
      },
      {
        text: '身体没感觉，不当回事',
        summary: '{name}把报告塞进抽屉，隐患在身体里安静地等着',
        effects: [
          { attr: 'health', delta: -4 },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
  {
    id: 'late_reunion',
    category: 'relationship',
    title: '越来越少的聚会',
    text: '老同事在群里张罗聚会，报名的人一年比一年少。名单上的名字，{name}已经有些对不上脸了。',
    minAge: 52,
    maxAge: 80,
    cooldown: 4,
    choices: [
      {
        text: '主动接过张罗的担子',
        summary: '{name}一家家打电话，聚会那天来了比预期多一倍的人',
        effects: [
          { money: -3000 },
          { attr: 'social', delta: 5 },
          { attr: 'happiness', delta: 3 },
          { attr: 'stress', delta: 2 },
        ],
      },
      {
        text: '挨个约老友单独喝茶',
        summary: '{name}这个月见了五位老友，每一壶茶都聊到了凉',
        effects: [
          { money: -1000 },
          { attr: 'social', delta: 3 },
          { relation: { kind: 'friend', deltaCloseness: 8 } },
        ],
      },
      {
        text: '婉拒，一个人清静清静',
        summary: '{name}没去聚会，窗外的夕阳很好，屋里有点静',
        effects: [
          { attr: 'happiness', delta: 1 },
          { attr: 'social', delta: -2 },
        ],
      },
    ],
  },

  // ── 第 7 轮：背景/特质门控事件（让不同开局遇到不同的事件与选项）──
  {
    id: 'youth_family_bankroll',
    category: 'money',
    title: '家里的「安排」',
    text: '饭桌上，家里人放下筷子说：「我们也不是要安排你的一生，但这笔钱和人脉，你随时可以用。」{name}知道，这句话只对自家孩子说。',
    minAge: 19,
    maxAge: 26,
    weight: 10,
    once: true,
    requires: { tagsAny: ['has_connections', 'bg_wealthy'] },
    choices: [
      {
        text: '接受这笔钱，去做自己想做的事',
        summary: '{name}收下了家里支持的 30,000 元',
        effects: [
          { money: 30000 },
          { attr: 'happiness', delta: 2 },
          { attr: 'stress', delta: -2 },
        ],
        addTags: ['family_backed'],
      },
      {
        text: '只要人脉，不要钱：请家里引荐一位前辈',
        summary: '前辈的一通电话，让{name}少走了两年弯路',
        effects: [
          { attr: 'social', delta: 6 },
          { attr: 'smarts', delta: 2 },
        ],
        addTags: ['has_mentor'],
      },
      {
        text: '婉拒：自己的路自己走',
        summary: '{name}把话说得很清楚，家里人愣了一下，然后笑了',
        effects: [
          { attr: 'happiness', delta: 4 },
          { attr: 'smarts', delta: 2 },
          { attr: 'stress', delta: 2 },
        ],
        addTags: ['self_made'],
      },
    ],
  },
  {
    id: 'youth_home_remittance',
    category: 'relationship',
    title: '妈妈塞过来的钱',
    text: '离家（或通电话）的时候，妈妈把一个塑料袋塞过来，里面是一卷叠得整整齐齐的钱：「拿着。别让妈白辛苦。」{name}的喉咙一下子堵住了。',
    minAge: 19,
    maxAge: 26,
    weight: 10,
    once: true,
    requires: { tagsAny: ['bg_rural', 'bg_single_parent'] },
    choices: [
      {
        text: '死活不收，反过来塞给她两百',
        summary: '{name}把钱按回妈妈手里，转身时眼睛红了',
        effects: [
          { money: -200 },
          { attr: 'happiness', delta: 3 },
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'parent', deltaCloseness: 8 } },
        ],
        addTags: ['family_duty'],
      },
      {
        text: '收下一半，剩下的一半按回去',
        summary: '{name}收下了 500 元，也收下了妈妈的牵挂',
        effects: [
          { money: 500 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'parent', deltaCloseness: 5 } },
        ],
        addTags: ['took_family_money'],
      },
      {
        text: '含着泪收下全部',
        summary: '{name}收下 1,000 元，心里又暖又愧',
        effects: [
          { money: 1000 },
          { attr: 'happiness', delta: -1 },
          { relation: { kind: 'parent', deltaCloseness: 3 } },
        ],
        addTags: ['took_family_money'],
      },
    ],
  },
  {
    id: 'youth_night_stall',
    category: 'life',
    title: '周末的夜市摊位',
    text: '朋友半夜发消息：「周末夜市有个摊位空出来，一起摆吗？卖什么都行，就是得先押摊位费。」{name}盯着天花板盘算了一会。',
    minAge: 18,
    maxAge: 30,
    weight: 8,
    cooldown: 4,
    choices: [
      {
        text: '入伙！摊位费一人一半',
        summary: '{name}的摊位没赚到大钱，但认识了半个夜市的人',
        effects: [
          { money: -1000 },
          { attr: 'social', delta: 4 },
          { attr: 'happiness', delta: 3 },
          { attr: 'stress', delta: 2 },
        ],
      },
      {
        text: '只去帮忙吆喝两个晚上',
        summary: '{name}喊哑了嗓子，钱包没动，倒交了个新朋友',
        effects: [
          { attr: 'social', delta: 3 },
          { attr: 'happiness', delta: 2 },
        ],
      },
      {
        text: '算了，周末要留着充电',
        summary: '{name}合上书的时候有点羡慕朋友圈里的烟火气',
        effects: [
          { attr: 'smarts', delta: 2 },
          { attr: 'social', delta: -1 },
        ],
      },
      {
        text: '压上全部家当，进一批贵的赌一把',
        tooltip: '敢闯敢赌的人才会选：可能大赚，也可能血本无归',
        summary: '{name}进的那批货成了夜市最亮的摊——这次赌赢了',
        effects: [
          { money: -3000 },
          { attr: 'stress', delta: 4 },
          { attr: 'happiness', delta: 1 },
        ],
        delayed: [
          { years: 1, money: 7000, summary: '夜市押注的货款回笼，还赚了一笔' },
        ],
        requires: { tagsAll: ['risk_taker'] },
      },
    ],
  },
]
