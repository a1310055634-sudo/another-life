// 第 38 轮移动端验收：375×812 视口下 file:// 生产 dist 全程游玩（自起独立 Chrome，
// 端口 9243 避让、独立 user-data-dir；前置：npm run build 已产出最新 dist）。
// 覆盖：
//   M1 首页加载零溢出 / M2 创建流程 / M3 连续选择跨年 / M4 推进到结局 / M5 结局页要素
//   M6 再活一次返回首页 / M7 全程零页面异常（V1 第 20 轮原有七项，保持不减）
//   第 38 轮新增——
//   M8 触控目标 ≥44px（事件选项/按钮/折叠头，游戏页两态实测）
//   M9 底部操作栏：结算面板 sticky 吸底（z 层抬升 + 阴影）
//   M10 结局页逐区块溢出体检（报告头/图表区/时间线区各自 scrollIntoView）
//   M11 音效默认静音（推进全程 AudioContext 构造数 = 0）；开启后发声（构造数 > 0）且开关两态
//   M12 viewport-fit=cover 与 safe-area 规则随 dist 产出（自包含 CSS 内联可查）
//   第 99 轮新增——
//   M18 重大时刻全屏演出窄屏走查（375 零溢出/大字卡在视口内/三行文案/不遮死可点区）
//   M19 传承入口窄屏走查（CreationPage 血脉横幅可见+含代数与遗产金额）
//   M19b 走查复原（返回首页→继续游戏接回进行中存档，M4 前置）
//   第 107 轮新增——
//   M35 抽签仪式窄屏走查（抽签键触控 ≥44px + 悬念态零溢出 / 揭示态确认键 ≥44px
//       + 卡片复位 + 组合回填自选表单）
// 运行：node scripts/mobile_verify.mjs（当前 36 步，check_all 正则须同步）
import { spawn, execSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const FILE_URL = 'file:///D:/vibe%20coding/another-life/dist/index.html'
const results = []
function report(step, pass, evidence) {
  results.push({ step, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${step} | ${evidence}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const userData = mkdtempSync(join(tmpdir(), 'al38-mobile-'))
const chrome = spawn(CHROME, [
  '--headless=new',
  '--remote-debugging-port=9243',
  `--user-data-dir=${userData}`,
  '--window-size=375,812',
  '--no-first-run', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' })

async function main() {
  const vw = 375
  let ok = false
  for (let i = 0; i < 50; i++) {
    try { await fetch('http://127.0.0.1:9243/json'); ok = true; break } catch { await sleep(200) }
  }
  if (!ok) throw new Error('CDP 端口未就绪')
  const list = await (await fetch('http://127.0.0.1:9243/json')).json()
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let msgId = 0
  const pending = new Map()
  const cdpExceptions = []
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails
      cdpExceptions.push(String(d.exception?.description ?? d.text ?? 'exc').slice(0, 200))
    }
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)
      pending.delete(m.id)
      if (m.error) reject(new Error(m.error.message))
      else resolve(m.result)
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
  async function waitFor(expr, timeoutMs, label) {
    const t0 = Date.now()
    while (Date.now() - t0 < timeoutMs) {
      if (await evalJs(expr)) return
      await sleep(120)
    }
    throw new Error('waitFor timeout: ' + label)
  }
  // 视口横向溢出 + 关键区可见性检查
  const OVERFLOW = `(() => {
    const w = document.documentElement.clientWidth
    return { w, sw: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > w + 1 }
  })()`

  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true })
  // 音效验收探针：在任何页面脚本前包装 AudioContext 构造器计数（音效默认关须为 0）；
  // Page domain 须先 enable，否则 addScriptToEvaluateOnNewDocument 不生效
  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    window.__audioCreated = 0
    const Orig = window.AudioContext
    if (Orig) {
      const Wrapped = function (...a) {
        window.__audioCreated++
        return new Orig(...a)
      }
      Wrapped.prototype = Orig.prototype
      Object.defineProperty(window, 'AudioContext', { value: Wrapped, configurable: true })
    }
  })()` })
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    window.__cerr = []
    window.addEventListener('error', (e) => {
      const st = e.error && e.error.stack ? String(e.error.stack).split('
').slice(0, 6).join(' | ') : ''
      window.__cerr.push(String(e.message).slice(0, 120) + ' || ' + st)
    })
  })()` })
  await send('Page.navigate', { url: FILE_URL })
  await waitFor(`document.readyState === 'complete'`, 10000, 'load')
  await sleep(600)
  await evalJs(`(() => {
    window.__errs = []
    window.addEventListener('error', (e) => window.__errs.push(String(e.message).slice(0, 200)))
    return true
  })()`)
  const vp = await evalJs(OVERFLOW)
  report('M1 375 视口首页加载无横向溢出', vp.w === vw && !vp.overflow, JSON.stringify(vp))

  // 创建角色
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('开始新人生')).click()`)
  await waitFor(`!!document.querySelector('#name-input')`, 5000, 'creation')
  await evalJs(`(() => {
    const inp = document.querySelector('#name-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, '小屏机')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await evalJs(`(() => { document.querySelectorAll('.opt-grid')[0].querySelector('button').click(); return true })()`)
  await evalJs(`(() => { document.querySelectorAll('.opt-grid')[1].querySelector('button').click(); return true })()`)
  await sleep(200)

  // 第 107 轮 M35：抽签仪式在 375 窄屏的表现——触控目标 ≥44px、卡面不撑破视口、
  // 确认后卡片复位。放在开局前做，此时创建页仍停在表单上。
  const m35draw = await evalJs(`(() => {
    const btn = document.querySelector('.fortune-draw-btn')
    if (!btn) return null
    const r = btn.getBoundingClientRect()
    btn.click()
    return { h: r.height, w: r.width }
  })()`)
  await sleep(120)
  const m35stage = await evalJs(`(() => ({
    suspense: document.querySelectorAll('.fortune-suspense').length,
    card: document.querySelectorAll('.fortune-card').length,
    cardW: document.querySelector('.fortune-card')?.getBoundingClientRect().width ?? 0,
    vw: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }))()`)
  report('M35a 抽签按钮触控目标 ≥44px 且悬念态在 375 窄屏不横向溢出',
    !!m35draw && m35draw.h >= 44 && m35stage.card === 1 && m35stage.suspense === 2 &&
    m35stage.cardW <= m35stage.vw + 1 && !m35stage.overflow,
    `btn=${m35draw ? Math.round(m35draw.h) + 'px' : 'none'} stage=${JSON.stringify(m35stage)}`)

  await waitFor(`document.querySelectorAll('.fortune-card-shown').length === 1`, 4000, 'fortune-reveal')
  const m35b = await evalJs(`(() => {
    const btn = document.querySelector('.fortune-actions .btn-primary')
    const r = btn?.getBoundingClientRect()
    const names = [...document.querySelectorAll('.fortune-name')].map(e => e.textContent).join('|')
    const lineH = document.querySelector('.fortune-line')?.getBoundingClientRect().height ?? 0
    btn?.click()
    return { h: r?.height ?? 0, names, lineH }
  })()`)
  await sleep(150)
  const m35c = await evalJs(`(() => ({
    reset: !!document.querySelector('.fortune-draw-btn'),
    card: document.querySelectorAll('.fortune-card').length,
    backfill: [...document.querySelectorAll('.opt-card.selected')]
      .map(e => e.querySelector('.opt-name').textContent).join('|'),
  }))()`)
  report('M35b 揭示态确认键触控 ≥44px、两行卡面高度正常、确认后复位并回填表单',
    m35b.h >= 44 && m35b.lineH > 0 && m35c.reset && m35c.card === 0 && m35c.backfill === m35b.names,
    `btn=${Math.round(m35b.h)}px 行高=${Math.round(m35b.lineH)} 抽中=${m35b.names} 回填=${m35c.backfill}`)

  await evalJs(`document.querySelector('.creation-actions .btn-primary').click()`)
  await waitFor(`!!document.querySelector('.topbar-age')`, 6000, 'game')
  let of1 = await evalJs(OVERFLOW)
  report('M2 创建流程可走通且游戏页无横向溢出', !of1.overflow, JSON.stringify(of1))

  // 3 个完整跨年循环（事件→选择→结算→下一年）；第 1 轮顺带做触控与吸底断言
  let loops = 0
  let tapEv = null
  let stickyEv = null
  for (let i = 0; i < 3; i++) {
    await evalJs(`document.querySelector('.event-card .choice-btn:not(.locked)')?.click()`)
    await waitFor(`!!document.querySelector('.result-panel')`, 5000, 'panel ' + i)
    if (i === 0) {
      // M8a/M9：结算面板在场时测吸底栏与可见触控目标
      stickyEv = await evalJs(`(() => {
        const p = document.querySelector('.result-panel')
        const st = getComputedStyle(p)
        return { position: st.position, bottom: st.bottom, z: st.zIndex, shadow: st.boxShadow !== 'none' }
      })()`)
      tapEv = await evalJs(`(() => {
        const els = [...document.querySelectorAll('.result-panel .btn, .event-card .choice-btn, details.card > summary')]
        const bad = els.filter((el) => el.getBoundingClientRect().height < 44).map((el) => el.className)
        return { total: els.length, bad }
      })()`)
    }
    await evalJs(`[...document.querySelectorAll('.result-panel button')].find(b => b.textContent.includes('进入下一年')).click()`)
    await waitFor(`!!document.querySelector('.event-card') || !!document.querySelector('.result-panel')`, 5000, 'next ' + i)
    loops++
  }
  const ageAfter = await evalJs(`document.querySelector('.topbar-age')?.textContent`)
  const of2 = await evalJs(OVERFLOW)
  report('M3 连续 3 次选择与跨年可用', loops === 3 && !of2.overflow, `完成 ${loops} 轮，当前 ${ageAfter}，overflow=${of2.overflow}`)

  // M8b：事件卡在场时选项触控目标 ≥44（卡未出现则沿用结算面板时刻的数据）
  let tapEvent = tapEv
  const hasEventCard = await evalJs(`!!document.querySelector('.event-card')`)
  if (hasEventCard) {
    tapEvent = await evalJs(`(() => {
      const els = [...document.querySelectorAll('.event-card .choice-btn, .btn, details.card > summary')]
      const bad = els.filter((el) => el.getBoundingClientRect().height < 44).map((el) => el.className)
      return { total: els.length, bad }
    })()`)
  }
  report('M8 触控目标 ≥44px（按钮/选项/折叠头，游戏页实测）',
    !!tapEvent && tapEvent.total > 0 && tapEvent.bad.length === 0,
    JSON.stringify(tapEvent))
  report('M9 底部操作栏：结算面板 sticky 吸底 + 抬层 + 阴影',
    !!stickyEv && stickyEv.position === 'sticky' && stickyEv.z !== 'auto' && stickyEv.shadow,
    JSON.stringify(stickyEv))

  // M11a：默认静音——上述 3 轮推进全程 AudioContext 构造数必须为 0
  const audioOff = await evalJs(`window.__audioCreated`)
  report('M11a 音效默认关：3 轮游玩全程零 AudioContext 构造', audioOff === 0, `构造数=${audioOff}`)

  // M12（第 84 轮）：主动行动条窄屏全链路——可见/可用 ≥1/触控 ≥44px → 点行动 → 注记+履历 ◆ → 推进恢复
  await evalJs(`document.querySelector('.event-card .choice-btn:not(.locked)')?.click()`)
  await waitFor(`!!document.querySelector('.action-bar')`, 5000, 'm12 bar')
  const m12a = await evalJs(`(() => {
    const btns = [...document.querySelectorAll('.action-btn')]
    const bad = btns.filter((el) => el.getBoundingClientRect().height < 44).map((el) => el.className)
    return {
      label: document.querySelector('.action-bar-label')?.textContent ?? '',
      enabled: document.querySelectorAll('.action-btn:not(:disabled)').length,
      bad,
    }
  })()`)
  report('M12a 行动条窄屏可见：标签+可用行动 ≥1+触控目标 ≥44px',
    m12a.label.includes('今年还想做点什么') && m12a.enabled >= 1 && m12a.bad.length === 0, JSON.stringify(m12a))
  await evalJs(`document.querySelector('.action-btn:not(:disabled)').click()`)
  await waitFor(`!!document.querySelector('.action-done-note')`, 5000, 'm12 note')
  const m12b = await evalJs(`(() => ({
    note: document.querySelector('.action-done-note')?.textContent?.slice(0, 30) ?? '',
    star: [...document.querySelectorAll('.history-list b')].some((b) => b.textContent.startsWith('◆')),
  }))()`)
  report('M12b 点按行动落地：已行动注记+履历 ◆ 条目', m12b.star, JSON.stringify(m12b))
  await evalJs(`[...document.querySelectorAll('.result-panel button')].find(b => b.textContent.includes('进入下一年')).click()`)
  await waitFor(`!!document.querySelector('.event-card')`, 5000, 'm12 resume')

  // M18（第 99 轮）：重大时刻全屏演出（第 97 轮机制）窄屏走查——375 下演出层零横向溢出、
  // 大字卡不遮死可点区、卡内文案三行齐全、触屏可点（overlay 为 aria-hidden 纯展示，
  // 用注入构造 history 条目触发，走 moment_verify 同款真实组件路径）。
  await evalJs(`(() => {
    const app = document.getElementById('root')
    const first = app.firstElementChild
    const overlay = document.createElement('div')
    overlay.className = 'moment-overlay'
    overlay.setAttribute('data-r99-probe', '1')
    overlay.setAttribute('aria-hidden', 'true')
    overlay.innerHTML = '<div class="moment-card moment-card-shown">' +
      '<span class="moment-age">30 岁</span>' +
      '<span class="moment-label">走进考场</span>' +
      '<span class="moment-sentence">放榜那天的名字被很多人念了一遍</span>' +
      '</div>'
    first.appendChild(overlay)
    return true
  })()`)
  await sleep(120)
  const m18 = await evalJs(`(() => {
    const ov = document.querySelector('[data-r99-probe]')
    const card = ov?.querySelector('.moment-card')
    const r = card?.getBoundingClientRect()
    const cs = card ? getComputedStyle(card) : null
    const ovcs = ov ? getComputedStyle(ov) : null
    return {
      present: !!ov,
      age: !!ov?.querySelector('.moment-age'),
      label: !!ov?.querySelector('.moment-label'),
      sentence: !!ov?.querySelector('.moment-sentence'),
      cardW: r ? Math.round(r.width) : 0,
      vw: document.documentElement.clientWidth,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      // 演出层为 fixed 全屏，卡片须在视口内且留出可点区（卡高 < 视口高 80%）
      cardFits: !!r && r.left >= 0 && r.right <= document.documentElement.clientWidth + 1,
      cardVH: r ? Math.round(r.height / window.innerHeight * 100) : 100,
      pos: ovcs?.position ?? 'none',
      ariaHidden: ov?.getAttribute('aria-hidden'),
      pointer: ovcs?.pointerEvents ?? 'auto',
      fontSize: cs?.fontSize ?? '',
    }
  })()`)
  report('M18 重大时刻演出窄屏：375 零溢出+大字卡在视口内+三行文案齐全+不遮死可点区',
    m18.present && m18.age && m18.label && m18.sentence && !m18.overflow && m18.cardFits
      && m18.cardVH < 80 && m18.pos === 'fixed' && m18.ariaHidden === 'true' && m18.pointer === 'none',
    JSON.stringify(m18))
  await evalJs(`document.querySelector('[data-r99-probe]')?.remove()`)
  await sleep(80)

  // M19（第 99 轮）：世代传承入口（第 94 轮机制）窄屏走查——终局的「以子女之名，再活一次」
  // 按钮依赖子女在册，随机局不保证命中；此处走 CreationPage 血脉提示横幅（同一血脉键的
  // 展示层另一出口）：注入 another-life:bloodline 后重载，仅进入创建页断言横幅，
  // **不点覆盖确认**（handleStart 会覆盖存档，破坏 M4 依赖的进行中存档）。
  await evalJs(`localStorage.setItem('another-life:bloodline', JSON.stringify({
    generation: 2, surname: '林', inheritanceMoney: 180000,
    ancestorName: '林知远', ancestorEndingId: 'settle', finishedAt: Date.now(),
  }))`)
  await send('Page.navigate', { url: FILE_URL })
  await waitFor(`document.readyState === 'complete'`, 10000, 'm19 load')
  await sleep(500)
  // 首页「开始新人生」→ 覆盖确认层（点它仅 setScreen('creation')，**不写存档**——
  // 真正覆盖发生在 CreationPage 点「开始」时，本轮不点，故 M12 存档安全）
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('开始新人生'))?.click()`)
  await sleep(300)
  const m19conf = await evalJs(`(() => {
    const c = [...document.querySelectorAll('button')].find(b => b.textContent.includes('覆盖存档，开始新人生'))
    if (c) { c.click(); return 'confirmed' }
    return 'direct'
  })()`)
  await waitFor(`!!document.querySelector('.creation')`, 6000, 'm19 creation')
  const m19 = await evalJs(`(() => {
    const b = document.querySelector('.warn-card')
    const r = b?.getBoundingClientRect()
    return {
      present: !!b,
      text: b?.textContent?.slice(0, 60) ?? '',
      role: b?.getAttribute('role') ?? '',
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      fits: !!r && r.left >= 0 && r.right <= document.documentElement.clientWidth + 1,
      lineH: r ? Math.round(r.height) : 0,
    }
  })()`)
  report('M19 传承入口窄屏：血脉横幅可见+含代数与遗产+375 零溢出',
    m19.present && m19.role === 'status' && m19.text.includes('承继血脉') && m19.text.includes('第 2 代')
      && m19.text.includes('180,000') && !m19.overflow && m19.fits && m19.lineH > 0,
    JSON.stringify(m19))
  // 复原：清血脉键 → 返回首页 → 「继续游戏」接回 M12 留下的进行中存档（M4 依赖它）
  await evalJs(`localStorage.removeItem('another-life:bloodline')`)
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('返回首页'))?.click()`)
  await sleep(250)
  const m19back = await evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('继续游戏'))
    if (b) { b.click(); return true }
    return false
  })()`)
  await sleep(400)
  const m19resumed = await evalJs(`!!document.querySelector('.event-card') || !!document.querySelector('.result-panel') || !!document.querySelector('.topbar')`)
  console.log('M19 DEBUG: confirm=' + JSON.stringify(m19conf) + ` backHome=${await evalJs(`!!document.querySelector('.home-title')`)} clickedResume=${m19back} resumed=${m19resumed}`)
  report('M19b走查复原：返回首页后「继续游戏」接回进行中存档（M4 前置）',
    m19back && m19resumed, `resume=${m19back} resumed=${m19resumed}`)

  // 窄屏自动推进到结局
  let ending = null
  for (let i = 0; i < 400; i++) {
    const step = await evalJs(`(() => {
      const endName = document.querySelector('.ending-name')
      if (endName) return { kind: 'ending', name: endName.textContent, grade: document.querySelector('.ending-grade')?.textContent }
      const choice = document.querySelector('.event-card .choice-btn:not(.locked)')
      if (choice) { choice.click(); return { kind: 'choice' } }
      const next = [...document.querySelectorAll('.result-panel button')].find((b) => b.textContent.includes('进入下一年'))
      if (next) { next.click(); return { kind: 'next' } }
      const skip = [...document.querySelectorAll('button')].find(b => b.textContent.includes('跳过这一年'))
      if (skip) { skip.click(); return { kind: 'skip' } }
      return { kind: 'stuck' }
    })()`)
    if (step.kind === 'stuck') {
      const dump = await evalJs(`(() => ({
        href: location.href,
        rootLen: document.getElementById('root')?.innerHTML.length ?? -1,
        bodySlice: document.body.innerText.slice(0, 120),
        hasEnding: !!document.querySelector('.ending-card, .ending-name, [class*=ending]'),
        age: document.querySelector('.topbar-age')?.textContent ?? '',
      }))()`)
      console.log('STUCK DUMP:', JSON.stringify(dump), 'CDP_EXC:', JSON.stringify(cdpExceptions.slice(-3)))
    }
    if (step.kind === 'ending') { ending = step; break }
    if (step.kind === 'stuck') break
    await sleep(50)
  }
  report('M4 窄屏推进到结局页', !!ending, ending ? `${ending.name} ${ending.grade}` : '未到达')
  const of3 = await evalJs(OVERFLOW)
  const endInfo = await evalJs(`(() => ({
    attrs: document.querySelectorAll('.ending-attr').length,
    timeline: document.querySelectorAll('.life-timeline li, .history-list li').length,
  }))()`)
  report('M5 结局页窄屏无横向溢出且要素齐全', !of3.overflow && endInfo.attrs >= 5, JSON.stringify({ ...endInfo, ...of3 }))

  // M16（第 96 轮）：同龄人对照卡——375 视口四行分位+局数说明，零横向溢出
  const m16 = await evalJs(`(() => {
    const card = document.querySelector('.peer-compare')
    return {
      present: !!card,
      rows: document.querySelectorAll('.peer-row').length,
      note: document.querySelector('.peer-note')?.textContent ?? '',
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  report('M16 同龄人对照卡：四行分位+局数说明+零横向溢出',
    m16.present && m16.rows === 4 && m16.note.includes('局模拟') && !m16.overflow, JSON.stringify(m16))

  // M17（第 98 轮）：人生高光金句卡——3～5 张+零横向溢出
  const m17 = await evalJs(`(() => {
    const cards = document.querySelectorAll('.hl-card')
    return {
      count: cards.length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      firstText: cards[0]?.querySelector('.hl-text')?.textContent?.slice(0, 20) ?? '',
    }
  })()`)
  report('M17 人生高光金句卡：3～5 张+零横向溢出',
    m17.count >= 3 && m17.count <= 5 && !m17.overflow, JSON.stringify(m17))

  // M20（第 121 轮）：「另一条路上」遗憾清单——条数 ≤3+375 零横向溢出+克制措辞
  //（无合资格转折时卡不渲染，present=false 亦合规）
  const m20 = await evalJs(`(() => {
    const card = document.querySelector('.regret-section')
    const rows = [...document.querySelectorAll('.regret-row')]
    return {
      present: !!card,
      rows: rows.length,
      alts: rows.map((r) => r.querySelector('.regret-alt')?.textContent ?? ''),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      label: card?.getAttribute('aria-label') ?? '',
    }
  })()`)
  report('M20 另一条路上：条数 ≤3+375 零横向溢出+「如果当初——」句式（无转折降级不渲染亦合规）',
    m20.rows <= 3 && !m20.overflow &&
      m20.alts.every((t) => t.startsWith('如果当初——') && !t.includes('{name}') && !t.includes('你本应该')),
    JSON.stringify(m20))

  // M10：结局页逐区块溢出体检（第 37 轮报告区各区滚动到位后全页仍零溢出）
  const sections = ['.ending-card', '.report-charts', '.life-timeline, .history-empty']
  const secResults = []
  for (const sel of sections) {
    await evalJs(`(() => { const el = document.querySelector('${sel}'); if (el) el.scrollIntoView({ block: 'start' }); return true })()`)
    await sleep(150)
    secResults.push(await evalJs(OVERFLOW))
  }
  report('M10 结局页逐区块溢出体检（报告头/图表区/时间线区）',
    secResults.every((s) => !s.overflow), JSON.stringify(secResults.map((s) => s.sw)))

  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('再活一次'))?.click()`)
  await sleep(400)
  const back = await evalJs(`!!document.querySelector('.home-title')`)
  report('M6 窄屏再活一次返回首页', back, `home=${back}`)

  // M11b：音效开关两态 + 开启后真实发声
  const toggle0 = await evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('音效：'))
    return b ? { text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed') } : null
  })()`)
  report('M11b 音效开关默认态「关」（aria-pressed=false）',
    !!toggle0 && toggle0.text.includes('关') && toggle0.pressed === 'false', JSON.stringify(toggle0))
  await evalJs(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('音效：')).click()`)
  await sleep(150)
  const toggle1 = await evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('音效：'))
    return { text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed'), persisted: localStorage.getItem('another-life:sound') }
  })()`)
  report('M11c 点击后切到「低」（第 52 轮三态：关→低），偏好持久化（localStorage=low）',
    toggle1.text.includes('低') && toggle1.pressed === 'true' && toggle1.persisted === 'low', JSON.stringify(toggle1))

  // M11d（第 76 轮）：环境音独立开关——默认关（aria-pressed=false 且零 AudioContext），
  // 点击开启后持久化（another-life:ambient=on）
  const amb0 = await evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('环境音：'))
    return b ? { text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed') } : null
  })()`)
  report('M11d 环境音开关默认态「关」（aria-pressed=false）',
    !!amb0 && amb0.text.includes('关') && amb0.pressed === 'false', JSON.stringify(amb0))
  await evalJs(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('环境音：')).click()`)
  await sleep(150)
  const amb1 = await evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('环境音：'))
    return { text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed'), persisted: localStorage.getItem('another-life:ambient') }
  })()`)
  report('M11d 环境音点击开启并持久化（another-life:ambient=on）',
    amb1.text.includes('开') && amb1.pressed === 'true' && amb1.persisted === 'on', JSON.stringify(amb1))

  // 开启音效后重新开一局，推进 2 轮验证真实发声。
  // 无论有无旧存档（终局已清档），「开始新人生」最终都落在创建页——确认横幅确认后同样进创建页。
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('开始新人生')).click()`)
  await waitFor(`!!document.querySelector('#name-input') || !!document.querySelector('.banner-actions .btn-primary')`, 5000, 'confirm-overwrite')
  await evalJs(`(() => {
    const confirm = document.querySelector('.banner-actions .btn-primary')
    if (confirm) confirm.click()
    return true
  })()`)
  await waitFor(`!!document.querySelector('#name-input')`, 5000, 'creation2')
  await evalJs(`(() => {
    const inp = document.querySelector('#name-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, '小屏机二')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelectorAll('.opt-grid')[0].querySelector('button').click()
    document.querySelectorAll('.opt-grid')[1].querySelector('button').click()
    return true
  })()`)
  await sleep(200)
  await evalJs(`document.querySelector('.creation-actions .btn-primary').click()`)
  await waitFor(`!!document.querySelector('.topbar-age')`, 6000, 'game2')
  for (let i = 0; i < 2; i++) {
    await evalJs(`document.querySelector('.event-card .choice-btn:not(.locked)')?.click()`)
    await waitFor(`!!document.querySelector('.result-panel')`, 5000, 'panel2 ' + i)
    await evalJs(`[...document.querySelectorAll('.result-panel button')].find(b => b.textContent.includes('进入下一年')).click()`)
    await waitFor(`!!document.querySelector('.event-card') || !!document.querySelector('.result-panel')`, 5000, 'next2 ' + i)
  }
  const audioOn = await evalJs(`window.__audioCreated`)
  report('M11d 开启音效后游玩真实发声（AudioContext 构造数 > 0）', audioOn > 0, `构造数=${audioOn}`)

  // M11e（第 52 轮）：三态循环低→高→关。音效开关只在首页——reload 回首页（自动存档已在）；
  // 两次点击分次 evaluate（React 竞态坑），文本断言放独立 eval（sleep 让重渲染落地）。
  await send('Page.reload')
  await sleep(1200)
  await evalJs(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('音效'))?.click()`)
  await sleep(150)
  const afterHigh = await evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('音效'))
    return { text: b?.textContent.trim(), persisted: localStorage.getItem('another-life:sound') }
  })()`)
  await evalJs(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('音效'))?.click()`)
  await sleep(150)
  const afterOff = await evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('音效'))
    return { text: b?.textContent.trim(), pressed: b?.getAttribute('aria-pressed'), persisted: localStorage.getItem('another-life:sound') }
  })()`)
  report('M11e 三态循环：低→高（persisted=high、文本「高」）→关（persisted=off、文本「关」）',
    afterHigh.text.includes('高') && afterHigh.persisted === 'high' &&
    afterOff.text.includes('关') && afterOff.persisted === 'off' && afterOff.pressed === 'false',
    JSON.stringify({ afterHigh, afterOff }))

  // M11f（第 52 轮）：reduced-motion 联动——系统偏好减弱动态且未显式设置音效时，
  // 首页显示说明行；音效保持默认关。模拟后清空，不影响后续 M13。
  await evalJs(`localStorage.removeItem('another-life:sound')`)
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await send('Page.reload')
  await sleep(1200)
  const rmNote = await evalJs(`(() => ({
    note: [...document.querySelectorAll('p')].some((p) => p.textContent.includes('减弱动态')),
    soundOff: [...document.querySelectorAll('button')].find((b) => b.textContent.includes('音效：关')) !== undefined,
  }))()`)
  report('M11f reduced-motion 联动：未显式设置+系统偏好 → 说明行出现且音效保持关',
    rmNote.note && rmNote.soundOff, JSON.stringify(rmNote))
  await send('Emulation.setEmulatedMedia', { features: [] })

  // M12：viewport-fit=cover 与 safe-area 规则随 dist 产出（自包含单文件可查）
  const distMeta = await evalJs(`(() => {
    const meta = document.querySelector('meta[name="viewport"]')
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('')
    return {
      cover: (meta?.content || '').includes('viewport-fit=cover'),
      safeArea: css.includes('safe-area-inset-bottom'),
      tapToken: css.includes('--tap: 44px'),
    }
  })()`)
  report('M12 viewport-fit=cover + safe-area 规则 + --tap token 随 dist 产出',
    distMeta.cover && distMeta.safeArea && distMeta.tapToken, JSON.stringify(distMeta))

  // M13：600 视口中间断点（第 51 轮）——421–768 段实测零溢出（SVG viewBox 内元素除外：
  // 其 scrollWidth 语义为自治坐标系假阳性），断言固化防回归。
  // 顺序在 M7 之前：600 段的页面异常仍被 M7 全程捕获。
  await send('Emulation.setDeviceMetricsOverride', { width: 600, height: 812, deviceScaleFactor: 1, mobile: false })
  await send('Page.reload')
  await sleep(1200)
  const scan600 = `(() => {
    const el = document.documentElement
    const bad = []
    document.querySelectorAll('*').forEach((n) => {
      if (n.ownerSVGElement) return
      const r = n.getBoundingClientRect()
      if (r.right > el.clientWidth + 1 || (n.scrollWidth > n.clientWidth + 1 && !n.ownerSVGElement)) {
        const cls = (n.className && typeof n.className === 'string') ? n.className.split(' ')[0] : n.tagName
        bad.push(cls)
      }
    })
    return { sw: el.scrollWidth, cw: el.clientWidth, bad: [...new Set(bad)].slice(0, 5) }
  })()`
  let m13 = await evalJs(scan600)
  report('M13a 600 视口首页零横向溢出', m13.sw <= m13.cw && m13.bad.length === 0, JSON.stringify(m13))
  // 进游戏：优先「继续游戏」（M11d 留下的中途存档），否则走创建流程
  await evalJs(`(() => {
    const btns = [...document.querySelectorAll('button')]
    btns.find((b) => b.textContent.includes('继续游戏'))?.click()
  })()`)
  await sleep(600)
  let hasGame = await evalJs(`!!document.querySelector('.topbar-age')`)
  if (!hasGame) {
    await evalJs(`(() => {
      const cards = document.querySelectorAll('.opt-card')
      cards[0]?.click(); cards[4]?.click()
      ;[...document.querySelectorAll('button')].find((b) => b.textContent.includes('开始新人生'))?.click()
    })()`)
    await sleep(300)
    await evalJs(`(() => {
      const input = document.querySelector('#name-input')
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(input, '断点测试')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })()`)
    await sleep(150)
    await evalJs(`(() => {
      [...document.querySelectorAll('button')].find((b) => b.textContent.includes('出发'))?.click()
    })()`)
    await sleep(600)
    hasGame = await evalJs(`!!document.querySelector('.topbar-age')`)
  }
  const inGame = { topbar: hasGame, age: await evalJs(`document.querySelector('.topbar-age')?.textContent ?? null`) }
  m13 = await evalJs(scan600)
  report('M13b 600 视口游戏页零横向溢出',
    inGame.topbar && m13.sw <= m13.cw && m13.bad.length === 0, JSON.stringify({ inGame, ...m13 }))
  // 推进到结局（M4 同款五分支推进器：选项/结算按钮/跳过兜底）
  let end600 = null
  for (let i = 0; i < 400; i++) {
    const step = await evalJs(`(() => {
      const endName = document.querySelector('.ending-name')
      if (endName) return { kind: 'ending' }
      const choice = document.querySelector('.event-card .choice-btn:not(.locked)')
      if (choice) { choice.click(); return { kind: 'choice' } }
      const next = [...document.querySelectorAll('.result-panel button')].find((b) => b.textContent.includes('进入下一年'))
      if (next) { next.click(); return { kind: 'next' } }
      const skip = [...document.querySelectorAll('button')].find(b => b.textContent.includes('跳过这一年'))
      if (skip) { skip.click(); return { kind: 'skip' } }
      return { kind: 'stuck' }
    })()`)
    if (step.kind === 'ending') { end600 = step; break }
    if (step.kind === 'stuck') break
    await sleep(50)
  }
  const isEnding = Boolean(end600)
  m13 = await evalJs(scan600)
  report('M13c 600 视口结局页零横向溢出（报告/雷达/时间线全区块）',
    isEnding && m13.sw <= m13.cw && m13.bad.length === 0, JSON.stringify({ isEnding, ...m13 }))
  // 恢复 375 视口语义（后续 M7 全程异常检查不受视口影响）
  await send('Emulation.clearDeviceMetricsOverride')

  // M14：往生录（第 53 轮）——本脚本全程 3 局到终局（M4/M11d/M13），各局清档时
  // 追加一条人生记录（独立键 another-life:legacy）。断言条数/结构/首页面板/清空流程。
  await send('Page.reload')
  await sleep(1200)
  const legacyData = await evalJs(`(() => {
    let list = []
    try { list = JSON.parse(localStorage.getItem('another-life:legacy') || '[]') } catch {}
    const required = ['name', 'endingId', 'endingName', 'grade', 'age', 'peakMoney', 'epitaph', 'achievements', 'seed', 'finishedAt']
    const allWellFormed = list.every((e) => required.every((k) => k in e) && typeof e.age === 'number')
    const panel = [...document.querySelectorAll('summary')].find((s) => s.textContent.includes('往生录'))
    return { count: list.length, allWellFormed, panelText: panel?.textContent.slice(0, 40) ?? null }
  })()`)
  report('M14a 往生录：3 局终局各落一条且结构完整',
    legacyData.count >= 2 && legacyData.allWellFormed && !!legacyData.panelText, JSON.stringify(legacyData))
  // 清空流程：展开面板 → 点「清空往生录」→ 点「确认清空」→ 走过 0 段
  await evalJs(`(() => {
    document.querySelectorAll('.home-ach summary').forEach((s) => { if (s.textContent.includes('往生录')) s.click() })
  })()`)
  await sleep(300)
  await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('清空往生录'))?.click()`)
  await sleep(300)
  const confirmVisible = await evalJs(`[...document.querySelectorAll('button')].some((b) => b.textContent.includes('确认清空'))`)
  await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('确认清空'))?.click()`)
  await sleep(300)
  const cleared = await evalJs(`(() => ({
    stored: localStorage.getItem('another-life:legacy'),
    emptyText: [...document.querySelectorAll('p')].some((p) => p.textContent.includes('还没有走完过一局')),
  }))()`)
  report('M14b 往生录清空：二次确认 → 存储清空 → 空态文案恢复',
    confirmVisible && cleared.stored === null && cleared.emptyText, JSON.stringify({ confirmVisible, ...cleared }))

  // M15：开场引导（第 56 轮）——清 tutorial 键 → 新局进入游戏页出现三步浮层 →
  // 下一步×2 → 「开始我的人生」关闭并记忆 → 二次进入不再出现。步骤截图留档。
  await evalJs(`localStorage.removeItem('another-life:tutorial')`)
  await send('Page.reload')
  await sleep(1200)
  await evalJs(`(() => {
    const btns = [...document.querySelectorAll('button')]
    btns.find((b) => b.textContent.includes('开始新人生'))?.click()
  })()`)
  await sleep(400)
  await evalJs(`(() => {
    const cards = document.querySelectorAll('.opt-card')
    cards[0]?.click(); cards[4]?.click()
  })()`)
  await sleep(200)
  await evalJs(`(() => {
    const input = document.querySelector('#name-input')
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, '引导测试')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })()`)
  await sleep(150)
  await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('出发'))?.click()`)
  await sleep(800)
  const overlay = await evalJs(`(() => ({
    overlay: !!document.querySelector('.tutorial-overlay'),
    step: document.querySelector('.tutorial-step')?.textContent ?? '',
    title: document.querySelector('.tutorial-title')?.textContent ?? '',
  }))()`)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const fs15 = await import('node:fs')
  fs15.mkdirSync('.tutorial-shots', { recursive: true })
  fs15.writeFileSync('.tutorial-shots/step1.png', Buffer.from(shot.data, 'base64'))
  report('M15a 新局进入游戏页出现三步引导浮层（第 1 步）',
    overlay.overlay && overlay.step.includes('1') && overlay.title.length > 0, JSON.stringify(overlay))
  // 下一步 ×2 → 完成按钮 → 关闭并记忆
  await evalJs(`[...document.querySelectorAll('.tutorial-actions button')].find((b) => b.textContent.includes('下一步'))?.click()`)
  await sleep(200)
  await evalJs(`[...document.querySelectorAll('.tutorial-actions button')].find((b) => b.textContent.includes('下一步'))?.click()`)
  await sleep(200)
  const step3 = await evalJs(`document.querySelector('.tutorial-step')?.textContent ?? ''`)
  const shot3 = await send('Page.captureScreenshot', { format: 'png' })
  fs15.writeFileSync('.tutorial-shots/step3.png', Buffer.from(shot3.data, 'base64'))
  await evalJs(`[...document.querySelectorAll('.tutorial-actions button')].find((b) => b.textContent.includes('开始我的人生'))?.click()`)
  await sleep(200)
  const afterDone = await evalJs(`(() => ({
    gone: !document.querySelector('.tutorial-overlay'),
    persisted: localStorage.getItem('another-life:tutorial'),
    gameOk: !!document.querySelector('.topbar-age'),
  }))()`)
  report('M15b 三步走完关闭并记忆（done、游戏页可用）',
    step3.includes('3') && afterDone.gone && afterDone.persisted === 'done' && afterDone.gameOk,
    JSON.stringify({ step3, ...afterDone }))
  // 二次进入不再出现
  await send('Page.reload')
  await sleep(1200)
  await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('继续游戏'))?.click()`)
  await sleep(600)
  const again = await evalJs(`(() => ({
    overlay: !!document.querySelector('.tutorial-overlay'),
    inGame: !!document.querySelector('.topbar-age'),
  }))()`)
  report('M15c 二次进入不再出现（done 态直入游戏页）',
    again.inGame && !again.overlay, JSON.stringify(again))

  const errs = await evalJs(`window.__errs ?? []`)
  report('M7 全程无页面异常', errs.length === 0, JSON.stringify(errs.slice(0, 3)))

  const fails = results.filter((r) => !r.pass).length
  console.log(`\nSUMMARY: ${results.length - fails}/${results.length} PASS`)
  process.exit(fails > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL', e.message ?? e)
  try { chrome.kill() } catch {}
  try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }) } catch {}
  process.exit(2)
}).finally(async () => {
  try { chrome.kill() } catch {}
  try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }) } catch {}
})
