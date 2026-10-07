/**
 * 第 104 轮 · A2 零值项的量测口径核验（只读探针）
 *
 * 疑问：投保率/离婚率/留学率/走红率 四项报 0.0%，是**真零**还是**量测口径错**？
 * 逐项列出实际会写进 state.history 的 title 字符串，与 A3 块的匹配式比对。
 * 原则：不能把量测 bug 记成内容缺口（也不能反过来）。
 */
import { ALL_EVENTS } from '../src/data/events'

// ① 哪些 effect 会写 history（保险/离婚/留学/名声相关）
const target = ['ensureInsurance', 'claimInsurance', 'divorce']
console.log('=== ① 相关 effect 的全池使用点 ===')
for (const key of target) {
  const hits: string[] = []
  for (const e of ALL_EVENTS) {
    for (const c of e.choices) {
      for (const f of c.effects) {
        if ((f as Record<string, unknown>)[key] !== undefined) {
          hits.push(`${e.id} :: "${c.text}"`)
        }
      }
    }
  }
  console.log(`  ${key}: ${hits.length} 处`)
  for (const h of hits.slice(0, 6)) console.log(`      ${h}`)
}

// ② applyChoice 写入 history 的 title 到底是什么——直接读引擎
console.log('\n=== ② 引擎写 history 的 title 来源 ===')
const { applyChoice } = await import('../src/engine/events')
const { createSession } = await import('../src/engine/session')
void applyChoice; void createSession

// ③ 直接扫：把全池所有 addTags 中含 fame/overseas 的选项列出
console.log('\n=== ③ fame / overseas 标记的生产者 ===')
for (const e of ALL_EVENTS) {
  for (const c of e.choices) {
    const tags = [...(c.addTags ?? [])]
    for (const f of c.effects) tags.push(...((f as { addTags?: string[] }).addTags ?? []))
    const hit = tags.filter((t) => t.startsWith('fame_') || t.includes('overseas') || t.includes('studied_abroad'))
    if (hit.length) console.log(`  ${e.id} "${c.text}" → ${hit.join(',')}`)
  }
}