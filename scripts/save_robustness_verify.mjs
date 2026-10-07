// 第 20 轮存档健壮性 file:// 实测：损坏存档 / 高版本存档 / 未知事件 ID 恢复。
// 第 40 轮改为自起独立 Chrome（端口 9247、独立 user-data-dir，旧「外部预起 9223」用法作废）。
// 第 105 轮扩 S4/S5/S6：四可选资产字段（home/city/insurance/fund）齐备与缺失两象限
//   + bloodline 键独立存在性。前三场景的老档兼容只覆盖信封层，本轮补状态层可选字段。
// 运行：node scripts/save_robustness_verify.mjs
import { spawn, execSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const FILE_URL = 'file:///D:/vibe%20coding/another-life/dist/index.html'
const SAVE_KEY = 'another-life:save'
const BLOODLINE_KEY = 'another-life:bloodline'
const LEGACY_KEY = 'another-life:legacy'
const results = []
function report(step, pass, evidence) {
  results.push({ step, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${step} | ${evidence}`)
}
async function getWsUrl() {
  const list = await (await fetch('http://127.0.0.1:9247/json')).json()
  return list.find((t) => t.type === 'page').webSocketDebuggerUrl
}
const userData = mkdtempSync(join(tmpdir(), 'al40-saverob-'))
const chrome = spawn(CHROME, [
  '--headless=new',
  '--remote-debugging-port=9247',
  `--user-data-dir=${userData}`,
  '--window-size=420,820',
  '--no-first-run', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' })
let msgId = 0
const pending = new Map()
let ws
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    pending.set(++msgId, { resolve, reject })
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error('page eval error: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
  return r.result.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(expr, timeoutMs, label) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    if (await evalJs(expr)) return
    await sleep(120)
  }
  throw new Error('waitFor timeout: ' + label)
}
async function reload() {
  await evalJs(`location.reload()`)
  await waitFor(`document.readyState === 'complete'`, 10000, 'reload')
  await sleep(500)
}
function makeName(v) {
  return `(() => {
    const inp = document.querySelector('#name-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, ${JSON.stringify(v)})
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`
}

async function main() {
  let ready = false
  for (let i = 0; i < 50; i++) {
    try { await fetch('http://127.0.0.1:9247/json'); ready = true; break } catch { await sleep(200) }
  }
  if (!ready) throw new Error('CDP 端口未就绪')
  ws = new WebSocket(await getWsUrl())
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)
      pending.delete(m.id)
      if (m.error) reject(new Error(m.error.message))
      else resolve(m.result)
    }
  }
  await send('Page.navigate', { url: FILE_URL })
  await waitFor(`document.readyState === 'complete'`, 10000, 'load')
  await sleep(400)

  // 场景 1：损坏 JSON 存档
  await evalJs(`localStorage.removeItem(${JSON.stringify(SAVE_KEY)}); true`)
  await evalJs(`localStorage.setItem(${JSON.stringify(SAVE_KEY)}, '{"saveVersion":1,"broken":'); true`)
  await reload()
  const s1 = await evalJs(`(() => ({
    mounted: document.getElementById('root').children.length > 0,
    alert: [...document.querySelectorAll('[role="alert"], .banner')].map((b) => b.textContent.slice(0, 80)).find((t) => t.length > 0) ?? null,
    exportBtn: [...document.querySelectorAll('button')].some((b) => b.textContent.includes('导出')),
    raw: localStorage.getItem(${JSON.stringify(SAVE_KEY)})
  }))()`)
  report(
    'S1 损坏存档：不白屏、给出警告、原档保留、可导出',
    s1.mounted && !!s1.alert && s1.exportBtn && s1.raw === '{"saveVersion":1,"broken":',
    JSON.stringify(s1)
  )

  // 场景 2：高版本存档（结构完整，仅版本号新）→ 元数据可读，读取时拒绝并提示更新
  await evalJs(`localStorage.removeItem(${JSON.stringify(SAVE_KEY)}); true`)
  await reload()
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('开始新人生')).click()`)
  await waitFor(`!!document.querySelector('#name-input')`, 5000, 'creation s2')
  await evalJs(makeName('高版本'))
  await evalJs(`(() => { document.querySelectorAll('.opt-grid')[0].querySelector('button').click(); return true })()`)
  await evalJs(`(() => { document.querySelectorAll('.opt-grid')[1].querySelector('button').click(); return true })()`)
  await sleep(200)
  await evalJs(`document.querySelector('.creation-actions .btn-primary').click()`)
  await waitFor(`!!document.querySelector('.topbar-age')`, 6000, 'game s2')
  const bumped = await evalJs(`(() => {
    const raw = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}))
    raw.saveVersion = 99
    localStorage.setItem(${JSON.stringify(SAVE_KEY)}, JSON.stringify(raw))
    return true
  })()`)
  await reload()
  const s2a = await evalJs(`(() => ({
    cont: [...document.querySelectorAll('button')].some((b) => b.textContent.includes('继续游戏')),
  }))()`)
  let s2b = { alert: null, raw: '' }
  if (s2a.cont) {
    await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('继续游戏')).click()`)
    await sleep(700)
    s2b = await evalJs(`(() => ({
      alert: [...document.querySelectorAll('[role="alert"], .banner')].map((b) => b.textContent.slice(0, 120)).find((t) => t.length > 0) ?? null,
      raw: localStorage.getItem(${JSON.stringify(SAVE_KEY)}),
    }))()`)
  }
  const raw2 = JSON.parse(s2b.raw || '{}')
  report(
    'S2 高版本存档：读取被拒、提示更新、原档保留',
    bumped && s2a.cont && !!s2b.alert && (s2b.alert.includes('版本') || s2b.alert.includes('更新')) && raw2.saveVersion === 99,
    JSON.stringify({ cont: s2a.cont, alert: s2b.alert, saveVersion: raw2.saveVersion ?? null })
  )

  // 场景 3：未知事件 ID 恢复（先造合法存档）
  await evalJs(`localStorage.removeItem(${JSON.stringify(SAVE_KEY)}); true`)
  await reload()
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('开始新人生')).click()`)
  await waitFor(`!!document.querySelector('#name-input')`, 5000, 'creation')
  await evalJs(makeName('存档测'))
  await evalJs(`(() => { document.querySelectorAll('.opt-grid')[0].querySelector('button').click(); return true })()`)
  await evalJs(`(() => { document.querySelectorAll('.opt-grid')[1].querySelector('button').click(); return true })()`)
  await sleep(200)
  await evalJs(`document.querySelector('.creation-actions .btn-primary').click()`)
  await waitFor(`!!document.querySelector('.topbar-age')`, 6000, 'game')
  // 跨一年，保证存档里是等待选择的典型会话
  await evalJs(`document.querySelector('.event-card .choice-btn:not(.locked)')?.click()`)
  await waitFor(`!!document.querySelector('.result-panel')`, 5000, 'panel')
  await evalJs(`document.querySelector('.result-panel button').click()`)
  await waitFor(`!!document.querySelector('.event-card') || !!document.querySelector('.result-panel')`, 5000, 'next')
  const hacked = await evalJs(`(() => {
    const raw = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}))
    raw.currentEventId = 'no_such_event_xyz'
    localStorage.setItem(${JSON.stringify(SAVE_KEY)}, JSON.stringify(raw))
    return true
  })()`)
  await reload()
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('继续游戏')).click()`)
  await waitFor(`!!document.querySelector('.topbar-age')`, 6000, 'restored')
  const s3 = await evalJs(`(() => {
    const banner = [...document.querySelectorAll('[role="alert"], .banner')].map((b) => b.textContent.slice(0, 100)).find((t) => t.length > 0) ?? null
    const skip = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('跳过这一年'))
    return { banner, hasSkip: !!skip }
  })()`)
  let skipWorked = false
  if (s3.hasSkip) {
    await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('跳过这一年')).click()`)
    await sleep(600)
    skipWorked = await evalJs(`!!document.querySelector('.event-card') || !!document.querySelector('.result-panel') || !!document.querySelector('.topbar-age')`)
  }
  report(
    'S3 未知事件 ID：提示横幅 + 跳过这一年可恢复推进',
    !!s3.banner && s3.hasSkip && skipWorked,
    JSON.stringify({ ...s3, skipWorked })
  )

  // ── 第 105 轮：四可选资产字段两象限 + bloodline 键独立性 ──────────
  // 复用 S3 造出的合法存档（此时页面已在游戏中）。四字段口径（engine/types.ts）：
  //   home/insurance/fund 为可选对象（旧档缺省 = 无房/无保单/未开户），
  //   city 为可选枚举（旧档缺省 = hometown）。缺字段一律是**正常语义**，不得报损坏。

  const snapshotSave = () => evalJs(`localStorage.getItem(${JSON.stringify(SAVE_KEY)})`)
  const mutateSave = (fnBody) => evalJs(`(() => {
    const raw = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}))
    ${fnBody}
    localStorage.setItem(${JSON.stringify(SAVE_KEY)}, JSON.stringify(raw))
    return true
  })()`)
  const continueGame = async (label) => {
    await reload()
    // 轮询首页按钮渲染完成再点——第 105 轮首版用固定 sleep 后立即读 DOM，
    // 在 S6（第三次 reload、页面冷加载最重的一次）读到空 button 列表假红超时。
    // 属 React 提交时序，与 R34「click 后 80ms 等 commit」同源，方向相反（等渲染而非等提交）。
    await waitFor(`document.querySelectorAll('button').length > 0`, 8000, `home-render@${label}`)
    const probe = await evalJs(`(() => ({
      btns: [...document.querySelectorAll('button')].map((b) => b.textContent.trim().slice(0, 12)),
      hasSave: !!localStorage.getItem(${JSON.stringify(SAVE_KEY)}),
      meta: (() => { try { const o = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})); return { sv: o.saveVersion, phase: o.state?.phase, age: o.state?.age, aw: o.awaitingAdvance, ev: o.currentEventId } } catch (e) { return 'parse-fail' } })(),
    }))()`)
    const clicked = await evalJs(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('继续游戏'))
      if (!b) return false
      b.click(); return true
    })()`)
    if (!clicked) {
      throw new Error(`continueGame(${label})：首页无「继续游戏」按钮 ` + JSON.stringify(probe))
    }
    await waitFor(`!!document.querySelector('.topbar-age')`, 6000, 'continue@' + label)
  }
  /** 四字段齐备的合法取值 */
  const FOUR_FIELDS = `raw.state.home = { basis: 480000, value: 610000, purchasedAtAge: 31 }
    raw.state.insurance = { annualPremium: 6000, benefit: 500000, purchasedAtAge: 35 }
    raw.state.fund = { annualContribution: 12000, units: 88000 }
    raw.state.city = 'metro'`

  // S4 齐备象限：四个可选字段全在册 → 原样保留、可继续推进、无校验横幅
  await mutateSave(FOUR_FIELDS)
  const s4before = JSON.parse(await snapshotSave()).state
  await continueGame('S5')
  const s4 = await evalJs(`(() => {
    const st = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).state
    return {
      home: st.home, insurance: st.insurance, fund: st.fund, city: st.city,
      banner: [...document.querySelectorAll('[role="alert"], .banner')].map((b) => b.textContent.slice(0, 100)).find((t) => t.length > 0) ?? null,
      playing: !!document.querySelector('.topbar-age'),
    }
  })()`)
  report(
    'S4 四字段齐备：原样保留、可继续游戏、无校验横幅',
    !!s4.home && s4.home.value === 610000 && s4.home.basis === 480000 && s4.home.purchasedAtAge === 31
      && !!s4.insurance && s4.insurance.benefit === 500000 && s4.insurance.annualPremium === 6000
      && !!s4.fund && s4.fund.units === 88000 && s4.fund.annualContribution === 12000
      && s4.city === 'metro' && s4.playing && !s4.banner,
    JSON.stringify(s4)
  )
  void s4before

  // S5 缺失象限：四字段全缺（= 最老的 v2 档形态）→ 加载成功、语义为「无房/无保单/未开户/老家」、可推进
  await mutateSave(`delete raw.state.home; delete raw.state.insurance; delete raw.state.fund; delete raw.state.city`)
  await continueGame('S5')
  const s5 = await evalJs(`(() => {
    const st = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).state
    return {
      hasHome: 'home' in st, hasIns: 'insurance' in st, hasFund: 'fund' in st, hasCity: 'city' in st,
      banner: [...document.querySelectorAll('[role="alert"], .banner')].map((b) => b.textContent.slice(0, 100)).find((t) => t.length > 0) ?? null,
      playing: !!document.querySelector('.topbar-age'),
    }
  })()`)
  // 推进一年：缺失语义下引擎必须能正常走完年度结算（不是「能打开但一推进就炸」）
  let s5advance = false
  try {
    await evalJs(`document.querySelector('.event-card .choice-btn:not(.locked)')?.click()`)
    await waitFor(`!!document.querySelector('.result-panel')`, 5000, 's5 panel')
    await evalJs(`document.querySelector('.result-panel button').click()`)
    await waitFor(`!!document.querySelector('.topbar-age')`, 5000, 's5 next year')
    s5advance = await evalJs(`(() => {
      const st = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).state
      return st.age === 19 && !('home' in st) && !('insurance' in st) && !('fund' in st) && !('city' in st)
    })()`)
  } catch (e) {
    s5advance = false
  }
  report(
    'S5 四字段缺失（旧 v2 档形态）：加载成功、缺省语义正确、跨年结算正常',
    !s5.hasHome && !s5.hasIns && !s5.hasFund && !s5.hasCity && s5.playing && !s5.banner && s5advance,
    JSON.stringify({ ...s5, advance: s5advance })
  )

  // S6 bloodline 键独立性：血脉键与往生录键都不被存档读写触碰，且不写进存档结构
  const BLOODLINE_SEED = JSON.stringify({
    generation: 3, surname: '\u6797', inheritanceMoney: 123456,
    ancestorName: '\u6797\u665a', ancestorEndingId: 'pillar', finishedAt: 1750000000000,
  })
  // 往生录条目必须给全 LegacyEntry 的必填字段（name/endingId/endingName/grade/age/
  // peakMoney/epitaph/achievements/seed/finishedAt）。首版只给了 id+name+age+endingId，
  // 首页渲染往生录时读 achievements.map 抛错 → 整页白屏、按钮数为 0 → S6 假红。
  // 该现象源于「注入不合法数据」（真实玩家不会手写 localStorage），已登记为健壮性观察项，
  // 本轮只修不扩、不改 legacy.ts 产品源码。
  const LEGACY_SEED = JSON.stringify([{
    name: '陈知远', endingId: 'calm', endingName: '安静', grade: 'B',
    age: 77, peakMoney: 1234567, epitaph: '安静的一生',
    achievements: ['ach_debt_free'], seed: 12345, finishedAt: 1750000000000,
  }])
  // 注意：BLOODLINE_SEED / LEGACY_SEED 已是 JSON 文本，注入页面时**必须再套一层
  // JSON.stringify** 转成 JS 字符串字面量——直接插值等于给 setItem 传对象字面量，
  // 会被隐式转成字符串 "[object Object]"（本轮首版 S6 即栽在这里，假红）。
  await evalJs(`localStorage.setItem(${JSON.stringify(BLOODLINE_KEY)}, ${JSON.stringify(BLOODLINE_SEED)}); true`)
  await evalJs(`localStorage.setItem(${JSON.stringify(LEGACY_KEY)}, ${JSON.stringify(LEGACY_SEED)}); true`)
  await mutateSave(FOUR_FIELDS)
  await continueGame('S6')
  const s6mid = await evalJs(`(() => ({
    bloodline: localStorage.getItem(${JSON.stringify(BLOODLINE_KEY)}),
    legacy: localStorage.getItem(${JSON.stringify(LEGACY_KEY)}),
    saveHasBloodline: (localStorage.getItem(${JSON.stringify(SAVE_KEY)}) || '').includes('inheritanceMoney'),
    bloodlineKeyCount: Object.keys(localStorage).filter((k) => k.startsWith('another-life:')).length,
  }))()`)
  // 模拟终局清档（removeItem 存档键）→ 血脉与往生录必须原样留存
  await evalJs(`localStorage.removeItem(${JSON.stringify(SAVE_KEY)}); true`)
  const s6 = await evalJs(`(() => ({
    bloodline: localStorage.getItem(${JSON.stringify(BLOODLINE_KEY)}),
    legacy: localStorage.getItem(${JSON.stringify(LEGACY_KEY)}),
  }))()`)
  report(
    'S6 bloodline 键独立：存档读写与清档均不触碰血脉/往生录，血脉不写进存档结构',
    s6mid.bloodline === BLOODLINE_SEED && s6mid.legacy === LEGACY_SEED && !s6mid.saveHasBloodline
      && s6.bloodline === BLOODLINE_SEED && s6.legacy === LEGACY_SEED
      && s6mid.bloodlineKeyCount >= 2,
    JSON.stringify({ afterContinue: { bl: s6mid.bloodline === BLOODLINE_SEED, lg: s6mid.legacy === LEGACY_SEED, inSave: s6mid.saveHasBloodline, keys: s6mid.bloodlineKeyCount }, afterClear: { bl: s6.bloodline === BLOODLINE_SEED, lg: s6.legacy === LEGACY_SEED } })
  )
  // 清掉本轮种下的血脉/往生录，不污染后续手动使用该 profile 的场景
  await evalJs(`localStorage.removeItem(${JSON.stringify(BLOODLINE_KEY)}); localStorage.removeItem(${JSON.stringify(LEGACY_KEY)}); true`)

  const fails = results.filter((r) => !r.pass).length
  console.log(`\nSUMMARY: ${results.length - fails}/${results.length} PASS`)
  process.exit(fails > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL', e.message ?? e)
  try { chrome.kill() } catch {}
  try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }) } catch {}
  process.exit(2)
}).finally(() => {
  try { chrome.kill() } catch {}
  try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }) } catch {}
})
