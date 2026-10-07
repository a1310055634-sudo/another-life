// 第 32 轮设计系统重构验收：三视口（375/768/1280）CDP 截图 + 逐页横向溢出检测。
// 每视口独立 Chrome 实例（独立 user-data-dir，防 localStorage/缓存污染），
// 每视口走完整流程：首页 → 创建页 → 游戏页(推2年) → 结果面板 → 结局页，各截一张 PNG。
// 前置：无（脚本自起 headless Chrome，端口 9224/9225/9226 避让 9227）。
// 运行：node scripts/round32_viewport_shots.mjs
import { spawn, execSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const FILE_URL = 'file:///D:/vibe%20coding/another-life/dist/index.html'
const OUT_DIR = join(fileURLToPath(new URL('../', import.meta.url)), '.round32-shots')
mkdirSync(OUT_DIR, { recursive: true })

const VIEWPORTS = [
  { name: 'mobile', w: 375, h: 812, port: 9224, mobile: true },
  { name: 'tablet', w: 768, h: 1024, port: 9225, mobile: false },
  { name: 'desktop', w: 1280, h: 800, port: 9226, mobile: false },
]

const results = []
function report(step, pass, evidence) {
  results.push({ step, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${step} | ${evidence}`)
}

async function runViewport(vp) {
  const userData = mkdtempSync(join(tmpdir(), `al32-${vp.name}-`))
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${vp.port}`,
    `--user-data-dir=${userData}`,
    `--window-size=${vp.w},${vp.h}`,
    '--no-first-run', '--disable-gpu', 'about:blank',
  ], { stdio: 'ignore' })
  try {
    // 等调试端口就绪
    let ok = false
    for (let i = 0; i < 50; i++) {
      try { await fetch(`http://127.0.0.1:${vp.port}/json`); ok = true; break } catch { await sleep(200) }
    }
    if (!ok) throw new Error(`${vp.name}: CDP 端口未就绪`)

    const list = await (await fetch(`http://127.0.0.1:${vp.port}/json`)).json()
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
      if (r.exceptionDetails) throw new Error('page eval error: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
      return r.result.value
    }
    const shot = async (file) => {
      const { data } = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(OUT_DIR, file), Buffer.from(data, 'base64'))
    }

    await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.mobile })
    await send('Page.enable')
    await send('Page.navigate', { url: FILE_URL })
    await waitForIn(evalJs, `document.readyState === 'complete'`, 10000, 'load')
    await sleep(700)
    await evalJs(`(() => { window.__errs = []; window.addEventListener('error', (e) => window.__errs.push(String(e.message).slice(0, 200))); return true })()`)

    const OF = `(() => ({ w: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }))()`

    // P1 首页
    let of = await evalJs(OF)
    await shot(`${vp.name}-1-home.png`)
    report(`${vp.name} 首页加载无横向溢出`, !of.overflow, JSON.stringify(of))

    // P2 创建页
    await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('开始新人生')).click()`)
    await waitForIn(evalJs, `!!document.querySelector('#name-input')`, 5000, 'creation')
    await evalJs(`(() => {
      const inp = document.querySelector('#name-input')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(inp, '视口旅人')
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    await evalJs(`(() => { document.querySelectorAll('.opt-grid')[0].querySelector('button').click(); document.querySelectorAll('.opt-grid')[1].querySelector('button').click(); return true })()`)
    await sleep(250)
    of = await evalJs(OF)
    await shot(`${vp.name}-2-creation.png`)
    report(`${vp.name} 创建页无横向溢出`, !of.overflow, JSON.stringify(of))

    // P3 游戏页（推进 2 年，含选择与结算）
    await evalJs(`document.querySelector('.creation-actions .btn-primary').click()`)
    await waitForIn(evalJs, `!!document.querySelector('.topbar-age')`, 6000, 'game')
    for (let i = 0; i < 2; i++) {
      await evalJs(`document.querySelector('.event-card .choice-btn:not(.locked)')?.click()`)
      await waitForIn(evalJs, `!!document.querySelector('.result-panel')`, 5000, 'panel ' + i)
      if (i === 0) {
        of = await evalJs(OF)
        await shot(`${vp.name}-4-result.png`)
        report(`${vp.name} 结果面板无横向溢出`, !of.overflow, JSON.stringify(of))
      }
      await evalJs(`[...document.querySelectorAll('.result-panel button')].find(b => b.textContent.includes('进入下一年')).click()`)
      await waitForIn(evalJs, `!!document.querySelector('.event-card') || !!document.querySelector('.result-panel')`, 5000, 'next ' + i)
    }
    of = await evalJs(OF)
    await shot(`${vp.name}-3-game.png`)
    report(`${vp.name} 游戏页无横向溢出`, !of.overflow, JSON.stringify(of))

    // P5 推进到结局页
    let ending = null
    for (let i = 0; i < 800; i++) {
      const step = await evalJs(`(() => {
        const endName = document.querySelector('.ending-name')
        if (endName) return { kind: 'ending', name: endName.textContent, grade: document.querySelector('.ending-grade')?.textContent }
        const choice = document.querySelector('.event-card .choice-btn:not(.locked)')
        if (choice) { choice.click(); return { kind: 'choice' } }
        const next = [...document.querySelectorAll('.result-panel button')].find(b => b.textContent.includes('进入下一年'))
        if (next) { next.click(); return { kind: 'next' } }
        const skip = [...document.querySelectorAll('button')].find(b => b.textContent.includes('跳过这一年'))
        if (skip) { skip.click(); return { kind: 'skip' } }
        return { kind: 'stuck' }
      })()`)
      if (step.kind === 'ending') { ending = step; break }
      if (step.kind === 'stuck') break
      await sleep(40)
    }
    await sleep(400)
    of = await evalJs(OF)
    await shot(`${vp.name}-5-ending.png`)
    const epilogue = await evalJs(`!!document.querySelector('.card') && document.body.textContent.includes('后记')`)
    report(`${vp.name} 推进到结局页且无横向溢出`, !!ending && !of.overflow, ending ? `${ending.name} ${ending.grade} overflow=${of.overflow}` : '未到达 ' + JSON.stringify(of))
    report(`${vp.name} 结局页含后记卡（第 30 轮接线仍在）`, epilogue, `epilogue=${epilogue}`)

    const errs = await evalJs(`window.__errs ?? []`)
    report(`${vp.name} 全程无页面异常`, errs.length === 0, JSON.stringify(errs.slice(0, 3)))
    ws.close()
  } finally {
    try { chrome.kill() } catch {}
    try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }) } catch {}
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitForIn(evalJs, expr, timeoutMs, label) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    if (await evalJs(expr)) return
    await sleep(120)
  }
  throw new Error('waitFor timeout: ' + label)
}

for (const vp of VIEWPORTS) {
  console.log(`\n──── 视口 ${vp.name} ${vp.w}×${vp.h} ────`)
  await runViewport(vp)
}

const fails = results.filter((r) => !r.pass).length
console.log(`\nSUMMARY: ${results.length - fails}/${results.length} PASS（截图目录 ${OUT_DIR}）`)
process.exit(fails > 0 ? 1 : 0)
