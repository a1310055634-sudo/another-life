// 第 30 轮：结局后记。
// 13 个结局各配 2～3 个变体后记，素材只读真实状态（姓名/年龄/履历/关系/成就/财务/标记），
// 绝不引用未发生的事——「」内只允许出现真实履历标题或已解锁成就名（round30.test 全变体锁定）。
// 变体按 seed 确定性选取：同一局稳定复现，不同局各不相同；
// 空履历/无关系/疏远/特殊姓名等对照状态不露 undefined、原始 tag 或占位符。
// 本模块只产出文字（string[]），布局与样式由 EndingPage 用既有类负责。
import type { GameState } from './types'
import { ACHIEVEMENTS } from './achievements'

/** 从真实状态提炼的后记素材（只读事实，不含任何编造内容） */
interface LifeFacts {
  name: string
  age: number
  /** 在世配偶名；无配偶时取在世恋人名；都没有为 null */
  mateName: string | null
  /** 配偶（非恋人）时为 true，决定称呼用「伴侣」还是「恋人」 */
  mateIsSpouse: boolean
  kidNames: string[]
  petNames: string[]
  parentsAlive: boolean
  /** 是否还有在世的伴侣/孩子/宠物 */
  hasCompany: boolean
  /** 「伴侣周宁、孩子周小雨」式的同行者短语；空串表示无人相伴 */
  company: string
  achNames: string[]
  /** 最后 3 条关键履历（时间正序），排除成就条目 */
  keyMoments: Array<{ age: number; title: string }>
  /** 晋升/转行履历的最后头衔；没有则取当前职衔；都没有为 null */
  peakTitle: string | null
  everEmployed: boolean
  /** money ≥ 50 万 */
  rich: boolean
  /** money ≥ 0（不负债） */
  solvent: boolean
  /** 传承标记三件套 */
  memoir: boolean
  mentor: boolean
  craftLegacy: boolean
}

function extractFacts(s: GameState): LifeFacts {
  const spouse = s.relations.find((r) => r.kind === 'spouse' && r.alive)
  const partner = s.relations.find((r) => r.kind === 'partner' && r.alive)
  const kids = s.relations.filter((r) => r.kind === 'child' && r.alive).map((r) => r.name)
  const pets = s.relations.filter((r) => r.kind === 'pet' && r.alive).map((r) => r.name)
  const mate = spouse ?? partner ?? null
  const companyParts: string[] = []
  if (mate) companyParts.push(`${spouse ? '伴侣' : '恋人'}${mate.name}`)
  if (kids.length > 0) companyParts.push(`孩子${kids.join('、')}`)
  if (pets.length > 0) companyParts.push(`宠物${pets.join('、')}`)
  const keyMoments = s.history
    .filter((h) => h.key && h.eventId !== 'ach')
    .slice(-3)
    .map((h) => ({ age: h.age, title: h.title }))
  const promoted = s.history.filter(
    (h) => h.key && (h.summary.includes('升') || h.summary.includes('转行')),
  )
  const peakTitle =
    promoted.length > 0
      ? promoted[promoted.length - 1].title
      : s.career.kind === 'employed'
        ? s.career.jobTitle
        : null
  const achNames = s.achievements
    .map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name)
    .filter((n): n is string => Boolean(n))
  return {
    name: s.name,
    age: s.age,
    mateName: mate?.name ?? null,
    mateIsSpouse: Boolean(spouse),
    kidNames: kids,
    petNames: pets,
    parentsAlive: s.relations.some((r) => r.kind === 'parent' && r.alive),
    hasCompany: companyParts.length > 0,
    company: companyParts.join('、'),
    achNames,
    keyMoments,
    peakTitle,
    everEmployed: s.tags.includes('ever_employed'),
    rich: s.money >= 500_000,
    solvent: s.money >= 0,
    memoir: s.tags.includes('memoir'),
    mentor: s.tags.includes('late_mentor'),
    craftLegacy: s.tags.includes('dream_legacy'),
  }
}

/** 把可选句片段拼成一段（忽略空片段） */
const parts = (...xs: Array<string | undefined>) => xs.filter(Boolean).join('')

type EpilogueVariant = (f: LifeFacts) => string[]

/**
 * 人生形态（第 49 轮）：后记定向分派的分类依据。
 * - family：有孩子或已婚（家庭线）
 * - career：独身但有职业成就证据（事业线）
 * - solo：无任何同行者（独身线）
 * - plain：其余组合（有恋人/宠物陪伴但未婚无孩等，兜底）
 */
export type LifeForm = 'family' | 'career' | 'solo' | 'plain'

export function classifyLifeForm(f: LifeFacts): LifeForm {
  if (f.kidNames.length > 0 || f.mateIsSpouse) return 'family'
  if (!f.hasCompany && f.peakTitle && (f.rich || f.everEmployed)) return 'career'
  if (!f.hasCompany) return 'solo'
  return 'plain'
}

/**
 * 变体规格（第 49 轮）：旧式为裸函数（全形态通用，34 段存量零改动）；
 * 新式带 forms 标签——只在匹配的人生形态下进入候选池（定向分派）。
 */
type EpilogueVariantSpec = EpilogueVariant | { forms?: LifeForm[]; write: EpilogueVariant }

function normalizeSpec(v: EpilogueVariantSpec): { forms?: LifeForm[]; write: EpilogueVariant } {
  return typeof v === 'function' ? { write: v } : v
}

/**
 * 13 结局 × 2～3 变体。每个变体自带对空状态的自适应：
 * 有人伴则念真名，无人伴则走独身句式，有履历/成就才引用。
 */
const EPILOGUES: Record<string, EpilogueVariantSpec[]> = {
  death_young: [
    (f) => [
      `${f.name}的人生，停在了${f.age}岁。有些故事写到一半就搁了笔——不是写的人不肯写，是命运先一步合上了书。`,
      parts(
        f.hasCompany
          ? `还记得${f.name}的人都还在：${f.company}。往后的岁月里，这个${f.age}岁的身影会一直住在他们心里。`
          : `还记得这个名字的人不多，但每一个都记得很真。`,
        f.keyMoments.length > 0
          ? `${f.keyMoments[f.keyMoments.length - 1].age} 岁那年「${f.keyMoments[f.keyMoments.length - 1].title}」的心气还没来得及铺开，就停在了最好的年纪。`
          : undefined,
      ),
    ],
    (f) => [
      `${f.age} 岁，对一段人生来说太短了。短到来不及兑现的许诺还攥在手心里，短到很多人只有在失去时才想起，自己有多在意这个年轻人。`,
      parts(
        f.hasCompany
          ? `${f.company}会把这份在意接着传下去——这是${f.name}留在世上最温热的部分。`
          : `没有惊天动地的遗产，只有一段认真活过的时光——它同样作数。`,
        f.achNames.length > 0
          ? `那枚「${f.achNames[0]}」，是这段短途人生亲手挣下的见证。`
          : undefined,
      ),
    ],
    // 第 49 轮定向变体：独身/事业线视角的英年早逝
    {
      forms: ['solo', 'career'],
      write: (f) => [
        `${f.age} 岁，故事停在半途。清单上还有很多计划，没能长成日子。`,
        parts(
          f.everEmployed
            ? `工资卡里的数字停在上个月——那是${f.name}给自己攒的、还没来得及花的第一笔自由。`
            : `这世界你来过，认真过，只是走得太急。`,
          f.peakTitle ? `工位上还留着做${f.peakTitle}时的那股认真劲。` : undefined,
          `往后的春天照常来，只是少了一个等它的人。`,
        ),
      ],
    },
  ],

  death_ill: [
    (f) => [
      `这些年，${f.name}的身体一直在替所有的硬扛记账。账攒满了，人也就歇下了。`,
      parts(
        f.hasCompany
          ? `${f.company}守在最后一段路上。`
          : `最后一段路，是自己一个人走完的。`,
        `如今不用再撑着了——好好休息这句话来得太迟，但终于可以说给你听。`,
      ),
    ],
    (f) => [
      `病历本越摞越高的时候，${f.name}还是那个摆摆手说没事的人。这一辈子扛惯了，最后也没学会喊疼。`,
      parts(
        f.hasCompany
          ? `${f.company}会替你记着：那些没喊出口的疼，他们都懂。`
          : `没人替你喊过疼，可这段硬扛的样子，值得被记得。`,
        f.everEmployed ? `几十年风里来雨里去，你从没让日子塌下来过。` : undefined,
      ),
    ],
    // 第 49 轮定向变体：家庭线视角的积劳成疾
    {
      forms: ['family'],
      write: (f) => [
        `身体垮下来的时候，${f.name}最先想到的不是自己——是${
          f.kidNames.length > 0
            ? `孩子${f.kidNames.join('、')}还没长大`
            : f.mateName
              ? `${f.mateName}往后的早饭`
              : '家里那盏灯'
        }。`,
        parts(
          `这些年把健康当作可以透支的东西，账单终究寄到了。`,
          f.hasCompany ? `别让家人只记住你疲惫的样子，他们记得的，还有你笑的样子。` : undefined,
        ),
      ],
    },
  ],

  dream_lived: [
    (f) => [
      `把热爱当梦的人很多，把它过成日子的很少。${f.name}是后一种——光是这件事，就已经赢过了大多数的人生。`,
      parts(
        f.hasCompany
          ? `${f.company}看着你眼里有光的样子，就是这段人生最好的注脚。`
          : `一个人的热爱也能把日子点亮——你证明了这件事。`,
        f.achNames.length > 0
          ? `成就墙上那枚「${f.achNames[0]}」，是这条路亲手挣来的勋章。`
          : undefined,
      ),
    ],
    (f) => [
      `别人算日子用年，你算日子用一件件做成的热爱。这样的活法很奢侈，${f.name}奢侈了一辈子，却没为此亏欠过谁。`,
      parts(
        f.rich ? `它还顺带让你攒下了殷实的家底，可见热爱与面包未必非得二选一。` : `账户里的数字不算惊人，但每天睁开眼有奔头、睡前心里是满的——这种富有，账本量不出来。`,
        f.hasCompany ? `${f.company}都见过你埋头做事的样子。` : undefined,
      ),
    ],
    (f) => [
      `多年以后，会有人站在你现在站过的地方，犹豫要不要把热爱过成日子。那时他们会想起：有人这样活过一辈子——不喧哗，但足够亮。`,
      parts(
        f.craftLegacy || f.mentor || f.memoir
          ? `你留下的东西还在被人翻阅、被人接住。`
          : `你没有留下大部头，只留下一条被自己踩实的路。`,
        f.hasCompany ? `${f.company}会替你把这个故事讲下去。` : undefined,
      ),
    ],
  ],

  legacy_flame: [
    (f) => [
      `人这一生能带走的很少，能留下的更少。${f.name}留下的，比大多数人一辈子攒下的都多——不是钱财，是被人接住的东西。`,
      f.memoir
        ? `那本写了一生的回忆录还在书架上，随手翻开一页，都是热的。`
        : f.mentor
          ? `你教过的手艺、带过的人，如今都独当一面了。`
          : `那门手艺有了传人，做得比你当年还稳。`,
    ],
    (f) => [
      `评价一个人的一生，可以看他位子多高，也可以看多少人因为他走成了更好的样子。${f.name}属于后一种。`,
      parts(
        f.hasCompany ? `${f.company}都受过你的照拂。` : undefined,
        `那些你认真待过的人，正在把你的那份认真，继续待给这个世界。`,
      ),
    ],
    (f) => [
      `生命有刻度，影响没有。${f.age} 岁之后，${f.name}留下的东西还在继续生长——这是连时间都拿不走的部分。`,
      parts(
        f.achNames.length > 0
          ? `成就墙上「${f.achNames[0]}」这一枚，后来的人看了也会懂：你把一辈子活成了柴火，烧完了，暖了很多年。`
          : `你把一辈子活成了柴火——烧完了，暖了很多年。`,
        f.hasCompany ? `${f.company}还在，你的故事就有人接着讲。` : undefined,
      ),
    ],
  ],

  family_hearth: [
    (f) => [
      parts(
        f.mateName ? `这个家里有一盏灯，为晚归的人亮了一辈子。${f.mateName}知道，` : `这个家里有一盏灯，为晚归的人亮了一辈子。`,
        `灯亮着，家就没散。`,
      ),
      parts(
        f.kidNames.length > 0 ? `孩子们${f.kidNames.join('、')}就在这盏灯下长大，` : undefined,
        `饭桌上的热气，是${f.name}一辈子最踏实的成就。`,
      ),
    ],
    (f) => [
      `没有大起大落的一辈子，把小事做成了仪式：谁过生日就煮面，谁不开心就添菜，年底一起算算这一年的账。`,
      parts(
        f.mateName ? `${f.mateName}和你把这些日子过了几十年。` : undefined,
        f.kidNames.length > 0
          ? `孩子们${f.kidNames.join('、')}记得这种踏实，将来也会把自己的家过成这样。`
          : `日子不轰烈，但每一格都是暖的。`,
      ),
    ],
    (f) => [
      parts(
        f.kidNames.length > 0
          ? `孩子们${f.kidNames.join('、')}是在这样的家里学会做人的：不靠大道理，靠一顿顿饭、一次次等门。`
          : `孩子是在这样的家里学会做人的：不靠大道理，靠一顿顿饭、一次次等门。`,
      ),
      parts(
        f.mateName ? `到最后，你和${f.mateName}还坐在同一张桌前。` : `到最后一程，家里的灯还亮着。`,
        `这就是把日子过成了最好的样子。`,
      ),
    ],
  ],

  solitude_rich: [
    (f) => [
      `没有伴侣的人生剧本，很多人替你惋惜过。只有${f.name}自己知道，一个人把日子过成什么样，才叫真的会过。`,
      parts(
        f.kidNames.length > 0
          ? `孩子们${f.kidNames.join('、')}常来看你，但屋子里安静的时候，你从不觉得空。`
          : f.petNames.length > 0
            ? `身边还有${f.petNames.join('、')}，可屋子里真正安静的时候，你也不觉得空。`
            : `屋子里安静的时候，你从不觉得空。`,
        `健康、心情、说走就走的一天——这些都攥在自己手里。`,
      ),
    ],
    (f) => [
      `热闹是别人的热闹，日子是自己的日子。${f.name}把这句话活了一辈子，活出了底气。`,
      f.achNames.length > 0
        ? `成就墙上那枚「${f.achNames[0]}」，是你送给自己的礼物。你送过自己很多礼物，最贵的那件叫自在。`
        : `你送过自己很多礼物，最贵的那件叫自在。`,
    ],
    (f) => [
      `这一生的圆满不由别人定义。没牵谁的手走到最后一程，但把每一年的自己照顾得很好。`,
      parts(
        f.rich ? `家底殷实，日子从容——都是一个人一分一分挣出来的。` : `手头不算宽裕，可心里一直是满的。`,
        `走到${f.age}岁回头看：没亏欠谁，也没亏待自己。一个人的一生，同样可以毫无遗憾。`,
      ),
    ],
  ],

  comeback: [
    (f) => [
      `从谷底往上爬的路，每一步都算数。${f.name}爬上来了——不是靠运气，是一年一年还出来的、挣出来的。`,
      parts(
        f.rich ? `如今不止是账平了，家底还攒厚了。` : `如今账不再是负数，`,
        `但最值钱的不是这个——是再遇到什么事，都知道自己能站起来。`,
      ),
    ],
    (f) => [
      `还清最后一笔债的那天，${f.name}没跟任何人说，只是给自己好好做了一顿饭。`,
      parts(
        `日子从此不一样了：每一分钱都花得踏实，每一觉都睡得着。`,
        f.hasCompany
          ? `${f.company}陪你走过了最难的那段，往后的每一天都是赚的。`
          : `最难的那段已经过去了，往后的每一天都是赚的。`,
      ),
    ],
    (f) => [
      `别人只看见你后来站稳的样子，没看见你在谷底数过的那些夜晚。没关系——自己知道就够了。`,
      f.achNames.length > 0
        ? `成就墙上「${f.achNames[0]}」那枚徽章，像是专为你这种人准备的：跌倒过再站起来的膝盖，比从来没摔过的更硬。`
        : `跌倒过再站起来的膝盖，比从来没摔过的更硬。`,
    ],
  ],

  wealth_free: [
    (f) => [
      `钱最怕的不是没有，是被它牵着走。${f.name}攒到了不缺钱的一天，也守住了替自己做主的日子。`,
      parts(
        f.hasCompany
          ? `财富没有代替陪伴——${f.company}就是证据。`
          : `财富没有代替生活——你想做的事，大多都做了。`,
        `钱始终只是工具，用它的那只手，一直是你自己的。`,
      ),
    ],
    (f) => [
      `账户上数字的背后，是一年一年的克制和算计：能花的钱很多，乱花的钱很少。`,
      parts(
        `到了${f.age}岁，这份克制连本带利地还给了你：不必看人脸色，不必为明天发愁。`,
        f.hasCompany ? `这份从容，${f.company}都沾了光。` : undefined,
      ),
    ],
    (f) => [
      `财务自由的真正含义，是想说不的时候可以说不。${f.name}用一辈子挣到了这个资格。`,
      `前提是你也没弄丢健康和心情——这是这局人生里最难的那道平衡题，你解出来了。`,
    ],
  ],

  pillar: [
    (f) => [
      `一副肩膀，两头都搭着担子：一头是老人的晚年，一头是孩子的明天。${f.name}挑了一辈子，没卸过肩。`,
      parts(
        f.parentsAlive ? `老人们晚年有着落，` : `老人们的晚年安顿好了，`,
        f.kidNames.length > 0 ? `孩子们${f.kidNames.join('、')}的路也铺出来了。` : `孩子的路也铺出来了。`,
        `自己累不累？累。后悔吗？这一生的账本上，没写这两个字。`,
      ),
    ],
    (f) => [
      `上有老下有小的那些年，最难的是没有人问你累不累。${f.name}也不等别人问——把日子过下去，就是回答。`,
      parts(
        f.mateName ? `好在有${f.mateName}搭把手。` : undefined,
        `如今回头看：老人安顿好了，孩子立住了。这两件事，是你一辈子的功绩。`,
      ),
    ],
    (f) => [
      `这个家的天，是${f.name}一辈子撑着的。天没塌过——这四个字，就是这份人生最重的分量。`,
      parts(
        f.solvent ? `没攒下大富贵，但账没欠、家没散、心没歪。` : `没攒下大富贵，但家没散、心没歪。`,
        f.hasCompany ? `${f.company}都在——这就是柱子撑起来的东西。` : undefined,
      ),
    ],
  ],

  labor_worn: [
    (f) => [
      `一辈子没停过手：年轻时挣前程，中年时挣口粮，老了还惦记着别拖累人。${f.name}这一生，是忙出来的。`,
      parts(
        `委屈吗？委屈。可日子就是这样一拳一脚打出来的。`,
        f.hasCompany ? `${f.company}的安稳里，有你大半辈子的力气。` : undefined,
      ),
    ],
    (f) => [
      `没享过什么清福，福气都变成了别人的踏实。这样的活法不体面吗？不——它是这世上最结实的体面。`,
      parts(
        f.achNames.length > 0 ? `「${f.achNames[0]}」那枚徽章，是汗水里捞出来的。` : undefined,
        `歇下吧。这一辈子，你对得起自己的每一天。`,
      ),
    ],
    // 第 49 轮定向变体：家庭线视角的劳碌半生
    {
      forms: ['family'],
      write: (f) => [
        `劳碌了半辈子，肩上的担子最后传给了${
          f.kidNames.length > 0 ? `孩子${f.kidNames.join('、')}` : '下一辈人'
        }。`,
        parts(
          f.mateName
            ? `${f.mateName}总说等你闲下来一起去看看海——那张票，终究没有兑。`
            : undefined,
          f.hasCompany
            ? `但一家人整整齐齐走过风雨，这份劳碌值不值，答案就在他们身上。`
            : `日子是紧了点，脚步一直没停过。`,
        ),
      ],
    },
  ],

  debt_shadow: [
    (f) => [
      `账本合上的时候，还差几页没还完。${f.name}这一生不算失败——只是欠条比告别多留了片刻。`,
      f.hasCompany
        ? `${f.company}记得的不是那些数字，是你还债时没弯下去的腰。债是身外的，人是自己的。`
        : `数字记不完一个人。能记完的，是你一直没放弃的样子——债是身外的，人是自己的。`,
    ],
    (f) => [
      `人这一生，账能欠，心不能欠。${f.name}欠着钱，没欠过良心——这是谁也收不走的清白。`,
      `下辈子记得早点松手，别什么都自己扛。这一局，辛苦了。`,
    ],
    // 第 49 轮定向变体：独身线视角的债务阴影
    {
      forms: ['solo'],
      write: (f) => [
        `一个人的债务，是一个人的长夜。${f.name}没让任何人替自己分担过一分。`,
        parts(
          `或许正因如此，这份沉重才格外诚实——借来的每一笔都记在自己名下，爬出的每一步也都算数。`,
          f.solvent ? `账终于算平了，虽然晚了一些。` : `夜还长，但天总会亮。`,
        ),
      ],
    },
  ],

  renowned: [
    (f) => [
      `热搜来来去去，但${f.name}的名字留下来了。`,
      parts(
        f.hasCompany ? `镜头外的家人和${f.company}，是被流量遮住才看得清的锚。` : `镜头外没有别人，但${f.name}早已学会和自己相处。`,
        f.achNames.length > 0 ? `成就墙上那 ${f.achNames.length} 枚徽章，是比播放量更硬的注脚。` : undefined,
      ),
    ],
    (f) => [
      `从第一条随手发的视频到百万人关注，${f.name}用了半辈子学会一件事：热闹是别人的，作品是自己的。`,
      parts(
        f.solvent ? `好在钱没乱花——流量退潮的时候，日子照常往前。` : `流量退潮得比想象中快，账单留了下来。`,
      ),
    ],
  ],
  philanthropist: [
    (f) => [
      `${f.name}这辈子攒下的东西，最后大多流回了人海。`,
      parts(
        f.rich ? `资产簿上依然体面，但真正让${f.name}睡得踏实的，是那些以${f.name}命名的书桌和病床。` : `捐出去的不是巨款，是心意——受助的人记得就好。`,
        f.kidNames.length > 0 ? `${f.kidNames.join('和')}记得父亲说过的话：钱要流动，人才活着。` : undefined,
      ),
    ],
    (f) => [
      `有人问${f.name}图什么。${f.name}说：我从人海里来，攒下的自然还给人海。`,
      parts(
        f.hasCompany ? `${f.company}都劝${f.name}收着点，${f.name}只是笑笑。` : undefined,
        `晚年的${f.name}不怎么提当年——账本上那一栏栏捐项，就是全部的答案。`,
      ),
    ],
  ],
  hermit: [
    (f) => [
      `${f.name}的后半生，是把热闹一件一件还回去。`,
      parts(
        f.rich ? `不缺钱的日子过成了山间的钟摆：日出而起，日落而息。` : undefined,
        `很少再有人来找${f.name}，但${f.name}找到了自己。`,
      ),
    ],
    (f) => [
      `最后几十年，${f.name}活得像一句留白。`,
      parts(
        f.petNames.length > 0 ? `陪着${f.name}的只有${f.petNames.join('和')}，够了。` : `没有告别仪式，没有讣告长文——这是${f.name}自己选的谢幕。`,
      ),
    ],
  ],
  quiet_life: [
    (f) => [
      `没有惊天动地的一生，可每一天都真实地过了：该吃的饭吃了，该爱的人爱了，该扛的事扛了。`,
      parts(
        f.hasCompany ? `${f.company}都在身边，平凡的日子过出了滋味。` : `你按自己的步调，把平凡的日子过出了滋味。`,
        f.achNames.length > 0 ? `成就墙上那 ${f.achNames.length} 枚徽章，都是细水长流攒下来的。` : undefined,
      ),
    ],
    (f) => [
      `平凡的另一面，叫稳妥。${f.age} 年，没有大起大落，也没让在乎的人受过颠簸——这本身就是本事。`,
      parts(
        f.mateName ? `和${f.mateName}的几十年，吵过也暖过。` : undefined,
        `回头看，一辈子最对的决定，就是把普通的日子认真过完了。`,
      ),
    ],
    (f) => [
      `这一生像一条不宽的河，没起过浪，但一直流到了海。${f.name}的路就是这样：不惊艳谁，但走通了。`,
      parts(
        f.keyMoments.length > 0
          ? `${f.keyMoments[f.keyMoments.length - 1].age} 岁那年的「${f.keyMoments[f.keyMoments.length - 1].title}」，是这条河上最大的一道弯。`
          : undefined,
        `往后的名字不会被很多人记得，但日子记得你的每一个认真。`,
      ),
    ],
  ],

  gray_dusk: [
    (f) => [
      `这一生存下了些东西——钱、经验，或一屋子旧物——却没能存下一份好心情。${f.name}的暮年，像一间家什齐全却没开灯的屋子。`,
      parts(
        `要是能重来，或许该早一点明白：攒下的日子是用来过的，不是用来熬的。`,
        f.hasCompany ? `${f.company}一直在，是你没腾出心情看他们。` : `屋子安静，其实门一直没锁。`,
      ),
    ],
    (f) => [
      `苦了一辈子，紧了一辈子，到了该享福的年纪，反而不会享了。这不是谁的错，是一代人共同的惯性。`,
      parts(
        `但日子到底还是过完了，账算得平，人站得直。`,
        f.hasCompany ? `${f.company}会记得你的好，比你记得的多。` : undefined,
        `放下吧，这一切都算过关了。`,
      ),
    ],
    // 第 49 轮定向变体：事业线视角的平凡暮年
    {
      forms: ['career'],
      write: (f) => [
        `没有轰轰烈烈的篇章，最后一页写的仍是${f.peakTitle ?? '一份普通的工作'}。`,
        parts(
          `可正是这份普通，撑起了${f.age}年的柴米油盐，也撑起了一个个平凡的黄昏。`,
          f.rich ? `存折上的数字不大不小，刚好够体面地告别。` : `日子不宽裕，但也从没欠过谁的。`,
        ),
      ],
    },
  ],
}

/** 全部结局的结局 ID（与 outcomes.ENDINGS 对齐） */
export const EPILOGUE_ENDING_IDS = Object.keys(EPILOGUES)

/** 该结局的后记变体数量 */
export function epilogueVariantCount(endingId: string): number {
  return EPILOGUES[endingId]?.length ?? 0
}

/** 空状态兜底：未知结局 ID 或表缺失时，仍给一段只陈述事实的通用后记 */
function genericEpilogue(f: LifeFacts): string[] {
  return [
    `${f.name}的一生走到了${f.age}岁。`,
    parts(
      f.hasCompany ? `一路上，${f.company}陪着你。` : `这一路大多是你自己走完的。`,
      f.peakTitle ? `翻到最后几页履历，还留着你做${f.peakTitle}的那些年。` : undefined,
      `故事到这里合上，认真活过的人生，不需要更多注解。`,
    ),
  ]
}

/** 构建某结局的全部后记变体（测试与核对用，含定向变体——白名单扫描覆盖全量） */
export function buildAllEndingEpilogues(state: GameState, endingId: string): string[][] {
  const set = EPILOGUES[endingId]
  const f = extractFacts(state)
  if (!set || set.length === 0) return [genericEpilogue(f)]
  return set.map(normalizeSpec).map((s) => s.write(f))
}

/**
 * 结局后记（EndingPage 用）：按人生形态定向分派 + seed 确定选取（第 49 轮）。
 * 候选池 = 全部通用变体 + 与本局人生形态匹配的定向变体；池内按 seed 取模——
 * 同一局稳定复现，不同局各不相同；家庭线人生可能抽到家庭向新变体，
 * 独身线人生则永远不会抽到（被池过滤，定向语义的直接保证）。
 */
export function buildEndingEpilogue(state: GameState, endingId: string): string[] {
  const set = EPILOGUES[endingId]
  const f = extractFacts(state)
  if (!set || set.length === 0) return genericEpilogue(f)
  const form = classifyLifeForm(f)
  const pool = set.map(normalizeSpec).filter((s) => !s.forms || s.forms.includes(form))
  const idx = ((state.seed % pool.length) + pool.length) % pool.length
  return pool[idx].write(f)
}
