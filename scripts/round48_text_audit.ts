// 第 48 轮：全池文本走查综合扫描（纯文本轮辅助工具，可复跑）。
// 四类检查：①年代一致性（时代词 × 触发年龄段矩阵）②同质化（text 开头句式/意象密度）
// ③金额分布清单（人工对照物价感知）④错字与标点硬伤。
// 运行：npx tsx scripts/round48_text_audit.ts
import { ALL_EVENTS } from '../src/data/events'

// ── ①年代一致性：时代词按「现实普及年代」映射到玩家出生年 ≈ 2008 − age（游戏内锚），
//    事件触发年代 = 现实基准 2008 年（V1 锚）+ (age - 18)。词龄不符 → 列候选人工复核。
//    只列候选不判死罪——「收音机」2020 年仍存在，但「70 岁玩手游」需要人审。
const ERA_WORDS: Array<{ word: string; sinceYear: number; note: string }> = [
  { word: '交友软件', sinceYear: 2015, note: '移动交友 App 普及' },
  { word: '刷手机', sinceYear: 2012, note: '智能手机普及' },
  { word: '短视频', sinceYear: 2016, note: '' },
  { word: '微信', sinceYear: 2011, note: '' },
  { word: '朋友圈', sinceYear: 2012, note: '' },
  { word: '扫码', sinceYear: 2015, note: '扫码支付普及' },
  { word: '健康码', sinceYear: 2020, note: '' },
  { word: '网课', sinceYear: 2013, note: '大规模网课 2020' },
  { word: '外卖', sinceYear: 2013, note: '外卖平台普及' },
  { word: '导航', sinceYear: 2010, note: '' },
  { word: '电梯楼', sinceYear: 1990, note: '' },
  { word: 'BP机', sinceYear: 1990, note: '90 年代物，2000 后罕用' },
  { word: '录像厅', sinceYear: 1990, note: '90 年代物' },
  // 第 123 轮时代纵深 IV +8（与现读两表去重后新增；断舍离/银发经济已在 R101 era_audit 词表，剔除）
  { word: '反向春运', sinceYear: 2019, note: '反向春运热词' },
  { word: '电子红包', sinceYear: 2014, note: '微信红包普及' },
  { word: '鸡娃', sinceYear: 2018, note: '育儿热词' },
  { word: '内卷', sinceYear: 2020, note: '热词爆发' },
  { word: '心理咨询', sinceYear: 2015, note: '大众化泛化' },
  { word: '数字遗产', sinceYear: 2015, note: '讨论兴起' },
  { word: '团购', sinceYear: 2010, note: '千团大战' },
  { word: '拼单', sinceYear: 2015, note: '拼团电商' },
]
// 现实基准：18 岁事件约发生在 2008 年（V1 设定锚）
const BASE_YEAR = 2008

console.log('=== ① 年代一致性候选（触发年代 < 词普及年代 → 人工复核） ===')
let eraHits = 0
for (const e of ALL_EVENTS) {
  for (const w of ERA_WORDS) {
    const allText = [e.text, ...e.choices.map((c) => `${c.text} ${c.summary ?? ''}`)].join(' ')
    if (!allText.includes(w.word)) continue
    // 事件文本里「现在」≈ 触发年的中位；用 maxAge 与 minAge 都算，取早值报
    const triggerYear = BASE_YEAR + (e.minAge - 18)
    if (triggerYear < w.sinceYear) {
      console.log(`  [${e.id}] ${e.minAge}-${e.maxAge} 触发年≈${triggerYear} < 「${w.word}」普及 ${w.sinceYear}（${w.note || '词'}）`)
      eraHits++
    }
  }
}
console.log(`  候选 ${eraHits} 条\n`)

// ── ②同质化：text 首句开头模式 + 意象词密度
console.log('=== ② 同质化候选 ===')
const openers = new Map<string, string[]>()
for (const e of ALL_EVENTS) {
  const head = e.text.slice(0, 6)
  const arr = openers.get(head) ?? []
  arr.push(e.id)
  openers.set(head, arr)
}
for (const [head, ids] of [...openers.entries()].filter(([, v]) => v.length >= 3)) {
  console.log(`  开头「${head}…」× ${ids.length}: ${ids.join(',')}`)
}
const IMAGERY = ['同学会', '体检', '手机', '公园', '医院', '咖啡', '婚礼', '葬礼', '加班', '地铁']
for (const img of IMAGERY) {
  const hits = ALL_EVENTS.filter((e) => (e.text + e.choices.map((c) => c.text).join('')).includes(img))
  if (hits.length >= 6) console.log(`  意象「${img}」× ${hits.length}: ${hits.slice(0, 10).map((e) => e.id).join(',')}`)
}
console.log('')

// ── ③金额清单（|money| ≥ 1000 的即时效果，人工对照物价感知）
console.log('=== ③ 金额分布（≥1000 即时支出，检查物价感知一致性） ===')
const amounts = new Map<number, string[]>()
for (const e of ALL_EVENTS) {
  for (const c of e.choices) {
    for (const eff of c.effects ?? []) {
      const m = eff.money ?? 0
      if (m <= -1000) {
        const arr = amounts.get(m) ?? []
        arr.push(`${e.id}/${c.text.slice(0, 10)}`)
        amounts.set(m, arr)
      }
    }
  }
}
for (const [m, refs] of [...amounts.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${m} 元 × ${refs.length}: ${refs.slice(0, 4).join(' | ')}${refs.length > 4 ? ' …' : ''}`)
}
console.log('')

// ── ④错字与标点硬伤
console.log('=== ④ 错字/标点候选 ===')
let typoHits = 0
for (const e of ALL_EVENTS) {
  const texts = [e.title, e.text, ...e.choices.flatMap((c) => [c.text, c.summary ?? '', c.tooltip ?? ''])]
  for (const t of texts) {
    // 全角引号外的英文逗号/句号（中文文案混入半角标点）
    if (/[，。！？；：」』）】][,;.\)\]]|[,;.\)\]][「『（【]/.test(t)) {
      console.log(`  [${e.id}] 中英标点相邻: ${t.slice(0, 40)}`)
      typoHits++
    }
    // 重复字（「的的」「了了」等常见手滑，排除合法叠词）
    const dup = t.match(/(..)\1/g)?.filter((d) => !['刚刚', '渐渐', '慢慢', '久久', '纷纷', '种种', '种种', '微微', '轻轻', '悄悄', '匆匆', '迟迟', '默默', '浅浅', '深深', '久久', '一一', '谢谢', '哈哈', '嘻嘻', '呵呵', '呜呜', '嗡嗡', '滴滴', '沙沙', '哗哗', '滴滴答答'].includes(d))
    if (dup && dup.length) {
      console.log(`  [${e.id}] 疑似重复字「${dup.join('、')}」: ${t.slice(0, 30)}`)
      typoHits++
    }
  }
}
console.log(`  候选 ${typoHits} 条`)
console.log(`\n全池 ${ALL_EVENTS.length} 事件扫描完成`)
