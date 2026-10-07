// 同事与邻里（第 115 轮，V7）：关系网首次扩出家庭圈。
// 新关系种类：colleague（同事，衰减 2/年=朋友口径；散伙饭移出在册+ex_colleague 留痕）、
// neighbor（邻居，衰减 1/年=稳定关系口径）。入口事件用 relationKindsNone 防重复建立
// （引擎 add 对存活同类关系是 no-op，事件层再挡一道避免空转）；深化事件用 relationKinds
// 存在性门控。取名走 COLLEAGUE_NICKNAMES/NEIGHBOR_NICKNAMES 池（seed 确定具名）。
import type { GameEvent } from '../../engine/types'

export const WORKLIFE_EVENTS: GameEvent[] = [
  {
    // 入口·同事：在职+尚无同事关系。
    id: 'wl_office_deskmate',
    category: 'career',
    title: '工位隔壁的人',
    text: '隔壁工位那张脸，{name}看了大半年，说过的话不超过十句。今天加班等外卖的空档，对方忽然递过来一包辣条：「吃不吃？加点油。」',
    minAge: 22,
    maxAge: 55,
    cooldown: 4,
    weight: 12,
    requires: { careerKinds: ['employed'], relationKindsNone: ['colleague'] },
    choices: [
      {
        text: '接了。聊起来才知道就住隔壁小区',
        summary: '从辣条聊到房贷，从房贷聊到老家。下班时{name}知道了TA叫什么、工位椅子上那个靠垫是TA妈妈缝的',
        effects: [{ relation: { kind: 'colleague', add: true, closeness: 50 } }],
      },
      {
        text: '笑着摆摆手，先把报表赶完',
        summary: '辣条在桌上放到下班。第二天{name}路过隔壁工位，把一盒酸奶放下——有些认识，晚一拍也开始',
        effects: [
          { attr: 'stress', delta: -1 },
          { relation: { kind: 'colleague', add: true, closeness: 40 } },
        ],
      },
    ],
  },
  {
    // 入口·邻居：成年广谱，尚无邻居关系。
    id: 'wl_new_neighbor',
    category: 'life',
    title: '对门搬来的一家人',
    text: '对门响了一整天的搬家声，傍晚忽然安静了。{name}出门倒垃圾，正撞上对方抱着纸箱站在门口，进退两难。',
    minAge: 20,
    maxAge: 70,
    cooldown: 4,
    weight: 12,
    requires: { relationKindsNone: ['neighbor'] },
    choices: [
      {
        text: '搭把手，帮着抬了一趟',
        summary: '箱子不重，人情落了地。对方非塞给{name}两个自家蒸的包子，说以后就是对门了',
        effects: [{ relation: { kind: 'neighbor', add: true, closeness: 45 } }],
      },
      {
        text: '点头笑了笑，各自忙',
        summary: '后来在电梯里碰见，会点头，会替对方按住开门键。邻居嘛，慢慢处',
        effects: [{ relation: { kind: 'neighbor', add: true, closeness: 35 } }],
      },
    ],
  },
  {
    // 深化·同事：并肩加班。
    id: 'wl_late_night',
    category: 'career',
    title: '并肩的加班夜',
    text: '十点半的办公室只剩两盏灯。隔壁工位的TA伸了个懒腰，屏幕的光打在脸上：「第几版了？我这版改完就走。」',
    minAge: 23,
    maxAge: 50,
    cooldown: 3,
    weight: 10,
    requires: { careerKinds: ['employed'], relationKinds: ['colleague'] },
    choices: [
      {
        text: '一起等到末班车',
        summary: '站台的风很凉，两个人分了一副耳机。有些友情不靠饭局，靠的是一起熬过的夜',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'colleague', deltaCloseness: 3 } },
        ],
      },
      {
        text: 'TA被甩锅的时候，帮着顶了一下',
        summary: '会上{name}把时间线讲清楚了。散会后TA在楼梯间说了声谢，眼神里有话没说完',
        effects: [
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'colleague', deltaCloseness: 4 } },
        ],
      },
    ],
  },
  {
    // 深化·同事：名额竞争（二向，摩擦或成全都真实）。
    id: 'wl_one_seat',
    category: 'career',
    title: '只有一个名额',
    text: '部门公示栏贴出来那一刻，{name}和TA都看见了：外派培训，名额一个。两个人实力相当，资历相当，连沉默都相当。',
    minAge: 24,
    maxAge: 50,
    cooldown: 4,
    weight: 10,
    requires: { careerKinds: ['employed'], relationKinds: ['colleague'] },
    choices: [
      {
        text: '各凭本事，公平竞争',
        summary: '那一个月两个人说话都客气得发紧。结果出来那天，赢的人请了奶茶，输的人说「下次我请回来」——还是朋友，只是都憋着一口气',
        effects: [
          { attr: 'stress', delta: 3 },
          { relation: { kind: 'colleague', deltaCloseness: -2 } },
        ],
      },
      {
        text: '退一步，把机会让给TA',
        summary: '{name}找了理由撤了申报。TA知道后追到楼梯间，半天憋出一句「这顿饭我记下了」。有些账，朋友之间不算利息',
        effects: [
          { attr: 'happiness', delta: -1 },
          { relation: { kind: 'colleague', deltaCloseness: 4 } },
        ],
      },
    ],
  },
  {
    // 深化·同事：散伙饭（ex_ 语义裁决=移出在册+ex_colleague 留痕；另一支「常联系」保持衰减侵蚀的真实感）。
    id: 'wl_farewell_dinner',
    category: 'career',
    title: '散伙饭',
    text: '{name}离开公司那天，TA在群里喊了一嗓子：「今晚老地方，谁有空谁来。」到场的还是那几个老人。',
    minAge: 24,
    maxAge: 60,
    cooldown: 4,
    weight: 12,
    requires: { careerKinds: ['unemployed'], relationKinds: ['colleague'] },
    choices: [
      {
        text: '碰杯，正式道别',
        summary: '饭桌上把工牌的挂绳传着看了一圈。「以后常联系」说了很多遍——有些会兑现，有些就成了那句客气话',
        effects: [
          { attr: 'happiness', delta: -1 },
          { relation: { kind: 'colleague', remove: true } },
        ],
        addTags: ['ex_colleague'],
      },
      {
        text: '不道别。以后常联系，就不是散伙',
        summary: '{name}和TA单独加了下一场。不在一个公司了，朋友还能是朋友',
        effects: [{ relation: { kind: 'colleague', deltaCloseness: 2 } }],
      },
    ],
  },
  {
    // 深化·邻居：楼道闲聊（低门槛维护，对冲邻居 1/年衰减）。
    id: 'wl_hallway_chat',
    category: 'life',
    title: '楼道的闲聊',
    text: '垃圾房前遇上对门的TA，手里都拎着袋子。「吃了吗？」——楼道里的社交，从这三个字开始，也可以只到这三个字。',
    minAge: 20,
    maxAge: 70,
    cooldown: 2,
    weight: 10,
    requires: { relationKinds: ['neighbor'] },
    choices: [
      {
        text: '站着聊了一会儿',
        summary: '从垃圾分类聊到孩子考试，十分钟过去，袋子勒手都忘了。楼道里的十分钟，比朋友圈一年都实在',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'neighbor', deltaCloseness: 2 } },
        ],
      },
      {
        text: 'TA硬塞了一把自家种的青菜',
        summary: '推了两轮没推掉。晚上那盘清炒青菜，甜的',
        effects: [{ relation: { kind: 'neighbor', deltaCloseness: 3 } }],
      },
    ],
  },
  {
    // 深化·邻居：装修噪音二向（忍/说，stress 二向）。
    id: 'wl_renovation_noise',
    category: 'life',
    title: '电钻从早上八点开始',
    text: '对门装修第三天，电钻声准时穿透墙面。{name}顶着两个黑眼圈站在玄关，手里的门钥匙转了两圈，又停住。',
    minAge: 22,
    maxAge: 65,
    cooldown: 4,
    weight: 10,
    requires: { relationKinds: ['neighbor'] },
    choices: [
      {
        text: '忍了，戴上去上班',
        summary: '耳机音量调到最大。晚上回来，门口多了袋对方塞的橘子——他们心里也有数',
        effects: [{ attr: 'stress', delta: 2 }],
      },
      {
        text: '敲开门，好好说了',
        summary: '对方一个劲道歉，说中午午休时段一定停工。谈开了反而轻松——邻居之间，话比纸条管用',
        effects: [
          { attr: 'stress', delta: -1 },
          { relation: { kind: 'neighbor', deltaCloseness: 1 } },
        ],
      },
    ],
  },
  {
    // 深化·邻居：守望相助（需邻居亲密 ≥50+玩家身处负面标记期——远亲不如近邻）。
    id: 'wl_good_neighbor',
    category: 'life',
    title: '远亲不如近邻',
    text: '那几天家里冷锅冷灶。门铃响的时候，{name}以为是快递——门口站着对门的TA，手里端着还冒热气的砂锅：「给孩子和自己，趁热。」',
    minAge: 25,
    maxAge: 70,
    cooldown: 6,
    weight: 10,
    requires: {
      relationKinds: ['neighbor'],
      minCloseness: { neighbor: 50 },
      tagsAny: ['low_mood', 'grief_pet', 'been_deep_debt'],
    },
    choices: [
      {
        text: '收下这口热饭，记着这份情',
        summary: '砂锅还回去的时候装了自己炖的汤。一来一往，楼道里的「吃了吗」，从此是真的在问',
        effects: [
          { attr: 'stress', delta: -2 },
          { relation: { kind: 'neighbor', deltaCloseness: 2 } },
        ],
      },
      {
        text: '洗了TA的砂锅，又给装满了',
        summary: '礼尚往来不是客气，是把这个「近」字处成真的。两家人后来钥匙都互相存了一把',
        effects: [{ relation: { kind: 'neighbor', deltaCloseness: 3 } }],
      },
    ],
  },
]
