// 第 36 轮（属性雷达与人生时间轴）浏览器级验收：
// ① 真实对局到终局：结局页雷达出现，radar-final polygon points 与页面内按同一公式
//    对 attr-grid 五维终值的复算逐字符相等（DOM 两层同源），radar-base 与「终局前缓存存档」
//    的 snapshots[0] 复算逐字符相等（跨层同源），坐标全有限；
// ② 新局有快照 → 基准环与图例两项齐备，polygon 总数 5（终值+基准+三层网格）、circle 10；
// ③ 终局年补快照：结局页曲线点数 = 终局前缓存存档快照长度 + 1；
// ④ 时间轴：li 数 = 标题「N 件事」，tl-key 与 history-star 数相等，关键节点 ::before 金色；
// ⑤ 注入空履历存档：不渲染时间轴，空态文案出现，雷达不受影响；
// ⑥ 注入旧档空快照存档：雷达降级为仅终值多边形（无 radar-base/lg-base），曲线块隐藏；
// ⑦ 375×812：中途游戏页与终局结局页（雷达区/时间轴区）零横向溢出，截图留档；
// ⑧ 全程零页面错误。
// 注意：终局后 App 清档（第 21 轮设计），故推进循环内每步缓存 localStorage 快照
// （window.__lastSave = 终局前一瞬的完整存档），终局后的一切存档对照都基于该缓存。
// 独立 Chrome（独立 user-data-dir，端口 9239 避让）。前置：npm run build 已产出最新 dist。
// 运行：node scripts/round36_check.mjs
import { spawn, execSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const FILE_URL = 'file:///D:/vibe%20coding/another-life/dist/index.html'
const SHOT_DIR = 'scripts/.round36-shots'

const results = []
function report(step, pass, evidence) {
  results.push({ step, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${step} | ${evidence}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const userData = mkdtempSync(join(tmpdir(), 'al36-radar-'))
const chrome = spawn(CHROME, [
  '--headless=new',
  '--remote-debugging-port=9239',
  `--user-data-dir=${userData}`,
  '--window-size=420,820',
  '--no-first-run', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' })

try {
  let ok = false
  for (let i = 0; i < 50; i++) {
    try { await fetch('http://127.0.0.1:9239/json'); ok = true; break } catch { await sleep(200) }
  }
  if (!ok) throw new Error('CDP 端口未就绪')
  const list = await (await fetch('http://127.0.0.1:9239/json')).json()
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

  // 页面内自动推进：事件卡点首个非锁定选项、结算面板点进入下一年，直到目标年龄或终局。
  // 每步缓存 localStorage 存档字符串（终局后 App 清档，此缓存即终局前一瞬的完整存档）。
  await evalJs(`(() => {
    window.__lastSave = null
    window.__cacheSave = () => {
      const s = localStorage.getItem('another-life:save')
      if (s) window.__lastSave = s
      return true
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
        window.__cacheSave()
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
    setter.call(inp, '雷达体检员')
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

  // 推进到 30 岁：游戏页不应出现雷达/时间轴（本轮只改结局页）
  const play1 = await evalJs(`window.__play(30)`)
  report('真实对局推进到 30 岁', play1 && play1.age >= 30 && !play1.ended && !play1.stuck, JSON.stringify(play1))
  const gameLeak = await evalJs(`({ radar: !!document.querySelector('.life-radar'), tl: !!document.querySelector('.life-timeline') })`)
  report('游戏页不渲染雷达与时间轴（呈现改动只落结局页）',
    gameLeak.radar === false && gameLeak.tl === false, JSON.stringify(gameLeak))

  // 375 视口：游戏页抽查零溢出（本轮未改游戏页，防 CSS 波及），截图留档
  await viewport375(true)
  const gameOv = await evalJs(overflow)
  await shot('game-375.png')
  await viewport375(false)
  report('375×812 游戏页无横向溢出', gameOv.sw <= 375, JSON.stringify(gameOv))

  // 推进到终局
  const play2 = await evalJs(`window.__play(200)`)
  report('真实对局推进到终局', play2 && play2.ended && !play2.stuck, JSON.stringify(play2))

  // 终局诊断：结局名/评级/终龄（记录本轮浏览器路径的实际终局）
  const endDiag = await evalJs(`(() => ({
    name: (document.querySelector('.ending-name') || {}).textContent || null,
    grade: (document.querySelector('.ending-grade') || {}).textContent || null,
    facts: (document.querySelector('.ending-facts') || {}).textContent || null,
    saveCleared: localStorage.getItem('another-life:save') === null,
  }))()`)
  report('终局后存档按设计清档（__lastSave 缓存兜底）',
    endDiag.saveCleared === true && !!endDiag.facts, JSON.stringify(endDiag))

  // ①② 雷达：attr-grid 五维终值（DOM）与 radar-final 同公式复算逐字符相等；
  //      radar-base 与终局前缓存存档的 snapshots[0] 同公式复算逐字符相等
  const radarCheck = await evalJs(`(() => {
    const save = window.__lastSave ? JSON.parse(window.__lastSave) : null
    const KEYS = ['health', 'happiness', 'smarts', 'social', 'stress']
    const CX = 160, CY = 130, R = 92, A0 = -Math.PI / 2, STEP = Math.PI * 2 / 5
    const clamp = (k, v) => { if (!Number.isFinite(v)) return k === 'stress' ? 0 : 50; return Math.max(0, Math.min(100, Math.round(v))) }
    const pt = (r, i) => { const a = A0 + STEP * i; return [Math.round((CX + r * Math.cos(a)) * 100) / 100, Math.round((CY + r * Math.sin(a)) * 100) / 100] }
    const ptsOf = (vals) => KEYS.map((k, i) => { const [x, y] = pt(clamp(k, vals[k]) / 100 * R, i); return x + ',' + y }).join(' ')
    // 终值来自页面 attr-grid（ATTR_KEYS 顺序五个 <b>）
    const gridVals = [...document.querySelectorAll('.ending .ending-attr b')].map((el) => parseInt(el.textContent))
    const expectedFinal = gridVals.length === 5 ? ptsOf(KEYS.reduce((o, k, i) => (o[k] = gridVals[i], o), {})) : null
    const finalEl = document.querySelector('.ending .life-radar polygon.radar-final')
    const baseEl = document.querySelector('.ending .life-radar polygon.radar-base')
    const actualFinal = finalEl ? finalEl.getAttribute('points') : null
    const allFinite = actualFinal ? actualFinal.split(' ').every((p) => p.split(',').every((v) => Number.isFinite(parseFloat(v)))) : false
    const base = save && save.state && Array.isArray(save.state.snapshots) && save.state.snapshots.length > 0 ? save.state.snapshots[0] : null
    const baseValid = !!base && KEYS.every((k) => Number.isFinite(base.attrs && base.attrs[k]))
    const expectedBase = baseValid ? ptsOf(base.attrs) : ''
    const polys = document.querySelectorAll('.ending .life-radar svg polygon').length
    const circles = document.querySelectorAll('.ending .life-radar svg circle').length
    const legendItems = document.querySelectorAll('.ending .radar-legend i').length
    const legendText = (document.querySelector('.ending .radar-legend') || {}).textContent || ''
    const fig = document.querySelector('.ending .life-radar')
    const curvePts = document.querySelector('.ending .asset-curve polyline')
    return {
      gridVals, expectedFinal, actualFinal,
      finalEqual: expectedFinal !== null && expectedFinal === actualFinal, allFinite,
      basePresent: !!baseEl, baseEqual: baseEl ? baseEl.getAttribute('points') === expectedBase : null,
      polys, circles, legendItems, legendHasBase: legendText.includes('开局'),
      aria: fig ? fig.getAttribute('aria-label') : null,
      saveSnapLen: save && save.state && Array.isArray(save.state.snapshots) ? save.state.snapshots.length : -1,
      curvePtCount: curvePts ? curvePts.getAttribute('points').split(' ').length : -1,
    }
  })()`)
  report('雷达终值 polygon 与页面 attr-grid 五维同公式复算逐字符一致',
    !!radarCheck && radarCheck.finalEqual,
    `grid=${JSON.stringify(radarCheck && radarCheck.gridVals)} equal=${radarCheck && radarCheck.finalEqual}`)
  report('雷达坐标全部有限（无 NaN/Infinity）',
    !!radarCheck && radarCheck.allFinite, `allFinite=${radarCheck && radarCheck.allFinite}`)
  report(`基准环与终局前存档 snapshots[0] 同公式一致（缓存快照 ${radarCheck && radarCheck.saveSnapLen} 条）`,
    !!radarCheck && radarCheck.basePresent && radarCheck.baseEqual === true,
    `basePresent=${radarCheck && radarCheck.basePresent} baseEqual=${radarCheck && radarCheck.baseEqual}`)
  report('polygon 总数 5（终值+基准+三层网格）、circle 10（终值点+基准点各 5）',
    !!radarCheck && radarCheck.polys === 5 && radarCheck.circles === 10,
    `polys=${radarCheck && radarCheck.polys} circles=${radarCheck && radarCheck.circles}`)
  report('图例两项且含开局基准说明',
    !!radarCheck && radarCheck.legendItems === 2 && radarCheck.legendHasBase,
    `items=${radarCheck && radarCheck.legendItems} hasBase=${radarCheck && radarCheck.legendHasBase}`)
  report('雷达 aria-label 报五维终值与开局基准',
    !!radarCheck && /^五维属性雷达：健康 \d+、幸福 \d+、能力 \d+、人际 \d+、压力 \d+；虚线为 18 岁开局基准$/.test(radarCheck.aria || ''),
    `aria="${radarCheck && radarCheck.aria}"`)
  report(`终局年补快照：结局页曲线点数 = 终局前存档快照长度 + 1（${radarCheck && radarCheck.saveSnapLen}+1）`,
    !!radarCheck && radarCheck.curvePtCount === radarCheck.saveSnapLen + 1,
    `curvePts=${radarCheck && radarCheck.curvePtCount}`)

  // ④ 时间轴：标题 N 件事与 li 数一致；★ 节点金色（::before 计算样式）
  const tlCheck = await evalJs(`(() => {
    const h3 = [...document.querySelectorAll('.ending .card-subtitle')].find((el) => el.textContent.includes('人生时间线'))
    const m = h3 ? h3.textContent.match(/（(\\d+) 件事）/) : null
    const titleN = m ? parseInt(m[1]) : -1
    const lis = document.querySelectorAll('.ending .life-timeline > li').length
    const keyLis = document.querySelectorAll('.ending .life-timeline li.tl-key').length
    const stars = document.querySelectorAll('.ending .life-timeline .history-star').length
    const keyDot = document.querySelector('.ending .life-timeline li.tl-key')
    const plainDot = document.querySelector('.ending .life-timeline li:not(.tl-key)')
    const keyStyle = keyDot ? getComputedStyle(keyDot, '::before').borderColor : null
    const plainStyle = plainDot ? getComputedStyle(plainDot, '::before').borderColor : null
    const save = window.__lastSave ? JSON.parse(window.__lastSave) : null
    return { titleN, lis, keyLis, stars, keyStyle, plainStyle,
      saveHistLen: save && save.state && Array.isArray(save.state.history) ? save.state.history.length : -1 }
  })()`)
  report(`时间轴条目数 = 标题件数（${tlCheck && tlCheck.titleN}）且 = 终局前存档 history 长度 + 终局年`,
    !!tlCheck && tlCheck.lis === tlCheck.titleN && tlCheck.titleN >= tlCheck.saveHistLen,
    `lis=${tlCheck && tlCheck.lis} title=${tlCheck && tlCheck.titleN} 终局前history=${tlCheck && tlCheck.saveHistLen}`)
  report('★ 关键节点：tl-key 与 history-star 数量一致且大于 0',
    !!tlCheck && tlCheck.keyLis === tlCheck.stars && tlCheck.keyLis > 0,
    `keyLis=${tlCheck && tlCheck.keyLis} stars=${tlCheck && tlCheck.stars}`)
  report('关键节点金色描边区别于普通节点灰边（::before 计算样式）',
    !!tlCheck && tlCheck.keyStyle && tlCheck.plainStyle && tlCheck.keyStyle !== tlCheck.plainStyle && tlCheck.keyStyle.includes('184, 134, 11'),
    `key=${tlCheck && tlCheck.keyStyle} plain=${tlCheck && tlCheck.plainStyle}`)

  // ⑥ 375 视口：结局页雷达区与时间轴区零溢出，截图留档
  await evalJs(`(() => { const el = document.querySelector('.ending .life-radar'); if (el) el.scrollIntoView({ block: 'center' }); return true })()`)
  await viewport375(true)
  const radarOv = await evalJs(overflow)
  await shot('ending-radar-375.png')
  await evalJs(`(() => { const el = document.querySelector('.ending .life-timeline'); if (el) el.scrollIntoView({ block: 'start' }); return true })()`)
  await sleep(200)
  const tlOv = await evalJs(overflow)
  await shot('ending-timeline-375.png')
  await viewport375(false)
  report('375×812 结局页（雷达区）无横向溢出', radarOv.sw <= 375, JSON.stringify(radarOv))
  report('375×812 结局页（时间轴区）无横向溢出', tlOv.sw <= 375, JSON.stringify(tlOv))

  // ⑤⑥ 注入存档段：Node 侧持终局前缓存存档（window 变量跨 reload 消失）。
  // 缓存存档是 playing 态且终局后真档已清——注入时把 phase 置为 ended，
  // reload 后首页点「继续游戏」即按 App 渲染分支直接进 EndingPage（fileui_verify 同款姿势）。
  // 每次注入完成后重建页面错误钩子（reload 会重置 window）。
  const lastSaveStr = await evalJs(`window.__lastSave`)
  if (!lastSaveStr) throw new Error('终局前存档缓存缺失')
  const injectAndReload = async (mutate) => {
    const d = JSON.parse(lastSaveStr)
    mutate(d)
    d.state.phase = 'ended'
    const payload = JSON.stringify(JSON.stringify(d))
    await evalJs(`localStorage.setItem('another-life:save', ${payload}); location.reload(); true`)
    await sleep(1200)
    const t = Date.now()
    while (Date.now() - t < 10000) {
      if (await evalJs(`document.readyState === 'complete'`)) break
      await sleep(150)
    }
    await sleep(500)
    await evalJs(`(() => {
      window.__errs = []
      window.addEventListener('error', (e) => window.__errs.push(String(e.message)))
      window.addEventListener('unhandledrejection', (e) => window.__errs.push('rejection:' + String(e.reason)))
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('继续游戏'))
      if (b) b.click()
      return !!b
    })()`)
    const tw = Date.now()
    while (Date.now() - tw < 8000) {
      if (await evalJs(`!!document.querySelector('.ending')`)) break
      await sleep(150)
    }
  }

  await injectAndReload((d) => { d.state.history = [] })
  const emptyCheck = await evalJs(`(() => ({
    tl: !!document.querySelector('.ending .life-timeline'),
    emptyText: (document.querySelector('.ending .history-empty') || {}).textContent || null,
    radar: !!document.querySelector('.ending .life-radar polygon.radar-final'),
  }))()`)
  report('空履历注入：时间轴消失、空态文案出现、雷达不受影响',
    emptyCheck.tl === false && !!emptyCheck.emptyText && emptyCheck.radar === true,
    JSON.stringify(emptyCheck))

  await injectAndReload((d) => { d.state.snapshots = [] })
  const oldCheck = await evalJs(`(() => ({
    finalPoly: !!document.querySelector('.ending .life-radar polygon.radar-final'),
    basePoly: !!document.querySelector('.ending .life-radar polygon.radar-base'),
    legendItems: document.querySelectorAll('.ending .radar-legend i').length,
    curve: !!document.querySelector('.ending .asset-curve'),
    aria: document.querySelector('.ending .life-radar') ? document.querySelector('.ending .life-radar').getAttribute('aria-label') : null,
  }))()`)
  report('旧档空快照注入：雷达仍渲染但仅终值多边形、图例单项、曲线块隐藏',
    oldCheck.finalPoly === true && oldCheck.basePoly === false && oldCheck.legendItems === 1 && oldCheck.curve === false,
    JSON.stringify(oldCheck))
  report('旧档雷达 aria 括注旧档说明', /（旧档无开局基准，仅显示终值）$/.test(oldCheck.aria || ''), `aria="${oldCheck.aria}"`)

  // ⑧ 页面错误（reload 后钩子重建，此处覆盖注入段；终局段由各步断言独立覆盖）
  const errs = await evalJs(`window.__errs`)
  report('全程零页面错误（注入段）', Array.isArray(errs) && errs.length === 0,
    errs.length ? errs.slice(0, 3).join('；') : '0 错误')

  // ── R75（第 75 轮）：岁月长河——分段/过滤/锚点/空段（复用注入助手与真实局缓存存档）──
  await injectAndReload((d) => {})
  const river1 = await evalJs(`(() => {
    const segs = [...document.querySelectorAll('.river-seg')]
    const li = document.querySelectorAll('.ending .life-timeline > li').length
    const h3 = [...document.querySelectorAll('.ending .card-subtitle')].find((el) => el.textContent.includes('人生时间线'))
    const m = h3 ? h3.textContent.match(/（(\\d+) 件事）/) : null
    return {
      segs: segs.length,
      heads: segs.map((s) => s.querySelector('.river-seg-head')?.textContent ?? ''),
      li,
      n: m ? Number(m[1]) : -1,
      anchors: document.querySelectorAll('.river-anchor').length,
      chips: document.querySelectorAll('.river-chip').length,
    }
  })()`)
  report('R75-① 岁月长河分段：组头含年代、锚点与档位齐备、条目 li 总数=标题 N 件事',
    river1.segs >= 2 && river1.anchors === river1.segs && river1.chips === 3 && river1.li === river1.n,
    JSON.stringify(river1))

  await evalJs(`[...document.querySelectorAll('.river-chip')].find((b) => b.textContent.includes('转折'))?.click()`)
  await sleep(300)
  const river2 = await evalJs(`(() => {
    const pressed = [...document.querySelectorAll('.river-chip')]
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.textContent)
    const li = document.querySelectorAll('.ending .life-timeline > li').length
    const stars = document.querySelectorAll('.ending .life-timeline .history-star').length
    return { pressed, li, stars }
  })()`)
  report('R75-② ★转折过滤：aria-pressed 互斥、条目收缩且全部带 ★',
    river2.pressed.length === 1 && river2.pressed[0].includes('转折') && river2.li > 0 && river2.stars === river2.li,
    JSON.stringify(river2))

  await evalJs(`[...document.querySelectorAll('.river-chip')].find((b) => b.textContent.includes('丧失'))?.click()`)
  await sleep(300)
  const river3 = await evalJs(`(() => {
    const li = document.querySelectorAll('.ending .life-timeline > li').length
    const losses = [...document.querySelectorAll('.ending .life-timeline li .history-body b')].filter(
      (b) => b.textContent === '送别',
    ).length
    const empty = document.querySelectorAll('.river-empty').length
    return { li, losses, empty }
  })()`)
  report('R75-③ 丧失过滤：条目全为送别；过滤后空段显示空态不消失',
    river3.li === river3.losses && river3.empty >= 1,
    JSON.stringify(river3))

  await evalJs(`[...document.querySelectorAll('.river-anchor')].at(-1)?.click()`)
  await sleep(900)
  const river4 = await evalJs(`(() => {
    const segs = [...document.querySelectorAll('.river-seg')]
    const last = segs[segs.length - 1]
    const top = last ? last.getBoundingClientRect().top : -1
    return { top, vh: window.innerHeight }
  })()`)
  report('R75-④ 年代锚点导航：点击末段锚点滚动至段首入视口',
    river4.top >= -40 && river4.top < river4.vh,
    JSON.stringify(river4))
} finally {
  try { chrome.kill() } catch {}
  try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }) } catch {}
}

  const fails = results.filter((r) => !r.pass).length
  console.log(`\nSUMMARY: ${results.length - fails}/${results.length} PASS`)
  process.exit(fails > 0 ? 1 : 0)
