// 第 57 轮：回归网统一入口（常驻）——串行跑全部验收脚本，统一 PASS/FAIL 汇总，
// 单脚本失败可定位（默认 fail-fast=false 全跑完汇总）。
//覆盖顺序（第 99 轮调整）：**build 提到最前** → 对比度/css 守卫/save_robustness →
//       round33–37 → viewport_shots → keyboard → fileui → mobile（最重）→ test/tsc。
//       调整理由：后续 12 个 CDP 脚本验证的正是本次构建产物，原顺序下它们跑在上一轮旧 dist 上。
// 第 99 轮其他变更：①mobile 正则 31→34、fileui 正则 18→21（新增传承走查步）；
//   ②改异步 spawn + 退避重试（Windows 下 spawnSync(shell=true) 偶发
//   EBUSY「cmd.exe 进程资源忙」→ status=null + 输出全空 + 耗时 0s）；
//   ③失败时把完整输出落盘 .r99/checkall-fail-*.log（尾部堆栈无信息量，首行才有 Error.message）。
//   ④失败摘要打印**错误首行**正则（此前只看尾部 300字，堆栈无信息量，
//     导致 R99 排查 build失败时连续 5 次只看到 prepareOutDir 栈帧而看不到真因）。
//
// ⚠️ 已知环境限制（非项目缺陷，R99 如实记录）：在 WorkBuddy 沙箱内长跑时，
//   vite 的 emptyDir(rmSync dist/assets) 会被运行时 safe-delete 护栏拦截——
//   `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":1791,"threshold":50,
//   "scope":"turn"}`。该计数 scope为「当轮」，即整个工具调用内的累计删除量，
//   与本脚本的步骤顺序无关：同一轮里先跑build 或后跑 build 都会撞（实测7 次均如此），
//   而独立执行 `npm run build` 必过（G3 已单独实跑通过，474.3 kB 自包含）。
//   故 check_all 的 build 项在长跑上下文中预期 FAIL，属环境护栏而非代码回归；
//   需要干净构建时请单独执行 npm run build。
// 运行：node scripts/check_all.mjs
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const steps = [
  { name: 'npm run build（自包含 dist）', cmd: 'npm', args: ['run', 'build'], pass: /inline-dist: OK/, retries: 3 },
  { name: 'round55_contrast（对比度 WCAG AA）', cmd: 'npx', args: ['tsx', 'scripts/round55_contrast.ts'], pass: /CONTRAST: PASS/ },
  { name: 'round32_css_diff（类名/变量守卫）', cmd: 'node', args: ['scripts/round32_css_diff.mjs'], pass: /GUARD: PASS/ },
  { name: 'save_robustness_verify（存档健壮性）', cmd: 'node', args: ['scripts/save_robustness_verify.mjs'], pass: /SUMMARY: 6\/6 PASS/ },
  { name: 'round33_motion_check（动效 I）', cmd: 'node', args: ['scripts/round33_motion_check.mjs'], pass: /SUMMARY: 10\/10 PASS/ },
  { name: 'round34_transition_check（动效 II/连点）', cmd: 'node', args: ['scripts/round34_transition_check.mjs'], pass: /24\/24|SUMMARY: 24\/24/ },
  { name: 'round35_curve_check（资产曲线）', cmd: 'node', args: ['scripts/round35_curve_check.mjs'], pass: /13\/13/ },
  { name: 'round36_check（雷达/时间轴）', cmd: 'node', args: ['scripts/round36_check.mjs'], pass: /25\/25/ },
  { name: 'round37_report_check（人生报告）', cmd: 'node', args: ['scripts/round37_report_check.mjs'], pass: /18\/18/ },
  { name: 'round32_viewport_shots（三视口截图）', cmd: 'node', args: ['scripts/round32_viewport_shots.mjs'], pass: /21\/21/ },
  { name: 'keyboard_verify（键盘全流程+抽签键盘路径）', cmd: 'node', args: ['scripts/keyboard_verify.mjs'], pass: /SUMMARY: 21\/21 PASS/ },
  { name: 'fileui_verify（file:// 全流程+传承链路+行动条/对照卡）', cmd: 'node', args: ['scripts/fileui_verify.mjs'], pass: /SUMMARY: 24\/24 PASS/ },
  { name: 'mobile_verify（移动端+音效+引导+往生录+V5演出/传承走查+抽签窄屏）', cmd: 'node', args: ['scripts/mobile_verify.mjs'], pass: /SUMMARY: 37\/37 PASS/ },
  { name: 'npm test（单测全量）', cmd: 'npm', args: ['test'], pass: /Tests\s+\d+ passed/ },
  // 第 105 轮扩入两项（15 → 17）：①G5 的确定性守卫首次进网——18 局零位移此前只靠
  //   各轮手工跑，漏跑不会有人发现；②V5 时代纵深 III 的事件效果规格守卫（轻效果非空效果）。
  { name: 'round101_compare18（G5 18 局逐局零位移）', cmd: 'npx', args: ['tsx', 'scripts/round101_compare18.ts'], pass: /位移=0/, retries: 2 },
  { name: 'era_texture_check（V5 时代纵深规格守卫）', cmd: 'npx', args: ['tsx', 'scripts/era_texture_check.mjs'], pass: /\[era_texture_check: PASS\]/ },
  // 第 105 轮扩入第三项：V5「重大时刻全屏演出」的真实组件路径验证（注入构造存档 →
  // 继续游戏 → 断言 .moment-overlay 渐显且文案与注入条目一致 + reduced-motion 压平）。
  // 此前只有 mobile M18 的窄屏走查，且那步是手工造 DOM、不等于组件真渲染。
  { name: 'moment_verify（V5 重大时刻演出真实组件路径）', cmd: 'npx', args: ['tsx', 'scripts/moment_verify.ts'], pass: /三类以上演出实证/, retries: 2 },
  { name: 'npx tsc --noEmit（类型）', cmd: 'npx', args: ['tsc', '--noEmit'], pass: null }, // exit 0 即过
]

const t0 = Date.now()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 异步跑单步；EBUSY/空输出退避重试最多 3 次 */
function runStep(s) {
  return new Promise((resolve) => {
    let attempt = 0
    const tryOnce = () => {
      attempt++
      const child = spawn(s.cmd, s.args, {
        shell: process.platform === 'win32',
        env: { ...process.env, ...(s.env ?? {}) },
      })
      let out = ''
      const collect = (b) => { if (b) out += b.toString() }
      child.stdout?.on('data', collect)
      child.stderr?.on('data', collect)
      child.on('error', () => { out += `\n[spawnError] ${s.cmd}` })
      child.on('close', (code) => {
        // 第 105 轮修 R104 遗留 ⑥：旧判据 `code !== null && out.trim() !== ''` 把
        // 「进程正常退出但零输出」当成启动失败，于是 `tsc --noEmit`（成功时恰好零输出）
        // 每次都被判不可用 → 白跑满 3 次退避重试（闸门上表现为 [重试2次]、耗时 3 倍）。
        // 正确区分两件事：进程是否起来了（code !== null），与判据是否命中（passed）。
        // 零输出 + 退出码 0 是完全合法的一次成功运行，不该重试。
        const spawned = code !== null
        const passed = s.pass ? s.pass.test(out.replace(/\x1b\[[0-9;]*m/g, '')) : code === 0
        // 重试条件：①进程没起来（EBUSY/spawnError）；②判据未命中且本次非重试末轮
        // （build 在本机 12 个 Chrome 脚本连跑后偶发 vite prepareOutDir 句柄占用，
        //  单独跑必过——属环境占用非代码缺陷，重跑一次即可，故纳入重试而非直接判FAIL）
        if ((spawned && passed) || attempt >= (s.retries ?? 3)) { resolve({ code, out, attempt }); return }
        setTimeout(tryOnce, 1500 * attempt) // 退避
      })
    }
    tryOnce()
  })
}

const summary = []
let fails = 0
// 第 126 轮：quick/full 两档——--quick 只跑三件套+css_diff+对比度（默认缺省=full 全项不变）。
// 任务书 R126 ④：check_all 时长 3m47s 偏重，分档只加快捷入口不改任何断言。
const QUICK = process.argv.includes('--quick')
const QUICK_NAMES = new Set([
  'npm run build（自包含 dist）',
  'round55_contrast（对比度 WCAG AA）',
  'round32_css_diff（类名/变量守卫）',
  'npm test（单测全量）',
  'npx tsc --noEmit（类型）',
])
const runSteps = QUICK ? steps.filter((s) => QUICK_NAMES.has(s.name)) : steps
for (const s of runSteps) {
  const started = Date.now()
  const { code, out: raw, attempt } = await runStep(s)
  const out = raw.replace(/\x1b\[[0-9;]*m/g, '') // 剥 ANSI 色码（vitest 输出带色）
  const secs = Math.round((Date.now() - started) / 1000)
  // 通过判据：显式正则命中，或无正则时 exit code 0
  const ok = s.pass ? s.pass.test(out) : code === 0
  if (!ok) fails++
  summary.push({ name: s.name, ok, secs, code })
  const retryTag = attempt > 1 ? ` [重试${attempt - 1}次]` : ''
  // 失败时打印**错误首行**（Node 堆栈首行含真实 Error.message，尾部只有调用栈无信息量）；
  // 并把完整输出落盘到.r99/checkall-fail-*.log（首行匹配不到时便于事后取证）
  const firstErr = (out.match(/^[^\n]*(?:Error|EBUSY|EPERM|ENOTEMPTY|ELIFECYCLE|failed)[^\n]*/mi) ?? [''])[0].trim()
  if (!ok) {
    try {
      mkdirSync('.r99', { recursive: true })
      const safe = s.name.replace(/[^\w一-龥]+/g, '_').slice(0, 40)
      writeFileSync(`.r99/checkall-fail-${safe}.log`, out, 'utf8')
    } catch { /* 落盘失败不阻断汇总 */ }
  }
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${s.name}${retryTag} | ${secs}s${ok ? '' : ` | exit=${code} 首行=${firstErr.slice(0, 200)} | 尾部：${out.slice(-300).replace(/\n+/g, ' ¶ ')}`}`)
}

console.log('\n===== 回归网汇总 =====')
for (const s of summary) console.log(`${s.ok ? '✓' : '✗'} ${s.name}（${s.secs}s）`)
const total = Math.round((Date.now() - t0) / 1000)
console.log(`\nCHECK_ALL: ${summary.length - fails}/${summary.length} PASS（总时长 ${Math.floor(total / 60)}m${total % 60}s）`)
process.exit(fails > 0 ? 1 : 0)