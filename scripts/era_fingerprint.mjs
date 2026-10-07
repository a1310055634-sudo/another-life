// 第 27 轮《时代质感》数值指纹：导出全事件池的"机制值"（排除一切文本字段），
// 用于证明纯文本轮零数值改动。用法：
//   node scripts/era_fingerprint.mjs > /tmp/era_fp_before.json
// 文本轮完成后重跑 diff，两份指纹必须逐字节一致。
// 采集范围：minAge/maxAge/weight/priority/cooldown/once/singleChoiceOk、
// requires 全量、choices 的 effects/requires/addTags/removeTags/delayed（按索引键控）。
import { ALL_EVENTS } from '../src/data/events/index.ts'

function clean(v) {
  if (Array.isArray(v)) return v.map(clean)
  if (v && typeof v === 'object') {
    const out = {}
    for (const k of Object.keys(v).sort()) {
      if (k === 'summary' || k === 'tooltip') continue // 纯文本字段不进指纹
      out[k] = clean(v[k])
    }
    return out
  }
  return v
}

const fp = ALL_EVENTS.map((e) => ({
  id: e.id,
  category: e.category,
  minAge: e.minAge,
  maxAge: e.maxAge,
  weight: e.weight ?? 10,
  priority: e.priority ?? 0,
  cooldown: e.cooldown ?? 0,
  once: !!e.once,
  singleChoiceOk: !!e.singleChoiceOk,
  requires: clean(e.requires ?? null),
  choices: e.choices.map((c, i) => ({
    i,
    effects: clean(c.effects),
    requires: clean(c.requires ?? null),
    addTags: clean(c.addTags ?? null),
    removeTags: clean(c.removeTags ?? null),
    delayed: clean(c.delayed ?? null),
  })),
}))

console.log(JSON.stringify(fp, null, 1))
console.error(`[fingerprint events: ${ALL_EVENTS.length}]`)
