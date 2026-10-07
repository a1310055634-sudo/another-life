// 第 124 轮（V7）：事件池扩容——新线互联动 10 枚。
// 每枚吃两条线的交点（资格门控取两条线标记/关系/状态的合取），全部 ≥2 选项、
// 金额口径一致、零支流。门控红线对照：创业 entrepreneur/心理 low_mood/育儿 parenting_active/
// 名声 minor_fame/遗嘱 will_mode_*/养老 elder_*/年关 home_for_ny/同事 colleague/手足 sibling。
import type { GameEvent } from '../../engine/types'

export const LINKUP_EVENTS: GameEvent[] = [
  {
    // 创业×婚姻：配偶对创业的态度。
    id: 'lk_spouse_venture',
    category: 'relationship',
    title: 'TA对这门生意的态度',
    text: '店里忙到打烊，TA来送饭，看着满屋的货箱欲言又止。创业这半年，TA的态度，{name}一直想听个明白。',
    minAge: 28,
    maxAge: 48,
    cooldown: 4,
    weight: 10,
    requires: { tagsAny: ['entrepreneur'], relationKinds: ['spouse'] },
    choices: [
      {
        text: '摊开账本，TA看完说「算我一个」',
        summary: 'TA连夜做了张进货表。两口子守店到深夜，累，但从未这么齐心地累过',
        effects: [
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'spouse', deltaCloseness: 2 } },
        ],
      },
      {
        text: 'TA担心，两人约定一条止损线',
        summary: '「亏到这里为止。」TA在纸上画了条线。有了这条线，{name}反而敢放手干了',
        effects: [
          { attr: 'stress', delta: -1 },
          { relation: { kind: 'spouse', deltaCloseness: 1 } },
        ],
      },
    ],
  },
  {
    // 创业×年关：创业者的年关。
    id: 'lk_venture_ny',
    category: 'life',
    title: '创业后的第一个年',
    text: '所有人都在问{name}：「店怎么样了？」——回不回家，这一年有了新的分量。',
    minAge: 26,
    maxAge: 50,
    cooldown: 4,
    weight: 10,
    requires: { tagsAny: ['entrepreneur'] },
    choices: [
      {
        text: '关门三天，也要回家',
        tooltip: '路费与年货 1,500 元',
        summary: '歇业告示贴出去，{name}回了家。亲戚们的追问五花八门，但母亲的年夜饭一入口，什么都值了',
        effects: [
          { money: -1500 },
          { attr: 'happiness', delta: 1 },
          { attr: 'stress', delta: -1 },
        ],
      },
      {
        text: '留守看店，春节正是旺季',
        summary: '{name}除夕夜在店里贴了副春联。营业额是平时的三倍——有些年，是在算盘声里过的',
        effects: [
          { money: 1500 },
          { attr: 'stress', delta: 2 },
        ],
      },
    ],
  },
  {
    // 心理×职场：情绪低谷期的职场日。
    id: 'lk_mood_work',
    category: 'life',
    title: '低谷期的上班路',
    text: '情绪沉在谷底的日子里，办公室的灯照旧要开。{name}工位上堆着活，心里空着一块——这一天怎么过，可以有讲究。',
    minAge: 24,
    maxAge: 55,
    cooldown: 4,
    weight: 10,
    requires: { tagsAny: ['low_mood'], careerKinds: ['employed'] },
    choices: [
      {
        text: '请半天假，去公园坐坐',
        summary: '{name}跟主管直说了「状态不好，想歇半天」。阳光落在长椅上的时候，呼吸顺了一些',
        effects: [{ attr: 'stress', delta: -2 }],
      },
      {
        text: '照常上班，只做最顺手的活',
        summary: '{name}把难题都往后排，先清了三件小事。清单划掉的那一刻，好像找回了一点掌控',
        effects: [
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: 1 },
        ],
      },
    ],
  },
  {
    // 育儿×城市：孩子在大城市长大。
    id: 'par_kid_city',
    category: 'life',
    title: '在大城市长大的孩子',
    text: '周末的博物馆里，孩子趴在玻璃柜前不肯走。{name}忽然意识到：这孩子的童年，是地铁、展馆和城市公园拼起来的——和自己的童年完全两个样。',
    minAge: 30,
    maxAge: 48,
    cooldown: 4,
    weight: 10,
    requires: { tagsAny: ['parenting_active'], relationKinds: ['child'], cityIn: ['metro'] },
    choices: [
      {
        text: '办张年卡，周末就往展馆跑',
        tooltip: '年卡 800 元',
        summary: '孩子能背出每个展厅的明星展品。{name}的工资卡在瘦，孩子的眼睛在亮',
        effects: [
          { money: -800 },
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'child', deltaCloseness: 2 } },
        ],
      },
      {
        text: '视频给老家祖辈「展览」一下',
        summary: '镜头前孩子讲得眉飞色舞，老家的祖辈连连点头：「这娃，见世面了。」两代人的距离，被一块屏幕拉近',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    // 同事×名声：同事刷到你的号。
    id: 'wl_col_fame',
    category: 'career',
    title: '同事刷到了你的号',
    text: '茶水间里，同事举着手机凑过来：「这个博主怎么跟你长得一模一样？——等等，就是你啊！」账号的事，在公司传开了。',
    minAge: 22,
    maxAge: 50,
    cooldown: 4,
    weight: 10,
    requires: { tagsAny: ['minor_fame'], relationKinds: ['colleague'] },
    choices: [
      {
        text: '大方承认，合了个影',
        summary: '合影发进部门群，点赞刷了屏。主管路过看了一眼，留下一句「下班别耽误」——也算默许了',
        effects: [{ attr: 'happiness', delta: 2 }],
      },
      {
        text: '轻描淡写：「玩玩而已」',
        summary: '{name}把话题引回了工作。但午休时，TA凑过来说了句悄悄话：「那条探店视频，我转给我对象了，她关注了。」',
        effects: [{ relation: { kind: 'colleague', deltaCloseness: 2 } }],
      },
    ],
  },
  {
    // 遗嘱×手足：立遗嘱后的手足饭桌。
    id: 'will_sibling_table',
    category: 'life',
    title: '老屋的饭桌',
    text: '回老家办事，兄弟姐妹难得凑齐一桌。酒过三巡，{name}想起自己签了字的遗嘱——这份安排，说，还是不说？',
    minAge: 60,
    maxAge: 77,
    once: true,
    weight: 9,
    requires: {
      tagsAny: ['will_mode_even', 'will_mode_weighted', 'will_mode_grandchild'],
      relationKinds: ['sibling'],
    },
    choices: [
      {
        text: '摊开说，把自己的安排讲明白',
        summary: '桌上安静了一阵，大哥先开了口：「你想得周全。」一件事摊在阳光下，反倒谁的心里都不存疙瘩了',
        effects: [
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'sibling', deltaCloseness: 3 } },
        ],
      },
      {
        text: '烂在肚子里，说早了伤和气',
        summary: '{name}把话就着酒咽了下去。有些安排，也许永远不必说出口——但今夜的酒，喝得有点沉',
        effects: [{ attr: 'stress', delta: 1 }],
      },
    ],
  },
  {
    // 养老×手足：养老方式落地后的手足往来。
    id: 'elder_sibling_care',
    category: 'life',
    title: '手足的探望',
    text: '换了个住法之后，兄弟姐妹的探望成了固定节目。TA带着一兜子水果站在门口，进门先打量了一圈：「住这儿，习惯吗？」',
    minAge: 60,
    maxAge: 75,
    cooldown: 4,
    weight: 10,
    requires: {
      tagsAny: ['elder_home', 'elder_institution'],
      relationKinds: ['sibling'],
    },
    choices: [
      {
        text: '带着TA四处转转，说说近况',
        summary: '从伙食讲到棋友，TA听完放了心，临走留下两千块钱：「买点爱吃的。」推让半天，还是收下了',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'sibling', deltaCloseness: 2 } },
        ],
      },
      {
        text: '电话里把养老分工商量明白',
        summary: '谁出钱、谁跑腿、谁常来看——三件事摆上桌面，一件件说定。话说明白了，情分反而更近',
        effects: [
          { attr: 'stress', delta: -1 },
          { relation: { kind: 'sibling', deltaCloseness: 1 } },
        ],
      },
    ],
  },
  {
    // 性格×创业：关门之后的自我整理（biz_failed∧persona_shifted 双标记合取）。
    id: 'persona_after_close',
    category: 'life',
    title: '把教训装订成册',
    text: '关店满一年了。{name}整理仓库 leftovers 时翻出一摞便签——进货的心得、看走眼的客户、差三天就回款的订单。变了性子的{name}，决定把这些留下来。',
    minAge: 30,
    maxAge: 55,
    once: true,
    weight: 10,
    requires: { tagsAll: ['biz_failed', 'persona_shifted'] },
    choices: [
      {
        text: '整理成一册《开店笔记》',
        summary: '便签按时间排好，装订成册。放上网盘前{name}通读了一遍——字字是学费，页页是本事',
        effects: [{ attr: 'smarts', delta: 2 }],
      },
      {
        text: '把当年的名片盒重新摆上书架',
        summary: '{name}把名片盒擦干净摆上书架——不是要回头，是提醒自己：那些没走通的路，也开过花',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    // 年关×血脉：带着孩子回老家过年。
    id: 'ny_blood_child',
    category: 'life',
    title: '带娃认亲',
    text: '回老家的车上，孩子一路问：「三舅公是谁？二姨奶住哪儿？」{name}翻开手机里存的全家福，一张一张讲——这是血脉的地图，该传下去了。',
    minAge: 28,
    maxAge: 58,
    cooldown: 3,
    weight: 10,
    requires: { tagsAny: ['home_for_ny'], relationKinds: ['child'] },
    choices: [
      {
        text: '挨家拜年，教孩子喊对每声称呼',
        summary: '一圈走完，孩子已经能自己分清三舅公和二姨奶。老人拉着孩子的手不放——血脉这个词，今天有了体温',
        effects: [
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'child', deltaCloseness: 2 } },
        ],
      },
      {
        text: '让孩子和堂亲玩去，大人们聊天',
        summary: '院里追跑的身影和当年{name}一模一样。不教也会——血脉这种东西，玩着玩着就熟了',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    // 邻里×养老：居家养老后对门的搭把手。
    id: 'nb_elder_help',
    category: 'life',
    title: '对门的年轻人',
    text: '米袋子三十斤，{name}在楼道里歇了第三回。对门的年轻人下楼倒垃圾，看见这一幕，二话不说把袋子提了起来：「叔/婶，几楼？」',
    minAge: 62,
    maxAge: 77,
    cooldown: 4,
    weight: 10,
    requires: { tagsAny: ['elder_home'], relationKinds: ['neighbor'] },
    choices: [
      {
        text: '道了谢，回头送了锅刚出锅的饺子',
        summary: '饺子还烫着就端了过去。年轻人连说不用不用，第二天电梯里，招呼打得比往常响亮——远亲不如近邻，是处出来的',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'neighbor', deltaCloseness: 2 } },
        ],
      },
      {
        text: '拉着TA教了两下手机支付，「以后网购送上门」',
        summary: '年轻人教得耐心，{name}学得认真。一周后第一单米面送到家——从这天起，楼道里的歇脚回，少了很多',
        effects: [
          { attr: 'smarts', delta: 1 },
          { relation: { kind: 'neighbor', deltaCloseness: 1 } },
        ],
      },
    ],
  },
]
