// 第 107 轮 A3/A4：抽签仪式 CDP 全流程 + 新手引导兼容性断言。
//
// 跑的是生产 dist（file://），不是 jsdom——本轮要验的是「动效时序 + 焦点管理 +
// 真实点击」三件 jsdom 测不了的东西。
//   A3 覆盖：抽 → 悬念（不剧透）→ 揭示 → 焦点自动落确认键 → 确认回填自选表单
//             → 开局预览随之刷新 → 出发进游戏页 → 全程零 console 错误。
//   A4 覆盖：首局引导在抽签开局路径下**照常出现一次**（既没被跳过，也没重复弹两次）。
//
// 端口用 9341（§11：9227 曾被 aDrive.exe 占用致轮询挂死，一律走 93xx）。
// 运行：node .r107/a3a4_flow.mjs（前置：npm run build）
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const FILE_URL = 'file:///D:/vibe%20coding/another-life/dist/index.html'
const PORT = 9341

const results = []
function report(step, pass, evidence) {
  results.push({ step, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${step} | ${evidence}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const userData = mkdtempSync(join(tmpdir(), 'al107-flow-'))
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userData}`,
  '--window-size=420,900', '--no-first-run', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' })

let ws
async function main() {
  let ok = false
  for (let i = 0; i < 60; i++) {
    try { await fetch(`http://127.0.0.1:${PORT}/json`); ok = true; break } catch { await sleep(200) }
  }
  if (!ok) throw new Error('CDP 未就绪')

  const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
  ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

  let msgId = 0
  const pending = new Map()
  const consoleErrors = []
  const pageErrors = []
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? reject(new Error(m.error.message)) : resolve(m.result)
      return
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200))
    }
    if (m.method === 'Runtime.exceptionThrown') {
      pageErrors.push((m.params.exceptionDetails?.exception?.description ?? '').slice(0, 200))
    }
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++msgId, { resolve, reject })
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) {
      throw new Error('eval 异常: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    }
    return r.result.value
  }
  const waitFor = async (expr, timeout, label) => {
    for (let i = 0; i < Math.ceil(timeout / 150); i++) {
      if (await evalJs(expr)) return true
      await sleep(150)
    }
    console.log(`  waitFor 超时: ${label}`)
    return false
  }
  // §11：click 后必须等 80ms，React 18 的 commit 在微任务里，同步读 DOM 会假红
  const clickSel = async (sel) => {
    const hit = await evalJs(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)})
      if (!el) return false
      el.click()
      return true
    })()`)
    await sleep(120)
    return hit
  }
  /** 按可见文案点按钮——首页/弹层里有多个同 class 按钮时唯一可靠的选择方式 */
  const clickText = async (text) => {
    const hit = await evalJs(`(() => {
      const el = [...document.querySelectorAll('button')]
        .find(b => b.textContent.replace(/\\s+/g, '').includes(${JSON.stringify(text)}))
      if (!el) return false
      el.click()
      return true
    })()`)
    await sleep(120)
    return hit
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.navigate', { url: FILE_URL })
  await sleep(1500)

  // ---- 前置：全新 profile 的 localStorage 必须是空的（引导未记忆）
  const freshKeys = await evalJs(`Object.keys(localStorage).filter(k => k.startsWith('another-life:')).sort()`)
  report('F0 全新 profile 无残留存档键（引导未被提前记忆）',
    Array.isArray(freshKeys) && freshKeys.length === 0, JSON.stringify(freshKeys))

  // ---- 首页 → 创建页（按文案找按钮：首页有「继续人生 / 开始新人生」两个 .btn-lg，
  //      全新 profile 下只有后者，纯 class 选择器会误伤）
  await clickText('开始新人生')
  await waitFor(`!!document.querySelector('#name-input')`, 6000, 'creation')
  report('F1 进入创建页（自选表单在位）', await evalJs(`!!document.querySelector('#name-input')`), 'ok')

  // ---- 自选网格完好（抽签是并列项，不是替代项）
  const grid = await evalJs(`(() => ({
    bg: document.querySelectorAll('.opt-grid')[0]?.querySelectorAll('.opt-card').length ?? -1,
    tr: document.querySelectorAll('.opt-grid')[1]?.querySelectorAll('.opt-card').length ?? -1,
    selected: document.querySelectorAll('.opt-card.selected').length,
    preview: document.querySelector('.preview-money strong')?.textContent ?? '',
    drawBtn: !!document.querySelector('.fortune-draw-btn'),
    hint: document.querySelector('.fortune-hint')?.textContent ?? '',
  }))()`)
  report('F2 自选网格完好（4 背景 + 6 天赋 + 默认选中 2）与抽签区并列',
    grid.bg === 4 && grid.tr === 6 && grid.selected === 2 && grid.drawBtn === true,
    JSON.stringify(grid))

  const moneyBefore = grid.preview

  // ---- A3-1 点「抽一签」→ 悬念态
  const clicked = await clickSel('.fortune-draw-btn')
  report('F3 点击「抽一签」进入悬念态', clicked, `clicked=${clicked}`)

  // 悬念态必须存在，且**不得剧透全名**（设计决策 6：先给半句、后揭示全貌）
  const suspense = await evalJs(`(() => ({
    card: document.querySelectorAll('.fortune-card').length,
    shown: document.querySelectorAll('.fortune-card-shown').length,
    suspense: [...document.querySelectorAll('.fortune-suspense')].map(e => e.textContent),
    names: document.querySelectorAll('.fortune-name').length,
    descs: document.querySelectorAll('.fortune-desc').length,
    pros: document.querySelectorAll('.fortune .opt-pros, .fortune .opt-cons').length,
    price: document.querySelector('.fortune').textContent.includes('¥'),
  }))()`)
  report('F4 悬念态：半句在位、全名零出现、不泄底',
    suspense.card === 1 && suspense.shown === 0 && suspense.suspense.length === 2 &&
    suspense.names === 0 && suspense.descs === 0 && suspense.pros === 0 && suspense.price === false,
    `半句=${JSON.stringify(suspense.suspense)} 全名数=${suspense.names}`)

  const suspenseLooksReal = await evalJs(`(() => {
    const list = [...document.querySelectorAll('.fortune-suspense')].map(e => e.textContent)
    return list.every(t => t.length > 2 && t.endsWith('……'))
  })()`)
  report('F5 悬念半句取自 desc 首分句且以省略号收尾（非空串占位）',
    suspenseLooksReal, 'ok')

  // ---- A3-2 等揭示（轮询而非定值 sleep）
  const revealedInTime = await waitFor(`document.querySelectorAll('.fortune-card-shown').length === 1`, 3000, 'reveal')
  report('F6 揭示在 3s 内自动完成（无需二次点击）', revealedInTime, `revealed=${revealedInTime}`)

  const revealed = await evalJs(`(() => ({
    names: [...document.querySelectorAll('.fortune-name')].map(e => e.textContent),
    descs: [...document.querySelectorAll('.fortune-desc')].map(e => e.textContent),
    suspense: document.querySelectorAll('.fortune-suspense').length,
    actions: document.querySelectorAll('.fortune-actions').length,
    confirm: document.querySelectorAll('.fortune-actions .btn-primary').length,
    focus: document.activeElement?.textContent?.trim() ?? '',
    hint: document.querySelector('.fortune-hint')?.textContent?.trim() ?? '',
  }))()`)
  report('F7 揭示态：背景+天赋两行全名全貌、确认键在位、焦点自动落确认键',
    revealed.names.length === 2 && revealed.descs.length === 2 && revealed.suspense === 0 &&
    revealed.actions === 1 && revealed.confirm === 1 &&
    revealed.focus.includes('这就是我的起点'),
    `全名=${JSON.stringify(revealed.names)} 焦点="${revealed.focus}"`)

  report('F8 提示行显示的是「表单此刻」（确认前尚未回填，仍为默认组合）',
    revealed.hint.includes('普通家庭'), `hint="${revealed.hint}"`)

  // ---- A3-3 点确认 → 回填自选表单
  const picked = revealed.names
  await clickSel('.fortune-actions .btn-primary')
  const afterConfirm = await evalJs(`(() => ({
    card: document.querySelectorAll('.fortune-card').length,
    drawBtn: !!document.querySelector('.fortune-draw-btn'),
    selected: [...document.querySelectorAll('.opt-card.selected')].map(e => e.querySelector('.opt-name').textContent),
    pressed: [...document.querySelectorAll('.opt-card[aria-pressed="true"]')].map(e => e.querySelector('.opt-name').textContent),
    money: document.querySelector('.preview-money strong')?.textContent ?? '',
  }))()`)
  report('F9 确认后抽中组合回填自选表单（aria-pressed 与 .selected 同步）',
    afterConfirm.drawBtn === true && afterConfirm.card === 0 &&
    afterConfirm.selected.length === 2 &&
    afterConfirm.selected[0] === picked[0] && afterConfirm.selected[1] === picked[1] &&
    JSON.stringify(afterConfirm.pressed) === JSON.stringify(afterConfirm.selected),
    `抽中=${JSON.stringify(picked)} 回填=${JSON.stringify(afterConfirm.selected)}`)

  // ---- A3-4 开局预览随之刷新（「抽签=自选」的最直接用户可见证据）
  const moneyChanged = afterConfirm.money !== moneyBefore
  report('F10 开局预览随抽签即时刷新（起始资金随组合变化）',
    moneyChanged, `${moneyBefore} → ${afterConfirm.money}`)

  // ---- A4 引导：确认抽签后开局，引导必须照常出现且仅一次
  await evalJs(`(() => {
    const inp = document.querySelector('#name-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, '抽签玩家')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(80)
  await clickSel('.creation-actions .btn-primary')
  const inGame = await waitFor(`!!document.querySelector('.topbar-age')`, 8000, 'game')
  report('F11 抽签组合可正常开局进入游戏页', inGame, `inGame=${inGame}`)

  const tut = await evalJs(`(() => ({
    overlays: document.querySelectorAll('.tutorial-overlay').length,
    step: document.querySelector('.tutorial-step')?.textContent?.trim() ?? '',
    title: document.querySelector('.tutorial-title')?.textContent?.trim() ?? '',
    body: document.querySelector('.tutorial-body')?.textContent?.trim() ?? '',
    locked: !!document.querySelector('.tutorial-overlay'),
  }))()`)
  report('F12 A4：新手引导在抽签开局路径下照常出现（未被跳过）',
    tut.overlays === 1 && tut.step !== '' && tut.title !== '' && tut.body !== '',
    `步=${tut.step} 标题=${tut.title}`)

  report('F13 A4：引导仅一个实例（无重复挂载）', tut.overlays === 1, `overlays=${tut.overlays}`)

  const keyBefore = await evalJs(`localStorage.getItem('another-life:tutorial')`)
  report('F14 引导记忆键在看完之前尚未写入（未被静默标记 done）',
    keyBefore === null, `key=${keyBefore}`)

  // 走完引导 → 应写入 done 且遮罩消失
  await clickSel('.tutorial-actions .btn-primary')
  await sleep(120)
  await clickSel('.tutorial-actions .btn-primary')
  await sleep(120)
  await clickSel('.tutorial-actions .btn-primary')
  await sleep(150)
  const tutDone = await evalJs(`(() => ({
    overlays: document.querySelectorAll('.tutorial-overlay').length,
    key: localStorage.getItem('another-life:tutorial'),
    play: document.querySelector('.tutorial-overlay') === null,
    playable: !!document.querySelector('.event-card, .event-panel, .topbar-age'),
  }))()`)
  report('F15 A4：走完引导后遮罩消失且记忆键置 done（下次开局不再弹）',
    tutDone.overlays === 0 && tutDone.key === 'done' && tutDone.playable === true,
    `overlays=${tutDone.overlays} key=${tutDone.key}`)

  // 存档键仍须是 save（本轮不碰存档结构）
  const keys = await evalJs(`Object.keys(localStorage).filter(k => k.startsWith('another-life:')).sort()`)
  report('F16 存储键仅新增 tutorial 记忆键，存档键结构未变',
    Array.isArray(keys) && keys.includes('another-life:save') && keys.includes('another-life:tutorial'),
    JSON.stringify(keys))

  report('F17 全程零 console.error / 零未捕获异常',
    consoleErrors.length === 0 && pageErrors.length === 0,
    `console.error=${consoleErrors.length} exception=${pageErrors.length}` +
    (consoleErrors.length ? ' | ' + consoleErrors.slice(0, 3).join(' ;; ') : '') +
    (pageErrors.length ? ' | ' + pageErrors.slice(0, 3).join(' ;; ') : ''))

  const fails = results.filter((r) => !r.pass).length
  console.log(`\nSUMMARY: ${results.length - fails}/${results.length} PASS`)
  ws.close()
  chrome.kill()
  process.exit(fails === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('脚本异常:', e.message)
  try { ws?.close() } catch { /* noop */ }
  chrome.kill()
  process.exit(1)
})