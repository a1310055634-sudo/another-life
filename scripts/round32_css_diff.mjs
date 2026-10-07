// 第 32 轮 CSS 重构守卫：新 index.css 相对旧版必须
// ① 业务类名集合完全一致（无丢失、无意外新增——全局 :focus-visible 等伪类/元素选择器除外；
//    第 34 轮起放行转场遮罩类 ADDED_ALLOWED，见下方常量）
// ② 旧变量升级（--radius→--radius-lg、--shadow→--shadow-md）之外全部保留
// ③ 每个 var(--x) 引用都有 :root（或 media 内 :root）定义——未定义变量引用是真回归
// ④ 不残留 --paper-2 fallback 与裸 #fff 等已收编魔数
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const oldCss = readFileSync(join(tmpdir(), 'index.css.v1.bak'), 'utf8')
const newCss = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

function classNames(css) {
  const set = new Set()
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').split('{').slice(0, -1)
  for (const sel of selectors) {
    for (const m of sel.matchAll(/\.([a-zA-Z][\w-]*)/g)) set.add(m[1])
  }
  return set
}

const oldCls = classNames(oldCss)
const newCls = classNames(newCss)
const lost = [...oldCls].filter((c) => !newCls.has(c))
// 第 34 轮（动效 II）有意新增：跨年「翻开新的一年」转场遮罩两个类，纯视觉层
// 第 35 轮（资产曲线）有意新增：履历区折叠容器 / SVG 图容器 / 负债区标注行三个类
// 第 36 轮（属性雷达与人生时间轴）有意新增：雷达图容器 / 图例行 / 图例基准项修饰 /
// 时间轴容器 / 关键节点修饰（li 修饰类）共五个类
// 第 37 轮（人生报告）有意新增：关键数据格容器与单格 / 关键抉择金句块 /
// 图表并排容器 / 后记金边收束修饰 共五个类（.ending-grade 印章化只改规则体不增类）
const ADDED_ALLOWED = new Set([
  'year-flip', 'year-flip-band',
  'asset-fold', 'asset-curve', 'asset-curve-note',
  'life-radar', 'radar-legend', 'lg-base', 'life-timeline', 'tl-key',
  'report-stats', 'report-stat', 'report-quote', 'report-charts', 'report-epilogue',
  // 第 53 轮：往生录（首页多周目博物馆）；grade-{S..D} 复用既有类不在此列
  'legacy-list', 'legacy-entry', 'legacy-grade', 'legacy-epitaph', 'legacy-meta',
  // 第 54 轮：分享卡入口容器
  'share-actions',
  // 第 56 轮：首局开场引导浮层
  'tutorial-overlay', 'tutorial-card', 'tutorial-step', 'tutorial-title', 'tutorial-body', 'tutorial-actions',
  // 第 73 轮：往生录展开式回顾（碑头按钮 / 0fr→1fr 容器 / 开态修饰 / 内衬 / 抉择列表）
  'legacy-toggle', 'legacy-more', 'open', 'legacy-more-inner', 'legacy-choices',
  // 第 75 轮：岁月长河（过滤档 / 选中态 / 年代锚点 / 分段 / 组头 / 空态）
  'river-filters', 'river-chip', 'on', 'river-nav', 'river-anchor', 'river', 'river-seg', 'river-seg-head', 'river-empty',
  // 第 84 轮：主动行动条（容器 / 标签 / 列表 / 行动按钮 / 键位徽标 / 花费 / 提示 / 已行动注记）
  'action-bar', 'action-bar-label', 'action-bar-list', 'action-btn', 'action-key', 'action-cost', 'action-bar-hint', 'action-done-note',
  // 第 96 轮：同龄人对照卡（容器 / 说明 / 行列表 / 行 / 标签 / 数值 / 分位文案）
  'peer-compare', 'peer-note', 'peer-rows', 'peer-row', 'peer-label', 'peer-value', 'peer-tier',
  // 第 97 轮：重大时刻演出（遮罩 / 卡 / 年龄 / 大字 / 注脚 / 渐显态）
  'moment-overlay', 'moment-card', 'moment-card-shown', 'moment-age', 'moment-label', 'moment-sentence',
  // 第 98 轮：人生高光金句卡（区块 / 卡墙 / 卡 / 引号 / 正文 / 落款 / 年龄徽标 / 标题）
  'hl-section', 'hl-cards', 'hl-card', 'hl-quote', 'hl-text', 'hl-meta', 'hl-age', 'hl-title',
  // 第 107 轮：开局抽签仪式（区块 / 说明 / 舞台 / 抽签按钮 / 卡 / 揭示态 / 两行 /
  // 悬念半句 / 操作行 / 提示）
  'fortune', 'fortune-note', 'fortune-stage', 'fortune-draw-btn', 'fortune-card',
  'fortune-card-shown', 'fortune-line', 'fortune-bg', 'fortune-trait', 'fortune-kicker',
  'fortune-name', 'fortune-desc', 'fortune-suspense', 'fortune-actions', 'fortune-hint',
  // d.121: another-road card
  'regret-section', 'regret-note', 'regret-rows', 'regret-row', 'regret-age', 'regret-alt',
  // d.122: motto pick
  'motto-pick', 'motto-head', 'motto-opts', 'motto-btn', 'motto-hint',
])
const added = [...newCls].filter((c) => !oldCls.has(c) && !ADDED_ALLOWED.has(c))
const allowedAdded = [...newCls].filter((c) => !oldCls.has(c) && ADDED_ALLOWED.has(c))
console.log(`old classes: ${oldCls.size}, new classes: ${newCls.size}`)
console.log(`LOST (${lost.length}):`, lost.join(', ') || 'none')
console.log(`ADDED (${added.length}):`, added.join(', ') || 'none')
console.log(`ADDED-ALLOWED (${allowedAdded.length}):`, allowedAdded.join(', ') || 'none')

const oldVars = [...oldCss.matchAll(/--([\w-]+)\s*:/g)].map((m) => m[1])
const newVarSet = new Set([...newCss.matchAll(/--([\w-]+)\s*:/g)].map((m) => m[1]))
// 旧名 → 新阶梯名的有意升级
const UPGRADED = { radius: 'radius-lg', shadow: 'shadow-md' }
const varLost = oldVars.filter((v) => !newVarSet.has(v) && !(v in UPGRADED))
console.log(`old vars: ${oldVars.length}, new vars total: ${newVarSet.size}`)
console.log(`VARS LOST (${varLost.length}):`, varLost.join(', ') || 'none')

// 新文件中每个 var() 引用必须有定义（定义可能在 media 内 :root）
const refs = new Set([...newCss.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]))
const undefinedRefs = [...refs].filter((r) => !newVarSet.has(r))
console.log(`var() refs: ${refs.size}, UNDEFINED (${undefinedRefs.length}):`, undefinedRefs.join(', ') || 'none')

const regressions = []
if (newCss.includes('--paper-2')) regressions.push('--paper-2 fallback 残留')
if (/\bcolor:\s*#fff\b/.test(newCss)) regressions.push('裸 #fff 文字色残留')
if (/background:\s*#fff\b/.test(newCss)) regressions.push('裸 #fff 背景残留')
if (/#a06a2c|#b8860b|#f6ecd4|#7a5a14|#e5d3a1|#e2b96f|#fdf6e7|#e3f0e7|#2c6e45|#f7e3e1|#a03c34|#efe6f4|#6b4a86|#f7f2e9|#fdf6ee|#ecd9b8|#7a5b2e|#4c9a6a|#d9a021|#4a7fb5|#9067b0|#c4574e/.test(newCss.replace(/:root\s*\{[\s\S]*?\n\}/, '')))
  regressions.push(':root 之外残留硬编码色值')

const mediaCount = (newCss.match(/@media/g) || []).length
// 第 33 轮新增 @media (prefers-reduced-motion: reduce) 动效降级块（任务书要求），基线 1 → 2
console.log(`media queries: ${mediaCount} (旧 2 → 第 32 轮基线 1，第 33 轮起 2)`)
if (mediaCount !== 2) regressions.push(`media query 数量异常: ${mediaCount}`)

const fail = lost.length > 0 || added.length > 0 || varLost.length > 0 || undefinedRefs.length > 0 || regressions.length > 0
console.log(`\nREGRESSIONS: ${regressions.length ? regressions.join(' | ') : 'none'}`)
console.log(fail ? 'GUARD: FAIL' : 'GUARD: PASS')
process.exit(fail ? 1 : 0)
