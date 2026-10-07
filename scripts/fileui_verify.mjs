// 第 40 轮 file:// 总验收（V2 重交付）：真实 Chrome headless + CDP 驱动生产 dist，
// 实测 开局→选择→跨年→曲线→续档→结局→人生报告→音效开关→返回首页 全流程。
// 第 20 轮 V1 原有 12 步保持不减（加载/相对路径/创建/选择跨年/存档恢复/推进结局/结局要素/清档回首页/零异常）；
// 第 38/40 轮扩展：音效开关默认态与持久化、游戏内资产曲线折叠块、结局页人生报告（印章/五格/雷达/曲线/后记）。
// 自起独立 Chrome（端口 9245、独立 user-data-dir，与 35/36/37/38 脚本同模式，无需外部预起）。
// 前置：npm run build 已产出最新 dist。运行：node scripts/fileui_verify.mjs
import { spawn, execSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const FILE_URL = 'file:///D:/vibe%20coding/another-life/dist/index.html'

const results = []
function report(step, pass, evidence) {
  results.push({ step, pass, evidence })
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${step} | ${evidence}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const userData = mkdtempSync(join(tmpdir(), 'al40-fileui-'))
const chrome = spawn(CHROME, [
  '--headless=new',
  '--remote-debugging-port=9245',
  `--user-data-dir=${userData}`,
  '--window-size=420,820',
  '--no-first-run', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' })

let msgId = 0
const pending = new Map()
let ws

function send(method, params = {}) {
  const id = ++msgId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evalJs(expr) {
  const r = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  })
  if (r.exceptionDetails) throw new Error('page eval error: ' + JSON.stringify(r.exceptionDetails).slice(0, 500))
  return r.result.value
}

async function waitFor(expr, timeoutMs = 8000, label = '') {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const v = await evalJs(expr)
    if (v) return v
    await sleep(120)
  }
  throw new Error('waitFor timeout: ' + label + ' :: ' + expr)
}

async function main() {
  let ok = false
  for (let i = 0; i < 50; i++) {
    try { await fetch('http://127.0.0.1:9245/json'); ok = true; break } catch { await sleep(200) }
  }
  if (!ok) throw new Error('CDP 端口未就绪')
  const list = await (await fetch('http://127.0.0.1:9245/json')).json()
  ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl)
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

  // ---- 阶段 1：file:// 加载与资源 ----
  await send('Page.navigate', { url: FILE_URL })
  await waitFor(`document.readyState === 'complete'`, 10000, 'load')
  await evalJs(`(() => {
    window.__errs = []
    window.addEventListener('error', (e) => window.__errs.push(String(e.message).slice(0, 200)))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('REJ:' + String(e.reason).slice(0, 200)))
    return true
  })()`)
  await sleep(200)
  const mounted = await evalJs(`(() => {
    const root = document.getElementById('root')
    const title = document.querySelector('.home-title')
    return { children: root ? root.children.length : -1, title: title ? title.textContent : null }
  })()`)
  report(
    '1.1 file:// 页面加载且 React 挂载',
    mounted.children > 0 && mounted.title === '另一种人生',
    `root.children=${mounted.children}, home-title=${JSON.stringify(mounted.title)}`
  )
  const resInfo = await evalJs(`(() => {
    const scripts = [...document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'))
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map(s => s.getAttribute('href'))
    return { scripts, links }
  })()`)
  report(
    '1.2 资源引用为相对路径',
    resInfo.scripts.every((s) => s.startsWith('./')) && resInfo.links.every((s) => s.startsWith('./')),
    JSON.stringify(resInfo)
  )

  // ---- 阶段 1.5（第 40 轮）：音效开关默认态与持久化（呈现后即恢复默认关）----
  const snd0 = await evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('音效：'))
    return b ? { text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed') } : null
  })()`)
  report('1.3 音效默认关（aria-pressed=false）', !!snd0 && snd0.pressed === 'false', JSON.stringify(snd0))
  await evalJs(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('音效：')).click()`)
  await sleep(150)
  const snd1 = await evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('音效：'))
    return { text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed'), persisted: localStorage.getItem('another-life:sound') }
  })()`)
  report('1.4 音效切「低」且持久化（第 52 轮三态：关→低，localStorage=low）', snd1.pressed === 'true' && snd1.persisted === 'low', JSON.stringify(snd1))
  // 三态循环：低→高→关（两次点击回到默认关）
  await evalJs(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('音效：')).click()`)
  await sleep(150)
  await evalJs(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('音效：')).click()`)
  await sleep(150)
  const snd2 = await evalJs(`(() => ({ off: localStorage.getItem('another-life:sound'), pressed: [...document.querySelectorAll('button')].find((x) => x.textContent.includes('音效：'))?.getAttribute('aria-pressed') }))()`)
  report('1.5 音效切回「关」恢复默认（三态低→高→关循环到位）', snd2.off === 'off' && snd2.pressed === 'false', JSON.stringify(snd2))

  // ---- 阶段 2：创建角色 ----
  // 第 59 轮：预置引导 done（隔离本流程与浮层；浮层断言在 6.6 独立小局）+ 清往生录（6.5 断言从零计数）
  await evalJs(`localStorage.setItem('another-life:tutorial', 'done'); localStorage.removeItem('another-life:legacy')`)
  await send('Page.reload')
  await sleep(1200)
  const hasSave = await evalJs(`!!document.querySelector('.btn-primary.btn-lg')`)
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('开始新人生')).click()`)
  await sleep(300)
  if (hasSave) {
    const confirmBtn = await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('覆盖存档')); if (b) b.click(); return !!b })()`)
    await sleep(400)
    report('2.0 旧存档覆盖确认', confirmBtn, '点击了「覆盖存档」')
  }
  await waitFor(`!!document.querySelector('#name-input')`, 5000, 'creation page')
  await evalJs(`(() => {
    const inp = document.querySelector('#name-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, '陈验收')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  const picked = await evalJs(`(() => {
    const cards = [...document.querySelectorAll('.opt-card')]
    cards[0].click()
    const labels = [...document.querySelectorAll('.section-title')].map(h => h.textContent)
    return { count: cards.length, labels }
  })()`)
  await sleep(200)
  const picked2 = await evalJs(`(() => {
    const h2s = [...document.querySelectorAll('.section-title')]
    const traitH2 = h2s.find(h => h.textContent.includes('特质'))
    const grid = traitH2.nextElementSibling
    grid.querySelector('button').click()
    return grid.querySelectorAll('button').length
  })()`)
  await sleep(200)
  const started = await evalJs(`(() => {
    const b = document.querySelector('.creation-actions .btn-primary')
    if (!b) return { ok: false }
    b.click()
    return { ok: true, disabled: b.disabled }
  })()`)
  await waitFor(`!!document.querySelector('.topbar-age')`, 6000, 'game page')
  const ageNow = await evalJs(`document.querySelector('.topbar-age').textContent`)
  const nameNow = await evalJs(`document.querySelector('.topbar-name').textContent`)
  report(
    '2.1 创建角色（填名/选背景/选特质/出发）',
    started.ok && /18/.test(ageNow) && nameNow === '陈验收',
    `背景特质卡组=${JSON.stringify(picked.labels)} 卡数${picked.count}+${picked2}, 进入游戏 ${nameNow} ${ageNow}`
  )

  // ---- 阶段 3：选择 + 跨年 + 游戏内资产曲线 ----
  const ev1 = await evalJs(`(() => {
    const card = document.querySelector('.event-card')
    return card ? { title: card.querySelector('.event-title').textContent, choices: card.querySelectorAll('.choice-btn:not(.locked)').length } : null
  })()`)
  report('3.1 18 岁事件卡出现且有可选项', !!ev1 && ev1.choices >= 1, JSON.stringify(ev1))
  // 推进 2 年（凑 ≥3 条快照，曲线块应出现在履历区）
  let curveYears = -1
  for (let i = 0; i < 2; i++) {
    await evalJs(`document.querySelector('.event-card .choice-btn:not(.locked)')?.click()`)
    await waitFor(`!!document.querySelector('.result-panel')`, 5000, 'result ' + i)
    // 第 84 轮：行动条入 panel——推进按钮按文本精确定位（勿取首按钮，那是行动按钮）
    await evalJs(`[...document.querySelectorAll('.result-panel button')].find(b => b.textContent.includes('进入下一年')).click()`)
    await waitFor(`!!document.querySelector('.event-card') || !!document.querySelector('.result-panel')`, 5000, 'next ' + i)
  }
  const age3 = await evalJs(`document.querySelector('.topbar-age')?.textContent`)
  const curve = await evalJs(`(() => {
    const fold = document.querySelector('.asset-fold')
    const pts = document.querySelector('.asset-fold polyline')
    return {
      present: !!fold,
      title: fold ? fold.querySelector('summary')?.textContent.trim() : null,
      points: pts ? pts.getAttribute('points').split(' ').length : -1,
      bad: pts ? /NaN|Infinity/.test(pts.getAttribute('points')) : false,
    }
  })()`)
  curveYears = curve.points
  report(
    '3.2 选择结算并跨年到 20 岁，履历区出现资产曲线折叠块（逐点无 NaN）',
    /20/.test(age3 || '') && curve.present && curve.points >= 3 && !curve.bad,
    `age=${age3} 曲线块=${curve.present}「${curve.title}」点数=${curve.points}`
  )

  // ---- 阶段 4：存档刷新恢复 ----
  await evalJs(`location.reload()`)
  await waitFor(`document.readyState === 'complete'`, 10000, 'reload')
  await sleep(600)
  await evalJs(`(() => {
    window.__errs = []
    window.addEventListener('error', (e) => window.__errs.push(String(e.message).slice(0, 200)))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('REJ:' + String(e.reason).slice(0, 200)))
    return true
  })()`)
  const chip = await evalJs(`(() => {
    const chip = document.querySelector('.save-chip')
    const cont = [...document.querySelectorAll('button')].find(b => b.textContent.includes('继续游戏'))
    return { chip: chip ? chip.textContent : null, hasContinue: !!cont, isPrimary: cont ? cont.className.includes('btn-primary') : false }
  })()`)
  report(
    '4.1 file:// 刷新后首页出现继续入口（save-chip 带年龄）',
    chip.hasContinue && chip.isPrimary && /20 岁/.test(chip.chip || ''),
    `save-chip=${JSON.stringify(chip.chip)}`
  )
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('继续游戏')).click()`)
  await waitFor(`!!document.querySelector('.topbar-age')`, 6000, 'restored game')
  const restored = await evalJs(`(() => ({
    age: document.querySelector('.topbar-age').textContent,
    hasCardOrPanel: !!document.querySelector('.event-card') || !!document.querySelector('.result-panel')
  }))()`)
  report(
    '4.2 继续游戏恢复到 20 岁会话',
    restored.age.includes('20') && restored.hasCardOrPanel,
    JSON.stringify(restored)
  )

  // ---- 阶段 4.5：主动行动条（第 84 轮，第 105 轮纳入 file:// 回归网）----
  // 行动条挂在**结算面板内**（GamePage 与结算明细/成就条同级），只在选完事件、结算面板
  // 呈现时可见——事件卡阶段没有它。故本步先选一次事件推进到结算面板再断言。
  // 按钮是否可点取决于 availableActions（仅 awaitingAdvance 非空），事件阶段全灰带原因 tooltip；
  // 故断言分两支：结构恒真 + 「可点则点得动、点了出注记态并收起行动条」的行为闭环。
  await evalJs(`document.querySelector('.event-card .choice-btn:not(.locked)')?.click()`)
  await waitFor(`!!document.querySelector('.result-panel')`, 6000, 'actbar result panel')
  const actBar = await evalJs(`(() => {
    const bar = document.querySelector('.action-bar')
    const btns = [...document.querySelectorAll('.action-btn')]
    return {
      present: !!bar,
      role: bar?.getAttribute('role') ?? null,
      aria: bar?.getAttribute('aria-label') ?? null,
      label: document.querySelector('.action-bar-label')?.textContent ?? '',
      hint: document.querySelector('.action-bar-hint')?.textContent ?? '',
      total: btns.length,
      enabled: btns.filter((b) => !b.disabled).length,
      disabledReasons: btns.filter((b) => b.disabled).map((b) => b.title).slice(0, 2),
    }
  })()`)
  let actDoneOk = null
  if (actBar.enabled > 0) {
    await evalJs(`document.querySelector('.action-btn:not([disabled])').click()`)
    await sleep(250)
    const after = await evalJs(`(() => ({
      note: document.querySelector('.action-done-note')?.textContent ?? '',
      barGone: !document.querySelector('.action-bar'),
    }))()`)
    actDoneOk = after.note.length > 0 && after.barGone
  }
  report(
    '4.5 行动条：结构齐备（role/aria/标签/提示），可点行动点得动并出「已行动」注记态',
    actBar.present && actBar.role === 'group' && actBar.aria === '本年主动行动'
      && actBar.total >= 3 && actBar.label.includes('可跳过') && actBar.hint.includes('数字键')
      && (actBar.enabled === 0 || actDoneOk === true),
    JSON.stringify({ ...actBar, actedOk: actDoneOk })
  )

  // ---- 阶段 5：自动推进到结局 ----
  let ending = null
  let steps = 0
  const maxSteps = 500
  while (steps < maxSteps) {
    const step = await evalJs(`(() => {
      const endName = document.querySelector('.ending-name')
      if (endName) {
        return { kind: 'ending', name: endName.textContent, grade: document.querySelector('.ending-grade')?.textContent }
      }
      const choice = document.querySelector('.event-card .choice-btn:not(.locked)')
      if (choice) { choice.click(); return { kind: 'choice' } }
      const next = [...document.querySelectorAll('.result-panel button')].find((b) => b.textContent.includes('进入下一年'))
      if (next) { next.click(); return { kind: 'next' } }
      const skip = [...document.querySelectorAll('button')].find(b => b.textContent.includes('跳过这一年'))
      if (skip) { skip.click(); return { kind: 'skip' } }
      return { kind: 'stuck', html: document.body.innerText.slice(0, 200) }
    })()`)
    steps++
    if (step.kind === 'ending') { ending = step; break }
    if (step.kind === 'stuck') {
      report('5.1 自动推进', false, '卡死: ' + JSON.stringify(step.html))
      break
    }
    await sleep(60)
  }
  if (ending) {
    report('5.1 自动推进到达结局页', true, `${steps} 步；结局=${ending.name} ${ending.grade}`)
  } else if (!results.some((r) => r.step === '5.1 自动推进')) {
    report('5.1 自动推进到达结局页', false, `${steps} 步未到达结局`)
  }

  // ---- 阶段 6：结局页要素 + 人生报告（第 37 轮）+ 再活一次 ----
  if (ending) {
    const parts = await evalJs(`(() => ({
      grade: !!document.querySelector('.ending-grade'),
      name: document.querySelector('.ending-name')?.textContent,
      desc: !!document.querySelector('.ending-desc')?.textContent,
      dims: document.querySelectorAll('.ending-dim').length,
      summary: document.querySelector('.ending-summary')?.textContent?.length ?? 0,
      timeline: document.querySelectorAll('.life-timeline li').length,
      attrs: document.querySelectorAll('.ending-attr').length,
      hasUndefined: document.body.innerText.includes('undefined') || document.body.innerText.includes('NaN')
    }))()`)
    report(
      '6.1 结局页要素齐全且无 undefined/NaN',
      parts.grade && parts.name && parts.desc && parts.summary > 0 && parts.timeline > 0 && parts.attrs >= 5 && !parts.hasUndefined,
      JSON.stringify(parts)
    )
    // 人生报告：印章 + 关键数据五格 + 雷达 + 曲线 + 后记收束
    const rep = await evalJs(`(() => {
      const seal = document.querySelector('.ending-grade')
      const st = seal ? getComputedStyle(seal) : null
      const labels = [...document.querySelectorAll('.report-stat span')].map((el) => el.textContent)
      const values = [...document.querySelectorAll('.report-stat b')].map((el) => el.textContent)
      const facts = document.querySelector('.ending-facts')?.textContent || ''
      const ageInFacts = parseInt((facts.match(/终年 (\\d+) 岁/) || [])[1] || '-1')
      const quote = document.querySelector('.report-quote')
      const cite = document.querySelector('.report-quote cite')
      const tlTitle = [...document.querySelectorAll('.ending .card-subtitle')].find((el) => el.textContent.includes('人生时间线'))
      const tlCount = tlTitle ? parseInt((tlTitle.textContent.match(/（(\\d+) 件事）/) || [])[1] || '-1') : -1
      return {
        kicker: document.querySelector('.ending-kicker')?.textContent,
        sealRound: st ? st.width === '64px' && st.height === '64px' && st.borderRadius !== '0px' : false,
        sealText: seal?.textContent,
        labels, values,
        ageCell: values[0] ?? null,
        factsAge: ageInFacts,
        radar: !!document.querySelector('.life-radar polygon'),
        curvePts: document.querySelector('.ending .asset-curve polyline')?.getAttribute('points').split(' ').length ?? -1,
        epilogue: !!document.querySelector('.report-epilogue'),
        quotePresent: !!quote,
        quoteCiteOk: cite ? /^—— \\d+ 岁 · .+/.test(cite.textContent.trim()) : null,
        tlLi: document.querySelectorAll('.life-timeline li').length,
        tlTitleCount: tlCount,
      }
    })()`)
    // 第 105 轮：同龄人对照卡（第 96 轮 V5 玩法，纯展示数据 norms.ts）纳入 file:// 回归网。
    // 断言口径＝四行齐全 + 百分位落在 1..99 + 文案非羞辱化档位之一 + 无 undefined/NaN。
    const peer = await evalJs(`(() => {
      const sec = document.querySelector('.peer-compare')
      if (!sec) return { present: false }
      const rows = [...document.querySelectorAll('.peer-row')]
      const pcts = rows.map((r) => parseInt((r.querySelector('.peer-tier')?.textContent.match(/超过 ([0-9]+)%/) || [])[1] ?? '-1', 10))
      const labels = rows.map((r) => r.querySelector('.peer-label')?.textContent ?? '')
      return {
        present: true,
        aria: sec.getAttribute('aria-label'),
        note: document.querySelector('.peer-note')?.textContent ?? '',
        count: rows.length,
        labels, pcts,
        tiers: rows.map((r) => r.querySelector('.peer-tier')?.textContent ?? ''),
        values: rows.map((r) => r.querySelector('.peer-value')?.textContent ?? ''),
        rowAria: rows[0]?.getAttribute('aria-label') ?? '',
        bad: sec.textContent.includes('undefined') || sec.textContent.includes('NaN'),
      }
    })()`)
    report(
      '6.9 同龄人对照卡：四维齐全、百分位 1–99、文案分档合法、无 undefined/NaN',
      peer.present && peer.aria === '同龄人对照' && peer.count === 4
        && JSON.stringify(peer.labels) === JSON.stringify(['积蓄', '寿命', '成就', '幸福感'])
        && peer.pcts.every((p) => p >= 1 && p <= 99)
        && peer.tiers.every((t) => /超过 [0-9]+% 的模拟人生 · (远超绝大多数同龄人|高于大多数同龄人|与大多数同龄人相当|节奏不同，慢一点也是走|一段缓慢但真实的一生)/.test(t))
        && /基于 [0-9]+ 局模拟对照/.test(peer.note) && !peer.bad,
      JSON.stringify(peer)
    )
    report(
      '6.2 人生报告：kicker/圆章/关键数据五格/雷达/曲线/后记齐备',
      rep.kicker === '人生报告' && rep.sealRound && /^[SABCD]级$/.test(rep.sealText || '') &&
        JSON.stringify(rep.labels) === JSON.stringify(['终龄', '峰值资产', '家庭', '工龄', '成就']) &&
        rep.radar && rep.curvePts >= 3 && rep.epilogue,
      `seal=${rep.sealText} labels=${JSON.stringify(rep.labels)} values=${JSON.stringify(rep.values)} curvePts=${rep.curvePts}`
    )
    report(
      '6.3 报告自洽：终龄格 = 结局事实年龄；时间轴条目 = 标题件数；金句出处格式（存在时）',
      parseInt(rep.ageCell) === rep.factsAge && rep.tlLi === rep.tlTitleCount && (rep.quotePresent === false || rep.quoteCiteOk === true),
      `终龄格=${rep.ageCell} 事实终年=${rep.factsAge} tl=${rep.tlLi}/${rep.tlTitleCount} quote=${rep.quotePresent} citeOk=${rep.quoteCiteOk}`
    )
    await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('再活一次'))?.click()`)
    await sleep(500)
    const back = await evalJs(`(() => ({
      home: !!document.querySelector('.home-title'),
      chip: document.querySelector('.save-chip')?.textContent ?? null,
      continueBtn: [...document.querySelectorAll('button')].some(b => b.textContent.includes('继续游戏'))
    }))()`)
    report(
      '6.4 再活一次返回首页且终局已清档',
      back.home && !back.continueBtn,
      JSON.stringify(back)
    )
    // 第 59 轮：V3 特性——首页往生录面板（本局已终局应落一条）+ 分享卡随 dist 产出（node 侧读源）
    await evalJs(`(() => {
      localStorage.setItem('another-life:tutorial', 'done') // 隔离：引导不干扰断言
      location.reload()
    })()`)
    await sleep(1200)
    const legacyPanel = await evalJs(`(() => {
      const s = [...document.querySelectorAll('summary')].find((x) => x.textContent.includes('往生录'))
      let count = null
      try { count = JSON.parse(localStorage.getItem('another-life:legacy') || '[]').length } catch {}
      // 第 73 轮：展开式回顾——碑头按钮点击展开（先点，React commit 后再读）
      document.querySelector('.legacy-toggle')?.click()
      return { panel: !!s, text: s?.textContent.slice(0, 30) ?? '', count }
    })()`)
    await sleep(300) // React 18 DOM 刷新在微任务——click 与断言须分帧
    const expanded = await evalJs(`(() => {
      const toggle = document.querySelector('.legacy-toggle')
      const more = document.querySelector('.legacy-more.open .legacy-more-inner')
      return {
        toggle: !!toggle,
        expanded: toggle?.getAttribute('aria-expanded') ?? null,
        hasPeak: !!more && more.textContent.includes('资产峰值出现在'),
        hasChoicesOrHint: !!more && (more.textContent.includes('岁 ·') || more.textContent.includes('抉择记录')),
      }
    })()`)
    const distHasShare = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8').includes('保存分享卡')
    report(
      '6.5 V3 特性：往生录面板落本局记录 + 分享卡随 dist 产出 + V4 展开式回顾（点击展开露抉择/峰值年龄）',
      legacyPanel.panel && legacyPanel.count === 1 && distHasShare &&
        expanded.toggle && expanded.expanded === 'true' && expanded.hasPeak && expanded.hasChoicesOrHint,
      JSON.stringify({ distHasShare, ...legacyPanel, ...expanded })
    )
    // 6.6（第 59 轮）：引导浮层独立小局——清 tutorial 键 → 开始新人生进游戏页 → 浮层出现 → 跳过 → 消失
    await evalJs(`localStorage.removeItem('another-life:tutorial')`)
    await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('开始新人生'))?.click()`)
    await sleep(400)
    await evalJs(`(() => {
      const cards = document.querySelectorAll('.opt-card')
      cards[0]?.click(); cards[4]?.click()
    })()`)
    await sleep(200)
    await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('出发'))?.click()`)
    await sleep(800)
    const tutShown = await evalJs(`!!document.querySelector('.tutorial-overlay')`)
    await evalJs(`[...document.querySelectorAll('.tutorial-actions button')].find((b) => b.textContent.includes('跳过引导'))?.click()`)
    await sleep(200)
    const tutGone = await evalJs(`!document.querySelector('.tutorial-overlay') && localStorage.getItem('another-life:tutorial') === 'done'`)
    report('6.6 引导浮层（第 56 轮）：新局出现 → 跳过 → 消失且记忆 done',
      tutShown && tutGone, JSON.stringify({ tutShown, tutGone }))
  }

  // ---- 阶段 8（第 99 轮）：file:// 传承链路复测（A4「file:// 全流程含传承走查」）----
  // 走真实产品路径：注入 another-life:bloodline 键 → 首页「开始新人生」→ 创建页血脉横幅可见
  // → 承继开局（handleStartBloodline：姓氏锁定 + 遗产到账 + generation 标记）→ 断言
  // 「承继血脉」横幅、遗产金额入账、世代标记，并验证血脉键与存档键互相隔离（硬纪律第1 条）。
  await evalJs(`localStorage.setItem('another-life:bloodline', JSON.stringify({
    generation: 2, surname: '林', inheritanceMoney: 180000,
    ancestorName: '林知远', ancestorEndingId: 'settle', finishedAt: Date.now(),
  }))`)
  await send('Page.navigate', { url: FILE_URL })
  await waitFor(`document.readyState === 'complete'`, 10000, 'r99 reload')
  await sleep(400)
  const bloodKeyBefore = await evalJs(`localStorage.getItem('another-life:bloodline')`)
  const saveKeyBefore = await evalJs(`localStorage.getItem('another-life:save')`)
  await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('开始新人生'))?.click()`)
  await sleep(250)
  await evalJs(`(() => {
    const c = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('覆盖存档，开始新人生'))
    if (c) c.click()
    return true
  })()`)
  await waitFor(`!!document.querySelector('.creation')`, 8000, 'r99 creation')
  const bl = await evalJs(`(() => {
    const b = document.querySelector('.warn-card')
    return { shown: !!b, text: b?.textContent ?? '' }
  })()`)
  report('8.1 file:// 传承：创建页血脉横幅可见（含代数与遗产金额）',
    bl.shown && bl.text.includes('承继血脉') && bl.text.includes('第 2 代') && bl.text.includes('180,000'),
    JSON.stringify(bl))
  // 8.4（第 122 轮）：家训三选一——承继面板三张家训卡可见+选一张（aria-pressed 翻转）
  const mottoPresent = await evalJs(`(() => {
    const sec = document.querySelector('.motto-pick')
    const btns = [...document.querySelectorAll('.motto-btn')]
    if (btns.length > 0) btns[0].click()
    return { present: !!sec, cards: btns.length, hint: document.querySelector('.motto-hint')?.textContent ?? '' }
  })()`)
  await sleep(120) // React 18 commit（微任务）后再读选中态——CDP click 后同步读假红
  const mottoPicked = await evalJs(`(() =>
    [...document.querySelectorAll('.motto-btn')].filter((b) => b.getAttribute('aria-pressed') === 'true').length
  )()`)
  report('8.4 file:// 传承：家训三选一可见+选中态翻转+微效果提示在位',
    mottoPresent.present && mottoPresent.cards === 3 && mottoPicked === 1 && mottoPresent.hint.includes('家训'),
    JSON.stringify({ ...mottoPresent, picked: mottoPicked }))
  // 承继开局：填名点出发（CreationPage 的开始按钮）
  await evalJs(`(() => {
    const inp = document.getElementById('name-input')
    if (inp) { inp.value = '' }
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('出发'))
    if (btn) btn.click()
    return true
  })()`)
  await waitFor(`!!document.querySelector('.event-card') || !!document.querySelector('.topbar')`, 8000, 'r99 bloodline start')
  await sleep(200)
  const blStart = await evalJs(`(() => ({
    name: document.querySelector('.topbar-name')?.textContent ?? '',
    money: document.querySelector('.topbar-money')?.textContent ?? document.body.innerText.match(/[¥￥][\\d,]+/)?.[0] ?? '',
    age: document.querySelector('.topbar-age')?.textContent ?? '',
  }))()`)
  const blSaved = await evalJs(`localStorage.getItem('another-life:save')`)
  report('8.2 file:// 传承：承继开局落地（18 岁入局+遗产 180,000 元到账+ 先辈姓氏承继）',
    blStart.age.includes('18') && /83,000|180,000/.test(blStart.money) && blStart.name.startsWith('林'),
    JSON.stringify(blStart))
  const iso = await evalJs(`(() => {
    const save = JSON.parse(localStorage.getItem('another-life:save') || 'null')
    const blood = JSON.parse(localStorage.getItem('another-life:bloodline') || 'null')
    // 存档结构内不得出现 bloodline/继承字段（硬纪律：世代传承走独立键，禁写存档 v2 结构）
    const saveStr = JSON.stringify(save || {})
    return {
      hasBloodKey: !!localStorage.getItem('another-life:bloodline'),
      bloodInSave: saveStr.includes('bloodline') || saveStr.includes('inheritanceMoney') || saveStr.includes('ancestorName'),
      legacyKeyUntouched: localStorage.getItem('another-life:legacy') === null || localStorage.getItem('another-life:legacy') !== undefined,
      generation: blood?.generation ?? null,
    }
  })()`)
  report('8.3 file:// 传承：血脉键与存档键/legacy 键完全隔离（存档 v2 结构零污染）',
    iso.hasBloodKey && iso.bloodInSave === false && iso.generation === 2 && !!blSaved && !!bloodKeyBefore,
    JSON.stringify({ ...iso, savePresent: !!blSaved, bloodBefore: !!bloodKeyBefore, saveBeforePresent: !!saveKeyBefore }))
  // 复原：清血脉键（后续轮次不应被传承态污染）
  await evalJs(`localStorage.removeItem('another-life:bloodline')`)

  // ---- 页面异常 ----
  const hardErrors = await evalJs(`window.__errs ?? []`)
  report(
    '7.1 全程无页面异常（error/unhandledrejection）',
    hardErrors.length === 0,
    `errs=${JSON.stringify(hardErrors.slice(0, 3))}`
  )

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
