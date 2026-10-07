// 第 69 轮：宠物真实化事件线——衰老与离别（领养入口已在 basic/late 既有事件，
// birthAge 盖章由引擎 relations.ts 第 69 轮扩展自动落账）。
// 资格全部读真实状态：在册宠物（relationKinds: pet）、衰老（childStage kind:'pet'
// atLeast:10，复用子女年龄推算）、离世哀伤（grief_pet 标记：到龄离世年度结算授予、
// 泛化循环 2 年到期消退）。全部 ≥2 有效选项；金额数百档与 vet/善后物价一致。
import type { GameEvent } from '../../engine/types'

export const PET_EVENTS: GameEvent[] = [
  // ── 疫苗与生病：养宠的年度开销与揪心 ──
  {
    id: 'pet_vet_visit',
    category: 'life',
    title: '疫苗本上的新一行',
    text: 'TA蔫了一整天，晚饭都没碰。{name}抱着TA跑了趟宠物医院——好在只是小毛病。疫苗本上又添了一行，账单比想象中厚，心放下了。',
    minAge: 20,
    maxAge: 70,
    cooldown: 3,
    weight: 9,
    requires: { relationKinds: ['pet'] },
    choices: [
      {
        text: '全套检查加疫苗，一样不落',
        summary: '兽医说TA很健康。{name}出门时，步子都轻了',
        effects: [
          { money: -800 },
          { relation: { kind: 'pet', deltaCloseness: 2 } },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '只看急症，疫苗下次再说',
        summary: '病看好了，疫苗本上的旧针还撑得了半年',
        effects: [{ money: -400 }],
      },
    ],
  },
  // ── 陪伴：情绪低位时，TA比谁都先察觉 ──
  {
    id: 'pet_companion',
    category: 'relationship',
    title: 'TA好像知道',
    text: '{name}窝在沙发上不想动，TA踱过来，把下巴搁在{name}的膝盖上，尾巴有一搭没一搭地扫着。谁也没说话——也不需要说话。',
    minAge: 20,
    maxAge: 65,
    cooldown: 3,
    weight: 11,
    requires: { relationKinds: ['pet'], maxAttr: { happiness: 45 } },
    choices: [
      {
        text: '带TA出去遛弯，晒晒太阳',
        summary: '太阳很好，TA在草地上打滚，{name}看了很久',
        effects: [
          { attr: 'happiness', delta: 5 },
          { attr: 'health', delta: 1 },
          { relation: { kind: 'pet', deltaCloseness: 3 } },
        ],
      },
      {
        text: '就这样抱着发会儿呆',
        summary: 'TA的呼吸声很慢，{name}的心跳也慢了下来',
        effects: [
          { attr: 'happiness', delta: 3 },
          { attr: 'stress', delta: -2 },
        ],
      },
    ],
  },
  // ── 衰老照护：宠物满 10 岁（childStage kind:'pet' 复用子女年龄推算）──
  {
    id: 'pet_aging_care',
    category: 'life',
    title: 'TA也开始老了',
    text: 'TA跳上沙发要助跑两步了，睡得越来越多，眼睛有点浑浊。宠物医生说TA进了老年期。{name}摸着TA的背——什么时候开始的呢。',
    minAge: 30,
    maxAge: 77,
    cooldown: 2,
    weight: 11,
    requires: { childStage: { kind: 'pet', atLeast: 10 } },
    choices: [
      {
        text: '换老年粮，铺上软垫子',
        summary: '窝换到了暖气旁，TA挑了个太阳晒得到的位置',
        effects: [
          { money: -600 },
          { relation: { kind: 'pet', deltaCloseness: 4 } },
        ],
      },
      {
        text: '推掉一次出差，在家陪TA',
        summary: '那几天TA总跟着{name}，从厨房跟到阳台',
        effects: [
          { attr: 'stress', delta: 1 },
          { relation: { kind: 'pet', deltaCloseness: 6 } },
        ],
      },
      {
        text: 'TA睡得多了，随TA去吧',
        summary: '日子照旧，只是饭盆旁的水碗换水勤了',
        effects: [{ relation: { kind: 'pet', deltaCloseness: -2 } }],
      },
    ],
  },
  // ── 离别与再领养：grief_pet 哀伤期内的抉择（哀伤到期自然消退，此处主动收束）──
  {
    id: 'pet_farewell_choice',
    category: 'relationship',
    title: '饭盆还摆在墙角',
    text: 'TA走后，家里安静得能听见时钟走字。饭盆没舍得收，扫帚从TA睡过的地方绕着走。朋友说：要不，再养一只？{name}还没想好。',
    minAge: 24,
    maxAge: 77,
    cooldown: 2,
    weight: 14,
    priority: 2,
    requires: { tagsAll: ['grief_pet'] },
    choices: [
      {
        text: '把照片装进相框，摆在窗台',
        summary: '阳光每天都会照到那个相框——像TA还在晒太阳',
        effects: [{ attr: 'happiness', delta: 4 }],
      },
      {
        text: '去收容所，领一只新的回家',
        tooltip: '不是替代，是把没给完的爱接着给',
        summary: '新的小家伙怯生生探出头，饭盆终于又有了动静',
        effects: [
          { money: -800 },
          { attr: 'happiness', delta: 2 },
          { relation: { kind: 'pet', add: true, addAnother: true, closeness: 45 } },
        ],
        // pet_owner 为终身标记不移除（basic 收养事件以 tagsNone pet_owner 防重复领养；
        // 本支直接 add 新宠物，无需重开门）
        removeTags: ['grief_pet'],
      },
      {
        text: '再说说吧，现在还不行',
        summary: '有些空位，需要时间才能允许别人填上',
        effects: [{ attr: 'happiness', delta: -2 }],
      },
    ],
  },
  // ── 第 102 轮：宠物大病抉择（撞题扫描：7 处「手术/住院」命中全属人或父母，宠物侧零占用）──
  {
    id: 'pet_major_care',
    category: 'life',
    title: '化验单上的那个名字',
    text: '医生把化验单转过来，念了两行，念第二行的时候放慢了。TA不懂，但{name}听懂了——TA看{name}的表情，就全明白了。',
    minAge: 25,
    maxAge: 77,
    cooldown: 8,
    weight: 8,
    priority: 2,
    requires: { relationKinds: ['pet'] },
    choices: [
      {
        text: '倾家荡产也要治',
        tooltip: '不指望治好，只想让TA少难受一点',
        summary: '接下来三个月{name}的作息跟着TA的输液时间对齐了',
        effects: [
          { money: -3000 },
          { attr: 'health', delta: -1 },
          { attr: 'happiness', delta: -2 },
          { relation: { kind: 'pet', deltaCloseness: 3 } },
        ],
      },
      {
        text: '保守治疗，让TA舒服为主',
        summary: '止痛药按时喂，TA大部分时间睡得很安稳',
        effects: [
          { money: -900 },
          { attr: 'happiness', delta: -1 },
        ],
      },
      {
        text: '不想让TA受罪',
        summary: '兽医问「您考虑过吗」的时候，{name}点了头',
        effects: [
          { money: -600 },
          { attr: 'happiness', delta: -4 },
          { attr: 'stress', delta: 2 },
        ],
        addTags: ['grief_pet'],
      },
    ],
  },
  // ── 第 102 轮：宠物与家人的分歧（撞题扫描零命中：掉毛/房东/家人不让全池 0 命中）──
  {
    id: 'pet_family_dispute',
    category: 'life',
    title: 'TA到底养不养',
    text: '「掉得满地都是。」「房东说了不让养。」「我妈过敏。」三句话从三个方向压过来。{name}低头看TA——TA正缩在门口，等着这个家的判决。',
    minAge: 24,
    maxAge: 45,
    cooldown: 6,
    weight: 8,
    requires: { relationKinds: ['pet'] },
    choices: [
      {
        text: '带TA去做绝育，装纱窗，把问题一个个解决掉',
        summary: '一个月后家里多了三个滤网，TA也学会了不往沙发缝里钻',
        effects: [
          { money: -1500 },
          { attr: 'stress', delta: 1 },
          { attr: 'social', delta: 1 },
          { relation: { kind: 'pet', deltaCloseness: 5 } },
        ],
      },
      {
        text: '硬扛，谁的意见都不听',
        summary: '矛盾还在，但TA留下了',
        effects: [
          { attr: 'stress', delta: 3 },
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'pet', deltaCloseness: 3 } },
        ],
      },
      {
        text: '送走，找个愿意接手的人家',
        summary: '临走前TA回头看了三次，直到看不见为止',
        effects: [
          { attr: 'happiness', delta: -4 },
          { attr: 'social', delta: 1 },
        ],
        addTags: ['grief_pet'],
      },
    ],
  },
  {
    id: 'pet_vet_checkup',
    category: 'life',
    title: '毛孩子的体检单',
    text: '它最近老趴着，饭量也小了。{name}翻出宠物医院的会员卡——体检这事，拖了一年又一年，不能再拖了。',
    minAge: 20,
    maxAge: 70,
    cooldown: 4,
    weight: 9,
    requires: { relationKinds: ['pet'] },
    choices: [
      {
        text: '全面体检，一次做齐',
        tooltip: '1,200 元',
        summary: '指标单子上几个箭头，医生说「老了，正常，注意饮食」。{name}抱着它出来，心里那块石头落了地',
        effects: [
          { money: -1200 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '先观察几天，调整伙食',
        summary: '{name}按医生的线上建议换了粮、控制了零食。三天后它追着球跑起来——虚惊一场，也长了记性',
        effects: [{ attr: 'stress', delta: 1 }],
      },
    ],
  },
  {
    id: 'pet_rainy_walk',
    category: 'life',
    title: '雨天的遛弯',
    text: '窗外下着淅淅沥沥的小雨，它叼着牵引绳在门口转圈——狗子的生物钟不会下雨休班。去，还是不去？',
    minAge: 20,
    maxAge: 70,
    cooldown: 3,
    weight: 8,
    requires: { relationKinds: ['pet'] },
    choices: [
      {
        text: '穿上雨衣，照溜不误',
        summary: '雨衣是网购的荧光黄，它在水洼里踩得欢快。回家俩「落汤鸡」一起被擦毛——它抖毛，{name}擦手',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
      {
        text: '改玩室内捡球，雨伞收起',
        summary: '客厅变球场，沙发变看台。它把球叼回来放在{name}脚边，尾巴摇出了残影——雨天的快乐，室内也能凑齐',
        effects: [{ relation: { kind: 'pet', deltaCloseness: 1 } }],
      },
    ],
  }
]
