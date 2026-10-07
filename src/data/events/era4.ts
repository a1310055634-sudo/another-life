// 时代纵深 IV（第 123 轮，V7）：纯氛围事件 3 枚，定向补 26-35/46-55 专属最薄桶。
// 蓝本=youth_livehouse/mid_nav_memory（≥2 选项、金额零或小额、零标记零延迟链）。
// 题材从 V7 新线取材（求职焦虑/邻里团购/年关快递）。词表扩容见 round48_text_audit
// ERA_WORDS 与 era_audit.mjs KEYWORDS（+8：反向春运/电子红包/鸡娃/内卷/心理咨询/断舍离/银发经济/数字遗产）。
import type { GameEvent } from '../../engine/types'

export const ERA4_EVENTS: GameEvent[] = [
  {
    // 定向 26-35 专属（28–35 窗）；撞题差异化：mc_resume「已读不回」=失业专属被拒叙事
    // （R89），本枚=在职也偷偷看机会的凌晨心态流，纯氛围无门控无标记。
    id: 'era4_jobs_dawn',
    category: 'career',
    title: '凌晨的招聘软件',
    text: '失眠的夜里，{name}点开了那个很久没动的招聘软件。滑动，收藏，再滑动——有三家公司标注「急聘」，有两家薪资比现在高。凌晨两点的勇气，天亮之后还算不算数？',
    minAge: 28,
    maxAge: 35,
    cooldown: 5,
    weight: 8,
    choices: [
      {
        text: '收藏三家，先去睡',
        summary: '{name}按住心动的薪资关掉手机。收藏夹不会过期，觉要紧——机会和睡眠，都得养着',
        effects: [{ attr: 'stress', delta: -1 }],
      },
      {
        text: '顺手改了改简历',
        summary: '改到第三版，{name}忽然发现这两年攒下的东西比想象中多。存进草稿箱，安心睡去',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
  {
    // 定向 46-55 专属（48–55 窗）；撞题差异化：wl_hallway_chat=邻居关系建立与维护
    // （R115 有 relation 效果），本枚=团购群生活流纯氛围，无 relation 效果。
    id: 'era4_group_buy',
    category: 'life',
    title: '小区团购群',
    text: '群里的接龙从早上排到晚上：今天的西瓜、明天的排骨、后天到货的纸巾。{name}本来只想买一颗白菜，划着划着，购物清单长出了七八行。',
    minAge: 48,
    maxAge: 55,
    cooldown: 5,
    weight: 8,
    choices: [
      {
        text: '跟上接龙，顺手帮邻居带了棵葱',
        summary: '取货点就在楼下驿站，{name}拎着两袋东西上楼，袋子上还贴着邻居的便签「谢谢侬」——群里的热闹，落到了实处',
        effects: [
          { money: -200 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '只买最初那颗白菜，把群设了免打扰',
        summary: '{name}退回购物车把多余的一行行删掉——白菜很甜，清净也很甜',
        effects: [{ attr: 'stress', delta: -1 }],
      },
    ],
  },
  {
    // 定向 26-58 广谱（年关取材）；撞题差异化：youth_holiday_dilemma/ny_where=回不回的
    // 抉择层，本枚=年货到门的物质细节流，纯氛围无抉择成本。
    id: 'era4_ny_delivery',
    category: 'life',
    title: '年货到门的那个下午',
    text: '快递驿站的货架从地面堆到齐腰，红色包装盒占了一半。{name}的年货也是线上下的单——父母那边的腊味今天显示「派送中」，自己这箱坚果昨天就到了。',
    minAge: 26,
    maxAge: 58,
    cooldown: 5,
    weight: 8,
    choices: [
      {
        text: '给家里再补一箱水果，写张卡片',
        summary: '卡片是下单时免费加的，字数有限，{name}只写了四个字：「爸，妈，新年。」——够了，都懂',
        effects: [
          { money: -300 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '抱着自己那箱回家，先吃为敬',
        summary: '坚果开口器都配好了，{name}当晚就开了一包。年味这个东西，有时候是从一口酥脆开始的',
        effects: [{ attr: 'happiness', delta: 1 }],
      },
    ],
  },
]
