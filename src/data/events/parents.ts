// 第 42 轮：父母去世事件线——给死亡以情感叙事，不只结算数字。
// 资格全部读第 41 轮机制落下的真实状态（engine/parents.ts）：
// - 在册父母（relationKinds: parent）→ 病危通知 / 临终陪伴
// - 病危标记（parent_critical：病危事件各选项授予、陪伴事件消耗、年度结算到期清理）
// - 去世档案（parentDiedWithin N / parentsAllDeceased，由 deceased + deathAge 反推去世年）
// 全部 ≥2 有效选项（负债时大额选项隐藏后仍保 ≥2 可见）；文本不假设双亲都在场、
// 不假设兄弟姐妹/孙辈等其他家庭结构；金额与既有物价感知一致（手术 8k/15k 顶格）。
import type { GameEvent } from '../../engine/types'

export const PARENT_EVENTS: GameEvent[] = [
  // ── 病危通知：在册父母 + 中年往后（父母 frail 之后）；priority 2 让它先于杂事出现 ──
  {
    id: 'rel_parent_critical',
    category: 'relationship',
    title: '深夜的医院电话',
    text: '深夜，陌生号码打进来，是医院。电话那头的声音很克制：老人情况不稳定，家属最好来一趟。{name}握着手机，半天没有说出话。',
    minAge: 40,
    maxAge: 72,
    cooldown: 4,
    weight: 10,
    priority: 2,
    requires: { relationKinds: ['parent'] },
    choices: [
      {
        text: '连夜买票回去',
        summary: '连夜赶回了老家',
        effects: [
          { money: -1200 },
          { relation: { kind: 'parent', deltaCloseness: 6 } },
        ],
        addTags: ['parent_critical'],
      },
      {
        text: '请下假来，一直守着',
        summary: '请了长假守在病床边',
        effects: [
          { money: -3000 },
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'parent', deltaCloseness: 9 } },
        ],
        addTags: ['parent_critical'],
      },
      {
        text: '托老家亲戚先照看着',
        summary: '托了亲戚先照看，自己攒假',
        effects: [
          { money: -800 },
          { relation: { kind: 'parent', deltaCloseness: 3 } },
        ],
        addTags: ['parent_critical'],
      },
    ],
  },
  // ── 临终陪伴：病危标记在场；陪伴即消耗标记（安心），不再悬置提速 ──
  {
    id: 'rel_parent_deathbed',
    category: 'relationship',
    title: '病床前',
    text: '病床上的老人瘦了一圈，看见{name}进来，眼睛亮了一下，摆摆手说「来了就好，别耽误上班」。监护仪的滴滴声里，时间过得又慢又快。',
    minAge: 40,
    maxAge: 77,
    cooldown: 2,
    weight: 14,
    priority: 3,
    requires: { tagsAll: ['parent_critical'], relationKinds: ['parent'] },
    choices: [
      {
        text: '把年假全用了，守到最后',
        summary: '守到了最后一程',
        effects: [
          { money: -5000 },
          { relation: { kind: 'parent', deltaCloseness: 12 } },
        ],
        removeTags: ['parent_critical'],
      },
      {
        text: '白天工作，晚上守夜',
        summary: '两头跑，没缺一晚',
        effects: [
          { money: -2000 },
          { attr: 'stress', delta: 2 },
          { relation: { kind: 'parent', deltaCloseness: 8 } },
        ],
        removeTags: ['parent_critical'],
      },
      {
        text: '隔着视频，说了很多话',
        summary: '隔着屏幕陪了很久',
        effects: [{ relation: { kind: 'parent', deltaCloseness: 3 } }],
        removeTags: ['parent_critical'],
      },
    ],
  },
  // ── 葬礼：去世后的第一个抽卡窗口（parentDiedWithin 2 覆盖去世后两个年窗），once ──
  {
    id: 'rel_parent_funeral',
    category: 'relationship',
    title: '一场葬礼',
    text: '老家的规矩、亲戚的脸、花圈和白布。{name}在灵前跪下的那一刻忽然明白：从今往后，自己就是最前面的一辈人了。',
    minAge: 32,
    maxAge: 77,
    once: true,
    weight: 16,
    priority: 3,
    requires: { parentDiedWithin: 2 },
    choices: [
      {
        text: '按老家的规矩，风风光光地送',
        summary: '风风光光地送了最后一程',
        effects: [
          { money: -6000 },
          { attr: 'happiness', delta: 4 },
        ],
      },
      {
        text: '从简办，安静地送',
        summary: '安静地送了行',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 2 },
        ],
      },
      {
        text: '让亲戚们凑了凑，自己守了三夜灵',
        summary: '守了三夜灵，亲戚们凑了手',
        effects: [
          { attr: 'stress', delta: 2 },
          { attr: 'happiness', delta: 2 },
        ],
      },
    ],
  },
  // ── 首祭：去世后三年内；零成本出口为主，悲伤不必花钱 ──
  {
    id: 'rel_parent_memorial',
    category: 'relationship',
    title: '第一个春天',
    text: '开春，山上的草绿了。{name}提着祭品上山，碑上的名字还很新。坐了很久，风把纸灰吹起来的时候，好像有谁轻轻应了一声。',
    minAge: 32,
    maxAge: 77,
    once: true,
    weight: 12,
    priority: 1,
    requires: { parentDiedWithin: 3 },
    choices: [
      {
        text: '上香，坐一下午',
        summary: '在碑前坐了一个下午',
        effects: [{ attr: 'happiness', delta: 3 }],
      },
      {
        text: '带着TA生前爱吃的点心',
        summary: '带去了TA爱吃的点心',
        effects: [
          { money: -200 },
          { attr: 'happiness', delta: 5 },
        ],
      },
      {
        text: '把这一年，讲给TA听',
        summary: '絮絮叨叨讲了一年',
        effects: [{ attr: 'happiness', delta: 4 }],
      },
    ],
  },
  // ── 遗物：窗口放宽到六年，整理遗物不必赶；含一个真实的回避选项 ──
  {
    id: 'rel_parent_relics',
    category: 'relationship',
    title: '整理遗物',
    text: '老屋要腾出来了。樟木箱里是叠得整整齐齐的旧衣裳，缝纫机的抽屉里压着一张全家福，边角都磨白了。{name}一件一件拿起来，又一件一件放下。',
    minAge: 32,
    maxAge: 77,
    once: true,
    weight: 10,
    priority: 0,
    requires: { parentDiedWithin: 6 },
    choices: [
      {
        text: '把旧照片都翻拍，存进手机',
        summary: '旧照片都翻拍存了档',
        effects: [
          { money: -1500 },
          { attr: 'happiness', delta: 5 },
        ],
      },
      {
        text: '留下TA的旧手表，衣物捐出去',
        summary: '手表留下了，衣物捐了',
        effects: [
          { attr: 'happiness', delta: 4 },
          { attr: 'social', delta: 2 },
        ],
      },
      {
        text: '原样锁回柜子，今年还没准备好',
        summary: '还没准备好，原样锁了回去',
        effects: [{ attr: 'happiness', delta: -2 }],
      },
    ],
  },
  // ── 独当一面：双亲皆逝后「自己成了最前面的一辈」；葬礼之后、三年之内 ──
  {
    id: 'rel_parent_last_one',
    category: 'relationship',
    title: '往后的家长里短，只有我了',
    text: '老屋的灯拉灭了，钥匙还了回去，亲戚们也散了。{name}一个人往车站走，忽然想起小时候放学回家，喊一声「我回来了」，屋里总有人应。往后再回老家，这句话要喊给谁听呢。',
    minAge: 32,
    maxAge: 77,
    once: true,
    weight: 18,
    priority: 2,
    requires: { parentsAllDeceased: true, parentDiedWithin: 3 },
    choices: [
      {
        text: '把两老的合照摆进客厅',
        summary: '两老的合照摆进了客厅',
        effects: [{ attr: 'happiness', delta: 5 }],
      },
      {
        text: '学着TA的手法，腌了一坛菜',
        summary: '学着腌了一坛TA那个味的菜',
        effects: [{ attr: 'happiness', delta: 6 }],
      },
      {
        text: '把自己关了一天，哭完继续生活',
        summary: '关了一天，哭过之后继续过日子',
        effects: [
          { attr: 'happiness', delta: -3 },
          { attr: 'stress', delta: -2 },
        ],
      },
    ],
  },
  // ── 第 102 轮：父母再婚（撞题扫描零命中：再婚/续弦/离婚再嫁 全池 0 命中）──
  {
    id: 'par_remarry',
    category: 'relationship',
    title: '爸妈要办事了',
    text: '电话是父亲打来的，说得很绕：「有个人，肯跟咱们过。」「我们想办一下。」「你不用回来。」——三个人二十年没红过脸，这回齐了。',
    minAge: 42,
    maxAge: 70,
    cooldown: 8,
    weight: 8,
    requires: { relationKinds: ['parent'] },
    choices: [
      {
        text: '请顿饭，把话说开',
        summary: '一顿饭吃了四个小时，出来的时候父亲的手搭在{name}肩上',
        effects: [
          { money: -800 },
          { attr: 'happiness', delta: 2 },
          { attr: 'social', delta: 1 },
        ],
      },
      {
        text: '支持，礼数给足就行',
        summary: '礼金给得体面，人到不到场也没人说什么',
        effects: [
          { money: -2000 },
          { attr: 'happiness', delta: 1 },
        ],
      },
      {
        text: '反对，这事不该这时候办',
        summary: '父亲挂了电话，之后每次通话都只剩三句',
        effects: [
          { attr: 'happiness', delta: -2 },
          { attr: 'stress', delta: 2 },
        ],
      },
    ],
  },
  // ── 第 102 轮：角色对调（撞题扫描零命中：父母也老/反过来照顾 全池 0 命中）──
  {
    id: 'par_roles_reverse',
    category: 'relationship',
    title: '这次是我带TA去医院',
    text: '挂号单是{name}排的队，量血压的姿势是{name}学的。护士说「家属让一下」，{name}往后退了半步——TA在里面，回头看{name}，眼神里全是二十年前的样子。',
    minAge: 46,
    maxAge: 72,
    cooldown: 6,
    weight: 9,
    requires: { relationKinds: ['parent'] },
    choices: [
      {
        text: '把TA接到身边，一周一次复查',
        summary: '药按周分好装盒，闹钟设在了{name}的手机上',
        effects: [
          { money: -1200 },
          { attr: 'happiness', delta: -1 },
          { attr: 'stress', delta: 2 },
        ],
      },
      {
        text: '请个护工，自己只负责出钱',
        summary: '账目清清楚楚，护工说「老人家其实挺想你的」',
        effects: [
          { money: -2500 },
          { attr: 'stress', delta: -1 },
          { attr: 'happiness', delta: -1 },
        ],
      },
      {
        text: '把频率降一点，各自过日子',
        summary: '改成一个月一次，TA每次都提前两天开始念叨',
        effects: [
          { attr: 'stress', delta: -2 },
          { attr: 'happiness', delta: -2 },
        ],
      },
    ],
  },
  {
    id: 'par_parent_phone_fun',
    category: 'life',
    title: '教爸妈玩手机新功能',
    text: '母亲的手机里多了三个图标，都是她不敢点开的。{name}回家时她指着屏幕问：「这个挂号的说，能约上专家号？」——教一次，她能少跑三趟。',
    minAge: 42,
    maxAge: 60,
    cooldown: 4,
    weight: 9,
    requires: { relationKinds: ['parent'] },
    choices: [
      {
        text: '视频连线，手把手教到会',
        summary: '同一操作讲了五遍，第六遍母亲终于自己约上了号。她在那头笑出声：「我闺女/儿子比客服耐心。」',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'parent', deltaCloseness: 3 } },
        ],
      },
      {
        text: '写了份图文步骤，一笔一划拍下来',
        summary: '每一步截图配大字标注，打印出来塑封好寄回家。后来听说，那份塑封纸在老小区里传阅了一圈',
        effects: [
          { attr: 'smarts', delta: 1 },
          { relation: { kind: 'parent', deltaCloseness: 2 } },
        ],
      },
    ],
  },
  {
    id: 'par_parent_reunion',
    category: 'life',
    title: '爸妈的同学会',
    text: '父亲的老同学聚会定在老家饭店，母亲在电话里嘀咕「你爸紧张得像个高考生」。{name}看了看假期——刚好，可以回去当司机。',
    minAge: 42,
    maxAge: 65,
    cooldown: 5,
    weight: 8,
    requires: { relationKinds: ['parent'] },
    choices: [
      {
        text: '回去当司机，全程陪同',
        summary: '宴席上父亲被老同学轮番敬酒，脸红红的，嗓门亮亮的。回家的路上他哼着歌——{name}很久没见他这么年轻',
        effects: [
          { attr: 'happiness', delta: 1 },
          { relation: { kind: 'parent', deltaCloseness: 2 } },
        ],
      },
      {
        text: '聚会有点远，听爸妈讲当年的故事',
        summary: '电话里母亲把父亲年轻时的糗事抖了个遍。隔着电话的笑声混成一团——见不见面，故事都值回票价',
        effects: [
          { attr: 'smarts', delta: 1 },
          { relation: { kind: 'parent', deltaCloseness: 1 } },
        ],
      },
    ],
  }
]
