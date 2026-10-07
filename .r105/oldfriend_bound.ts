// 第 105 轮：ach_old_friend 可达性 —— 机制绝对上界测试（纯只读）。
//
// 上一探针（80 局真实 session，最大化 friend 亲密策略）实测 0 命中、最高仅 60。
// 「策略不经营」这条解释已被排除（策略每遇 friend 增益必拿）。本测问更硬的问题：
//   即便给玩家一个物理上不可能的对手——每年都能触发全池增益最高的那枚 friend 事件
//   （无视 cooldown、无视 requires、无视事件抽取概率）——55 岁时能否够到 85？
//
// 上界曲线的构造：真实调用 settleRelationDecay（衰减口径与引擎逐位一致），
// 衰减后叠加「当年可用的最大单次增益」。三种增益档：
//   A 绝对上界：无视 cooldown —— 每年都吃全池最高 gain（18-54 岁 = mid_friend_fade +15）
//   B 半上界  ：尊重 cooldown —— 每年在 gain/cd 速率最高的若干枚事件里按冷却轮转取最大
//   C 现实上界：尊重 requires 与年龄窗 —— 只用 minAge≤age≤maxAge 的事件，且尊重 cd
// 若连 A 都到不了 85，则本成就是内容缺口（事件池供给不足），而非玩家经营问题。
import { settleRelationDecay, RELATION_DECAY_RATE, type Relation } from '../src/engine/relations'
import type { RelationKind } from '../src/engine/types'

interface Ev { id: string; gain: number; cd: number; minAge: number; maxAge: number }

// 来自 .r105/oldfriend_probe.mjs 的现读全池 friend 增益事件表（18 枚中 maxAge>54 且 minAge<55 者）
const EVS: Ev[] = [
  { id: 'mid_friend_fade', gain: 15, cd: 5, minAge: 31, maxAge: 50 },
  { id: 'frd_quarrel_reconcile', gain: 9, cd: 3, minAge: 20, maxAge: 68 },
  { id: 'late_reunion', gain: 8, cd: 4, minAge: 52, maxAge: 80 },
  { id: 'frd_cross_city', gain: 8, cd: 4, minAge: 25, maxAge: 70 },
  { id: 'frd_bestman', gain: 5, cd: 1, minAge: 22, maxAge: 60 },
  { id: 'rel_friend_checkin', gain: 5, cd: 3, minAge: 19, maxAge: 55 },
  { id: 'frd_late_talk', gain: 4, cd: 3, minAge: 20, maxAge: 70 },
  { id: 'late_solo_birthday', gain: 3, cd: 4, minAge: 62, maxAge: 77 },
]

function mkFriend(closeness: number): Relation {
  return { id: 'f1', kind: 'friend' as RelationKind, name: '老友', closeness, alive: true }
}

/** 跑一条上界曲线；mode A/B/C 见文件头 */
function curve(mode: 'A' | 'B' | 'C', start: number, bestFriend: boolean): number[] {
  let rels: Relation[] = [mkFriend(start)]
  if (bestFriend) rels[0].bestFriend = true
  const out: number[] = []
  const lastUsed = new Map<string, number>()
  for (let age = 18; age <= 80; age++) {
    // 年度衰减（真实引擎函数）
    const decayed = settleRelationDecay(rels).relations
    let c = decayed[0].closeness
    if (bestFriend && !decayed[0].bestFriend && c >= 60) decayed[0].bestFriend = true
    // 年度增益
    const cands =
      mode === 'A'
        ? EVS.filter((e) => age >= e.minAge && age <= e.maxAge)
        : mode === 'C'
          ? EVS.filter((e) => age >= e.minAge && age <= e.maxAge)
          : EVS.filter((e) => age >= e.minAge && age <= e.maxAge)
    let gain = 0
    if (mode === 'A') {
      gain = cands.length ? Math.max(...cands.map((e) => e.gain)) : 0
    } else {
      const usable = cands.filter((e) => (lastUsed.get(e.id) ?? -99) + e.cd <= age)
      if (usable.length) {
        const pick = usable.sort((x, y) => y.gain / y.cd - x.gain / x.cd)[0]
        gain = pick.gain
        lastUsed.set(pick.id, age)
      }
    }
    decayed[0].closeness = Math.min(100, c + gain)
    // 挚友标记按引擎口径（≥60 盖）——用衰减后的值判定，与 relations.ts 同序
    if (decayed[0].kind === 'friend' && decayed[0].closeness >= 60) decayed[0].bestFriend = true
    rels = decayed
    out.push(decayed[0].closeness)
  }
  return out
}

for (const bestFriend of [false, true]) {
  const label = bestFriend ? 'bestFriend(-1/yr)' : 'normal(-2/yr)'
  const a = curve('A', 60, bestFriend)
  const b = curve('B', 60, bestFriend)
  const peakA = Math.max(...a)
  const at55A = a[55 - 18]
  const peakB = Math.max(...b)
  const at55B = b[55 - 18]
  console.log(`${label}`)
  console.log(`  A absolute-upper (ignore cd): peak=${peakA}  @55=${at55A}  @77=${a[77 - 18]}  reaches85@55+=${a.slice(55 - 18).some((v) => v >= 85)}`)
  console.log(`  B cd-respecting upper:       peak=${peakB}  @55=${at55B}  @77=${b[77 - 18]}  reaches85@55+=${b.slice(55 - 18).some((v) => v >= 85)}`)
  console.log(`  A curve 18-66: ${a.slice(0, 49).join(' ')}`)
  console.log(`  B curve 18-66: ${b.slice(0, 49).join(' ')}`)
}
console.log(`RELATION_DECAY_RATE.friend=${RELATION_DECAY_RATE.friend}`)
console.log('threshold needed at 55: 85 ; decay per year after 55: -1 (bestFriend) / -2 (normal)')