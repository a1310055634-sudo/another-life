// 第 35 轮（资产曲线图）浏览器级验收：
// ① 开局仅 1 条快照（18 岁）时游戏页不出现曲线折叠块（短快照优雅隐藏）；
// ② 推进多年后折叠块出现，展开为 SVG，标题年数与存档快照数一致；
// ③ 逐点一致：页面内按同一 buildCurve 公式对 localStorage 存档快照复算期望 points 串，
//    与 DOM polyline points 属性逐字符相等（数据同源 + 公式同源的双重浏览器级证据）；
// ④ 折线无 NaN/Infinity 坐标；
// ⑤ 375×812 视口下游戏页（展开曲线）与结局页零横向溢出，留档截图；
// ⑥ 终局年快照补一条：结局页曲线点数 = 终局前存档快照长度 + 1；
// ⑦ 全程零页面错误。
// 独立 Chrome（独立 user-data-dir，端口 9238 避让）。前置：npm run build 已产出最新 dist。
// 运行：node scripts/round35_curve_check.mjs
import { spawn, execSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const FILE_URL = 'file:///D:/vibe%20coding/another-life/dist/index.html'
const SHOT_DIR = 'scripts/.round35-shots'

const results = []
function report(step, pass, evidence) {
  results.push({ step, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${step} | ${evidence}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const userData = mkdtempSync(join(tmpdir(), 'al35-curve-'))
const chrome = spawn(CHROME, [
  '--headless=new',
  '--remote-debugging-port=9238',
  `--user-data-dir=${userData}`,
  '--window-size=420,820',
  '--no-first-run', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' })

try {
  let ok = false
  for (let i = 0; i < 50; i++) {
    try { await fetch('http://127.0.0.1:9238/json'); ok = true; break } catch { await sleep(200) }
  }
  if (!ok) throw new Error('CDP 端口未就绪')
  const list = await (await fetch('http://127.0.0.1:9238/json')).json()
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let msgId = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? reject(new Error(m.error.message)) : resolve(m.result)
    }
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++msgId, { resolve, reject })
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error('page eval error: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
    return r.result.value
  }
  const shot = async (name) => {
    mkdirSync(SHOT_DIR, { recursive: true })
    const r = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(SHOT_DIR, name), Buffer.from(r.data, 'base64'))
  }
  const viewport375 = async (on) => {
    if (on) {
      await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
    } else {
      await send('Emulation.clearDeviceMetricsOverride')
    }
    await sleep(300)
  }
  const overflow = `({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })`

  await send('Page.enable')
  await send('Page.navigate', { url: FILE_URL })
  const t0 = Date.now()
  while (Date.now() - t0 < 10000) {
    if (await evalJs(`document.readyState === 'complete'`)) break
    await sleep(120)
  }
  await sleep(700)
  // 页面错误钩子：本轮全部交互期间的 error / unhandledrejection 都算失败
  await evalJs(`(() => {
    window.__errs = []
    window.addEventListener('error', (e) => window.__errs.push(String(e.message)))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('rejection:' + String(e.reason)))
    return true
  })()`)

  // 页面内自动推进：事件卡点首个可选项、结算面板点进入下一年，直到目标年龄或终局。
  // 每次处于游戏页时抓取 localStorage 存档的快照长度（终局年对照的基准）。
  await evalJs(`(() => {
    window.__maxSnapLen = 0
    window.__snapLen = () => {
      try {
        const d = JSON.parse(localStorage.getItem('another-life:save'))
        return d && d.state && Array.isArray(d.state.snapshots) ? d.state.snapshots.length : 0
      } catch { return 0 }
    }
    window.__play = async (targetAge) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const wait = async (sel, ms) => {
        const t0 = Date.now()
        while (Date.now() - t0 < ms) { if (document.querySelector(sel)) return true; await sleep(30) }
        return false
      }
      let steps = 0
      while (steps < 400) {
        if (document.querySelector('.ending')) break
        const ageEl = document.querySelector('.topbar-age')
        const age = ageEl ? parseInt(ageEl.textContent) || 0 : 0
        if (age >= targetAge) break
        window.__maxSnapLen = Math.max(window.__maxSnapLen, window.__snapLen())
        if (document.querySelector('.result-panel')) {
          [...document.querySelectorAll('.result-panel button')].find(b => b.textContent.includes('进入下一年')).click()
          // 点击后先等 React commit 完成（微任务级）再查 DOM，防止读到旧卡/旧面板造成误点竞态
          await sleep(80)
          if (!(await wait('.event-card, .ending', 6000))) return { stuck: 'after-advance', steps }
        } else if (document.querySelector('.event-card')) {
          const b = document.querySelector('.event-card .choice-btn:not(.locked)')
          if (!b) return { stuck: 'no-choice', steps }
          b.click()
          await sleep(80)
          if (!(await wait('.result-panel, .ending', 6000))) return { stuck: 'after-choose', steps }
        } else {
          await sleep(80)
          if (!(await wait('.result-panel, .event-card, .ending', 6000))) return { stuck: 'idle', steps }
        }
        steps++
      }
      const ageEl = document.querySelector('.topbar-age')
      return {
        age: ageEl ? parseInt(ageEl.textContent) || null : null,
        ended: !!document.querySelector('.ending'),
        maxSnapLen: window.__maxSnapLen,
        steps,
      }
    }
    return true
  })()`)

  // 创建角色进入游戏页
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('开始新人生')).click()`)
  const t1 = Date.now()
  while (Date.now() - t1 < 5000) {
    if (await evalJs(`!!document.querySelector('#name-input')`)) break
    await sleep(120)
  }
  await evalJs(`(() => {
    const inp = document.querySelector('#name-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, '曲线体检员')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelectorAll('.opt-grid')[0].querySelector('button').click()
    document.querySelectorAll('.opt-grid')[1].querySelector('button').click()
    return true
  })()`)
  await sleep(250)
  await evalJs(`document.querySelector('.creation-actions .btn-primary').click()`)
  const t2 = Date.now()
  while (Date.now() - t2 < 6000) {
    if (await evalJs(`!!document.querySelector('.topbar-age')`)) break
    await sleep(120)
  }

  // ① 开局 18 岁（1 条快照）：不出现曲线折叠块
  const freshLen = await evalJs(`window.__snapLen()`)
  const freshFold = await evalJs(`!!document.querySelector('.asset-fold')`)
  report('开局 18 岁仅 1 条快照：曲线折叠块优雅隐藏', freshLen === 1 && freshFold === false,
    `snapshots=${freshLen} foldVisible=${freshFold}`)

  // 推进到 30 岁
  const play1 = await evalJs(`window.__play(30)`)
  report('真实对局推进到 30 岁（事件→结算逐年点击）',
    play1 && play1.age >= 30 && !play1.ended && !play1.stuck, JSON.stringify(play1))

  // ② 折叠块出现，标题年数 = 存档快照数；展开出现 SVG
  const savedLen = await evalJs(`window.__snapLen()`)
  const foldInfo = await evalJs(`(() => {
    const d = document.querySelector('.asset-fold')
    if (!d) return null
    return { summary: d.querySelector('summary').textContent }
  })()`)
  report('30 岁折叠块出现且标题年数与存档快照数一致',
    !!foldInfo && foldInfo.summary.includes(`资产曲线（${savedLen} 年）`),
    `summary="${foldInfo && foldInfo.summary}" 存档快照=${savedLen}`)
  await evalJs(`document.querySelector('.asset-fold summary').click()`)
  await sleep(200)
  const svgInfo = await evalJs(`(() => {
    const svg = document.querySelector('.asset-fold .asset-curve svg')
    const line = document.querySelector('.asset-fold .asset-curve polyline')
    if (!svg || !line) return null
    return { vb: svg.getAttribute('viewBox'), ptCount: line.getAttribute('points').split(' ').length }
  })()`)
  report('展开后 SVG 折线出现，点数与快照数一致',
    !!svgInfo && svgInfo.ptCount === savedLen, JSON.stringify(svgInfo) + ` 存档快照=${savedLen}`)

  // ③④ 逐点一致（页面内同公式复算）+ 无 NaN
  const pointCheck = await evalJs(`(() => {
    const d = JSON.parse(localStorage.getItem('another-life:save'))
    const snaps = d.state.snapshots
    const W = 320, TOP = 14, BOT = 132, PADX = 3
    const valid = snaps.filter((s) => Number.isFinite(s && s.money) && Number.isFinite(s && s.age))
    if (valid.length < 2) return { expected: null }
    const monies = valid.map((s) => s.money)
    const min = Math.min(...monies), max = Math.max(...monies), span = max - min
    const yOf = (m) => span === 0 ? (TOP + BOT) / 2 : BOT - ((m - min) / span) * (BOT - TOP)
    const last = valid.length - 1
    const r2 = (v) => Math.round(v * 100) / 100
    const expected = valid.map((s, i) => r2(PADX + ((W - PADX * 2) * i) / last) + ',' + r2(yOf(s.money))).join(' ')
    const actual = document.querySelector('.asset-fold .asset-curve polyline').getAttribute('points')
    const pairs = actual.split(' ')
    const allFinite = pairs.every((p) => p.split(',').every((v) => Number.isFinite(parseFloat(v))))
    return { expected, actual, equal: expected === actual, allFinite, n: pairs.length }
  })()`)
  report('曲线与存档快照逐点一致（同公式复算 = DOM points 属性）',
    !!pointCheck && pointCheck.equal, `n=${pointCheck && pointCheck.n} equal=${pointCheck && pointCheck.equal}`)
  report('折线坐标全部有限（无 NaN/Infinity）',
    !!pointCheck && pointCheck.allFinite, `allFinite=${pointCheck && pointCheck.allFinite}`)

  // ⑤ 375 视口：游戏页展开曲线不横向溢出，截图留档
  await evalJs(`document.querySelector('.asset-fold').scrollIntoView({ block: 'start' })`)
  await viewport375(true)
  const gameOv = await evalJs(overflow)
  await shot('game-curve-375.png')
  await viewport375(false)
  report('375×812 游戏页（展开曲线）无横向溢出', gameOv.sw <= 375, JSON.stringify(gameOv))

  // ⑥ 推进到终局
  const play2 = await evalJs(`window.__play(200)`)
  report('真实对局推进到终局', play2 && play2.ended && !play2.stuck, JSON.stringify(play2))
  const endingInfo = await evalJs(`(() => {
    const svg = document.querySelector('.ending .asset-curve svg')
    const line = document.querySelector('.ending .asset-curve polyline')
    const note = document.querySelector('.ending .asset-curve-note')
    if (!svg || !line) return null
    return {
      ptCount: line.getAttribute('points').split(' ').length,
      pairsFinite: line.getAttribute('points').split(' ').every((p) => p.split(',').every((v) => Number.isFinite(parseFloat(v)))),
      note: !!note,
      aria: document.querySelector('.ending .asset-curve').getAttribute('aria-label'),
    }
  })()`)
  report('结局页曲线出现，点数 = 终局前存档快照长度 + 1（终局年补一条）',
    !!endingInfo && endingInfo.ptCount === play2.maxSnapLen + 1,
    `points=${endingInfo && endingInfo.ptCount} 终局前存档=${play2.maxSnapLen} +1=${play2.maxSnapLen + 1}`)
  report('结局页折线坐标全部有限', !!endingInfo && endingInfo.pairsFinite, `finite=${endingInfo && endingInfo.pairsFinite}`)
  report('结局页曲线 aria-label 带真实年龄与最终金额（负资产结局容负号）',
    !!endingInfo && /资产曲线：18 岁至 \d+ 岁，最终 -?¥/.test(endingInfo.aria || ''),
    `aria="${endingInfo && endingInfo.aria}"`)

  // ⑤ 375 视口：结局页不横向溢出，截图留档
  await evalJs(`(() => { const el = document.querySelector('.ending .asset-curve'); if (el) el.scrollIntoView({ block: 'center' }); return true })()`)
  await viewport375(true)
  const endOv = await evalJs(overflow)
  await shot('ending-curve-375.png')
  await viewport375(false)
  report('375×812 结局页（含曲线）无横向溢出', endOv.sw <= 375, JSON.stringify(endOv))

  // ⑦ 页面错误
  const errs = await evalJs(`window.__errs`)
  report('全程零页面错误', Array.isArray(errs) && errs.length === 0,
    errs.length ? errs.slice(0, 3).join('；') : '0 错误')
} finally {
  try { chrome.kill() } catch {}
  try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }) } catch {}
}

const fails = results.filter((r) => !r.pass).length
console.log(`\nSUMMARY: ${results.length - fails}/${results.length} PASS`)
process.exit(fails > 0 ? 1 : 0)
