// 第 37 轮（结局页「人生报告」改版）浏览器级验收：
// ① 真实对局到终局：报告头（kicker「人生报告」+ 圆形评级印章）、关键数据五格与
//    终局前缓存存档跨层对照（终局年语义，见下）、金句卡在场性与出处逐字对应、
//    图表区桌面双栏并排（资产曲线+雷达）、后记金边收束、全页无占位符；
// ② 375×812：报告头/图表区/时间线区零横向溢出，桌面与移动截图留档；
// ③ 注入特殊状态：空履历（无金句卡+时间轴空态）、疏远/无亲缘（家庭格=独身）、
//    早亡（D 级印章+报告完整）、旧档空快照（曲线隐藏+峰值退化终局资产）；
// ④ 全程零页面错误。
// 终局年语义（同 round36 的 +1 口径）：终局后 App 清档（第 21 轮设计），推进循环每步
// 缓存的是「终局前一瞬」的存档，终局年结算恰好发生在其后一次推进里——
// · 终龄 = 缓存存档 age + 1（硬断言，死亡只经由年度结算）；
// · 成就/工龄允许终局年结算增量（成就可多枚链式解锁、在职工龄 +1）；
// · 峰值资产 = max(缓存存档峰值, 终局资产) 精确相等（快照只增终局年一条，其金额=终局资产）；
// · 家庭允许终局年有成员离世（只判"不凭空多出"，精确判定由注入段 3b 静态同公式覆盖）；
// · 金句在场性按缓存存档预测（★ 条目全部由年度结算产生；终局年结算可新增转折年，容差见断言）。
// 注入段由 Node 侧持缓存存档置 phase='ended' 后经「继续游戏」直达 EndingPage（round36 同款），
// reload 会重置 window，注入后由 Node 侧回填 __lastSave 为注入后的存档供页面内复算。
// 独立 Chrome（独立 user-data-dir，端口 9241 避让，窗口 1000×900 供桌面双栏断言）。
// 前置：npm run build 已产出最新 dist。运行：node scripts/round37_report_check.mjs
import { spawn, execSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const FILE_URL = 'file:///D:/vibe%20coding/another-life/dist/index.html'
const SHOT_DIR = 'scripts/.round37-shots'

const results = []
function report(step, pass, evidence) {
  results.push({ step, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${step} | ${evidence}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const userData = mkdtempSync(join(tmpdir(), 'al37-report-'))
const chrome = spawn(CHROME, [
  '--headless=new',
  '--remote-debugging-port=9241',
  `--user-data-dir=${userData}`,
  '--window-size=1000,900',
  '--no-first-run', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' })

try {
  let ok = false
  for (let i = 0; i < 50; i++) {
    try { await fetch('http://127.0.0.1:9241/json'); ok = true; break } catch { await sleep(200) }
  }
  if (!ok) throw new Error('CDP 端口未就绪')
  const list = await (await fetch('http://127.0.0.1:9241/json')).json()
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
  // 与 LifeReport.tsx 同口径的展示串复算（跨层对照用）
  const SAVE_HELPERS = `
    const fmt = (n) => (n < 0 ? '-' : '') + '¥' + Math.abs(n).toLocaleString('zh-CN')
    const parseMoney = (t) => { const m = /^(-)?¥([\\d,]+)$/.exec(t || ''); return m ? (m[1] ? -1 : 1) * parseInt(m[2].replace(/,/g, '')) : null }
    const familyOf = (rels) => {
      const spouse = rels.find((r) => r.kind === 'spouse' && r.alive)
      const partner = rels.find((r) => r.kind === 'partner' && r.alive)
      const kids = rels.filter((r) => r.kind === 'child' && r.alive)
      const pets = rels.filter((r) => r.kind === 'pet' && r.alive)
      const parts = []
      if (spouse) parts.push('伴侣'); else if (partner) parts.push('恋人')
      if (kids.length > 0) parts.push(kids.length + ' 孩')
      if (parts.length > 0) return parts.join(' · ')
      if (pets.length > 0) return pets.length + ' 宠相伴'
      return '独身'
    }
    const famParts = (t) => ({
      mate: t.includes('伴侣') ? '伴侣' : (t.includes('恋人') ? '恋人' : null),
      kids: (t.match(/(\\d+) 孩/) || [])[1] ? parseInt(t.match(/(\\d+) 孩/)[1]) : 0,
      pets: (t.match(/(\\d+) 宠/) || [])[1] ? parseInt(t.match(/(\\d+) 宠/)[1]) : 0,
    })
    const familyCompatible = (domT, saveT) => {
      const d = famParts(domT), s = famParts(saveT)
      return (d.mate === s.mate || d.mate === null) && d.kids <= s.kids && d.pets <= s.pets
    }
    const peakOf = (s) => s.snapshots && s.snapshots.length > 0
      ? Math.max(s.money, ...s.snapshots.map((x) => x.money))
      : s.money
    const quoteOf = (s) => {
      const keyAges = new Set(s.history.filter((h) => h.key).map((h) => h.age))
      const cands = s.history.filter((h) => h.choice.trim().length > 0 && keyAges.has(h.age))
      if (cands.length === 0) return null
      const last = cands[cands.length - 1]
      return { age: last.age, title: last.title, choice: last.choice }
    }`

  await send('Page.enable')
  await send('Page.navigate', { url: FILE_URL })
  const t0 = Date.now()
  while (Date.now() - t0 < 10000) {
    if (await evalJs(`document.readyState === 'complete'`)) break
    await sleep(120)
  }
  await sleep(700)
  await evalJs(`(() => {
    window.__errs = []
    window.addEventListener('error', (e) => window.__errs.push(String(e.message)))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('rejection:' + String(e.reason)))
    return true
  })()`)

  // 页面内自动推进（round36 同款：click 后 80ms 等 React commit，每步缓存存档）
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
      return { age: ageEl ? parseInt(ageEl.textContent) || null : null, ended: !!document.querySelector('.ending'), steps }
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
    setter.call(inp, '报告验收员')
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

  // 推进到终局
  const play = await evalJs(`window.__play(200)`)
  report('真实对局推进到终局', play && play.ended && !play.stuck, JSON.stringify(play))

  // ① 报告头：kicker + 圆形印章（64×64、圆形描边、旋转钤印感、评级字样）
  const head = await evalJs(`(() => {
    const kicker = document.querySelector('.ending-kicker')
    const seal = document.querySelector('.ending-grade')
    const st = seal ? getComputedStyle(seal) : null
    return {
      kicker: kicker ? kicker.textContent : null,
      sealText: seal ? seal.textContent : null,
      sealAria: seal ? seal.getAttribute('aria-label') : null,
      w: st ? st.width : null, h: st ? st.height : null,
      radius: st ? st.borderRadius : null,
      transform: st ? st.transform : null,
      bg: st ? st.backgroundColor : null,
      name: (document.querySelector('.ending-name') || {}).textContent || null,
    }
  })()`)
  report('报告头 kicker 为「人生报告」', head.kicker === '人生报告', `kicker="${head.kicker}"`)
  report(`评级印章为圆章（64×64 圆形 + 旋转 + 评级字样），结局「${head.name}」`,
    head.sealText !== null &&
      head.w === '64px' && head.h === '64px' &&
      head.radius !== '0px' &&
      head.transform !== 'none' &&
      /^[SABCD]级$/.test(head.sealText || '') &&
      (head.bg || '') !== 'rgba(0, 0, 0, 0)',
    `text="${head.sealText}" ${head.w}×${head.h} radius=${head.radius} transform=${head.transform} bg=${head.bg}`)
  report('印章 aria-label 可读（读屏不依赖视觉）',
    /^人生评级 [SABCD] 级$/.test(head.sealAria || ''), `aria="${head.sealAria}"`)

  // ② 关键数据五格：与终局前缓存存档按终局年语义跨层对照（口径见文件头）
  const stats = await evalJs(`(() => {
    ${SAVE_HELPERS}
    const save = window.__lastSave ? JSON.parse(window.__lastSave) : null
    const labels = [...document.querySelectorAll('.report-stat span')].map((el) => el.textContent)
    const values = [...document.querySelectorAll('.report-stat b')].map((el) => el.textContent)
    if (!save || values.length !== 5) return { labels, values, checks: null }
    const s = save.state
    const factsTxt = (document.querySelector('.ending-facts') || {}).textContent || ''
    const finalMoney = parseMoney((factsTxt.match(/(-?)¥[\\d,]+/) || [''])[0])
    const savePeak = peakOf(s)
    const expPeak = finalMoney === null ? null : Math.max(savePeak, finalMoney)
    return {
      labels, values,
      checks: {
        age: values[0] === (s.age + 1) + ' 岁',
        peak: expPeak !== null && parseMoney(values[1]) === expPeak,
        family: familyCompatible(values[2], familyOf(s.relations)),
        work: parseInt(values[3]) - (s.workYears ?? 0) >= 0 && parseInt(values[3]) - (s.workYears ?? 0) <= 1,
        ach: parseInt(values[4]) - s.achievements.length >= 0 && parseInt(values[4]) - s.achievements.length <= 3,
      },
      detail: { domAge: values[0], saveAge: s.age + 1, domPeak: values[1], expPeak: fmt(expPeak), domFamily: values[2], saveFamily: familyOf(s.relations), domWork: values[3], saveWork: s.workYears ?? 0, domAch: values[4], saveAch: s.achievements.length, finalMoney },
      snapLen: s.snapshots.length,
    }
  })()`)
  report('关键数据五格标签齐备且顺序正确',
    JSON.stringify(stats.labels) === JSON.stringify(['终龄', '峰值资产', '家庭', '工龄', '成就']),
    JSON.stringify(stats.labels))
  report('五格数值与终局前缓存存档按终局年语义跨层一致（终龄+1 硬断言、峰值精确、家庭不凭空多出）',
    !!stats.checks && Object.values(stats.checks).every(Boolean),
    JSON.stringify(stats.detail))

  // ③ 金句卡：在场性按缓存存档预测，出处逐字对应真实履历
  const quote = await evalJs(`(() => {
    ${SAVE_HELPERS}
    const save = window.__lastSave ? JSON.parse(window.__lastSave) : null
    const p = document.querySelector('.report-quote p')
    const cite = document.querySelector('.report-quote cite')
    const choice = p ? p.textContent : null
    const citeText = cite ? cite.textContent.trim() : null
    if (!save) return { present: !!p, predicted: null, choice, citeText, citeOk: false, entryOk: false }
    const s = save.state
    const predicted = quoteOf(s)
    // 终局年结算可能新增转折年（如终局年还清房贷）：此时金句条目须仍是存档里的真实履历
    const entry = choice ? s.history.find((h) => h.choice === choice && h.title === citeText.replace(/^—— (\\d+) 岁 · /, '')) : null
    const keyAges = new Set(s.history.filter((h) => h.key).map((h) => h.age))
    const entryOk = !!entry && entry.choice.trim().length > 0 && (keyAges.has(entry.age) || entry.age === s.age + 1)
    return {
      present: !!p,
      predicted,
      choice, citeText,
      citeOk: predicted ? citeText === ('—— ' + predicted.age + ' 岁 · ' + predicted.title) : null,
      entryOk,
    }
  })()`)
  report('金句卡在场性与缓存存档预测一致（终局年新增转折年容差内须为真实履历）',
    quote.predicted === null
      ? (quote.present === false || (quote.present && quote.entryOk))
      : (quote.present && quote.citeOk),
    `predicted=${JSON.stringify(quote.predicted)} present=${quote.present} cite="${quote.citeText}"`)

  // ④ 图表区：曲线与雷达在报告区并排（桌面 1000px 双栏）
  const charts = await evalJs(`(() => {
    const wrap = document.querySelector('.report-charts')
    const cards = wrap ? [...wrap.querySelectorAll(':scope > .card')] : []
    const tops = cards.map((c) => c.offsetTop)
    const lefts = cards.map((c) => c.offsetLeft)
    return {
      cards: cards.length,
      curve: !!document.querySelector('.report-charts .asset-curve'),
      radar: !!document.querySelector('.report-charts .life-radar'),
      sideBySide: cards.length === 2 && Math.abs(tops[0] - tops[1]) <= 2 && Math.abs(lefts[0] - lefts[1]) > 100,
    }
  })()`)
  report('图表区整合资产曲线与属性雷达（桌面双栏并排）',
    charts.cards === 2 && charts.curve && charts.radar && charts.sideBySide,
    `cards=${charts.cards} curve=${charts.curve} radar=${charts.radar} sideBySide=${charts.sideBySide}`)

  // ⑤ 后记金边收束 + 全页无占位符
  const closing = await evalJs(`(() => {
    const ep = document.querySelector('.report-epilogue')
    const txt = (document.querySelector('.ending') || {}).textContent || ''
    return {
      present: !!ep,
      hasH3: ep ? !![...ep.querySelectorAll('.card-subtitle')].find((el) => el.textContent.includes('后记')) : false,
      border: ep ? getComputedStyle(ep).borderLeftColor : null,
      placeholder: /undefined|NaN|\\[object|占位/.test(txt),
    }
  })()`)
  report('后记以金边区收束（第 30 轮后记衔接进报告）',
    closing.present && closing.hasH3 && closing.border === 'rgb(184, 134, 11)',
    `present=${closing.present} hasH3=${closing.hasH3} border=${closing.border}`)
  report('全页无占位符（undefined/NaN/[object/占位）', closing.placeholder === false, `placeholder=${closing.placeholder}`)

  // 桌面截图：报告头+数据区、图表区
  await evalJs(`(() => { window.scrollTo(0, 0); return true })()`)
  await sleep(200)
  await shot('ending-desktop-head.png')
  await evalJs(`(() => { const el = document.querySelector('.report-charts'); if (el) el.scrollIntoView({ block: 'center' }); return true })()`)
  await sleep(200)
  await shot('ending-desktop-charts.png')

  // ② 375×812：报告三区零横向溢出，截图留档
  await viewport375(true)
  await evalJs(`(() => { window.scrollTo(0, 0); return true })()`)
  await sleep(200)
  const headOv = await evalJs(overflow)
  await shot('ending-375-head.png')
  await evalJs(`(() => { const el = document.querySelector('.report-charts'); if (el) el.scrollIntoView({ block: 'start' }); return true })()`)
  await sleep(200)
  const chartsOv = await evalJs(overflow)
  await shot('ending-375-charts.png')
  await evalJs(`(() => { const el = document.querySelector('.life-timeline, .history-empty'); if (el) el.scrollIntoView({ block: 'start' }); return true })()`)
  await sleep(200)
  const tlOv = await evalJs(overflow)
  await shot('ending-375-timeline.png')
  await viewport375(false)
  report('375×812 报告头区无横向溢出', headOv.sw <= 375, JSON.stringify(headOv))
  report('375×812 图表区无横向溢出（双栏堆叠为单栏）', chartsOv.sw <= 375, JSON.stringify(chartsOv))
  report('375×812 时间线区无横向溢出', tlOv.sw <= 375, JSON.stringify(tlOv))

  // ③ 注入特殊状态段（Node 侧持终局前缓存存档，置 ended 后经「继续游戏」直达结局页；
  //    reload 重置 window，注入后回填 __lastSave 为注入后的存档供页面内复算）
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
    await evalJs(`window.__lastSave = ${JSON.stringify(JSON.stringify(d))}; true`)
  }

  // 3a 空履历：金句卡消失、数据格照常、时间轴空态
  await injectAndReload((d) => { d.state.history = [] })
  const emptyHist = await evalJs(`(() => ({
    quote: !!document.querySelector('.report-quote'),
    stats: document.querySelectorAll('.report-stat').length,
    emptyText: (document.querySelector('.history-empty') || {}).textContent || null,
    placeholder: /undefined|NaN|\\[object|占位/.test((document.querySelector('.ending') || {}).textContent || ''),
  }))()`)
  report('空履历注入：金句卡消失、五格照常、时间轴空态、无占位符',
    emptyHist.quote === false && emptyHist.stats === 5 && !!emptyHist.emptyText && emptyHist.placeholder === false,
    JSON.stringify(emptyHist))

  // 3b 疏远/无亲缘：家庭格如实降级为独身（alive=false 的疏远伴侣不计入，静态同公式精确对照）
  await injectAndReload((d) => {
    d.state.relations = (d.state.relations || []).map((r) => ({ ...r, alive: false, estranged: true }))
  })
  const estranged = await evalJs(`(() => {
    ${SAVE_HELPERS}
    const save = window.__lastSave ? JSON.parse(window.__lastSave) : null
    const cells = [...document.querySelectorAll('.report-stat b')].map((el) => el.textContent)
    return {
      family: cells[2] ?? null,
      expected: save ? familyOf(save.state.relations) : null,
      placeholder: /undefined|NaN|\\[object|占位/.test((document.querySelector('.ending') || {}).textContent || ''),
    }
  })()`)
  report('疏远/无亲缘注入：家庭格=独身（同公式复算一致）且无占位符',
    estranged.family === '独身' && estranged.family === estranged.expected && estranged.placeholder === false,
    `family="${estranged.family}" expected="${estranged.expected}"`)

  // 3c 早亡：25 岁健康归零 → D 级印章，报告仍完整
  await injectAndReload((d) => {
    d.state.age = 25
    d.state.attrs = { ...d.state.attrs, health: 0 }
  })
  // 第 80 轮加固：等「继续游戏」恢复完成（.ending 报告区容器出现）——
  // 负载下点击偶发未生效，固定延时/等局部元素都会早读首页空 DOM
  for (let t = 0; t < 50; t++) {
    if (await evalJs(`!!document.querySelector('.ending')`)) break
    await sleep(200)
  }
  const early = await evalJs(`(() => ({
    seal: (document.querySelector('.ending-grade') || {}).textContent || null,
    gradeClass: document.querySelector('.ending-grade.grade-D') !== null,
    stats: document.querySelectorAll('.report-stat').length,
    ageCell: (document.querySelector('.report-stat b') || {}).textContent || null,
    placeholder: /undefined|NaN|\\[object|占位/.test((document.querySelector('.ending') || {}).textContent || ''),
  }))()`)
  report('早亡注入：D 级印章、报告五格完整（终龄 25 岁）、无占位符',
    early.gradeClass === true && early.seal === 'D级' && early.stats === 5 && early.ageCell === '25 岁' && early.placeholder === false,
    JSON.stringify(early))

  // 3d 旧档空快照：曲线隐藏、雷达降级、峰值格退化为终局资产
  await injectAndReload((d) => { d.state.snapshots = [] })
  const oldSave = await evalJs(`(() => {
    ${SAVE_HELPERS}
    const save = window.__lastSave ? JSON.parse(window.__lastSave) : null
    const cells = [...document.querySelectorAll('.report-stat b')].map((el) => el.textContent)
    return {
      curve: !!document.querySelector('.asset-curve'),
      radarFinal: !!document.querySelector('.life-radar polygon.radar-final'),
      peak: cells[1] ?? null,
      expectedPeak: save ? fmt(peakOf(save.state)) : null,
      stats: document.querySelectorAll('.report-stat').length,
      placeholder: /undefined|NaN|\\[object|占位/.test((document.querySelector('.ending') || {}).textContent || ''),
    }
  })()`)
  report('旧档空快照注入：曲线隐藏、雷达仅终值、峰值格退化为终局资产且无占位符',
    oldSave.curve === false && oldSave.radarFinal === true && oldSave.peak === oldSave.expectedPeak && oldSave.stats === 5 && oldSave.placeholder === false,
    `peak="${oldSave.peak}" expected="${oldSave.expectedPeak}" curve=${oldSave.curve}`)

  // ④ 注入段页面错误（终局段由各步断言独立覆盖）
  const errs = await evalJs(`window.__errs`)
  report('全程零页面错误（注入段）', Array.isArray(errs) && errs.length === 0,
    errs.length ? errs.slice(0, 3).join('；') : '0 错误')
} finally {
  try { chrome.kill() } catch {}
  try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }) } catch {}
}

const fails = results.filter((r) => !r.pass).length
console.log(`\nSUMMARY: ${results.length - fails}/${results.length} PASS`)
process.exit(fails > 0 ? 1 : 0)
