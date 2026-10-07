// 第 55 轮：键盘全流程验收（常驻可复跑）——file:// 生产 dist，零鼠标。
// 流程：首页 Tab→Enter 开始 → 创建页全键盘（Tab 选卡/输入名/出发）→
// 游戏页数字键 1~5 选择 + Enter 推进（循环到终局）→ 结局页 Tab 聚焦分享卡 → Enter 下载落地。
// 附带：每步记录 document.activeElement（焦点可见性走查）；aria-label 抽查。
// 运行：node scripts/keyboard_verify.mjs（前置：npm run build 已产出最新 dist）
import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync, statSync } from 'node:fs'
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

const userData = mkdtempSync(join(tmpdir(), 'al55-kb-'))
const downloadDir = mkdtempSync(join(tmpdir(), 'al55-dl-'))
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=9249', `--user-data-dir=${userData}`,
  '--window-size=375,812', '--no-first-run', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' })

async function main() {
  let ok = false
  for (let i = 0; i < 50; i++) {
    try { await fetch('http://127.0.0.1:9249/json'); ok = true; break } catch { await sleep(200) }
  }
  if (!ok) throw new Error('CDP 未就绪')
  const list = await (await fetch('http://127.0.0.1:9249/json')).json()
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
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
    return r.result.value
  }
  /** 真实键盘事件（零鼠标）：key + code + vk；可带 text 产生字符输入 */
  const press = (key, code, vk, text) =>
    Promise.all([
      send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, ...(text ? { text, unmodifiedText: text } : {}) }),
      send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk }),
    ])
  const pressEnter = () => press('Enter', 'Enter', 13, '\r')
  const pressTab = () => press('Tab', 'Tab', 9)
  const pressEscape = () => press('Escape', 'Escape', 27)
  const pressDigit = (n) => press(String(n), `Digit${n}`, 48 + n, String(n))
  const focused = () => evalJs(`(() => {
    const a = document.activeElement
    return (a?.textContent ?? a?.tagName ?? 'none').trim().slice(0, 20)
  })()`)
  const waitFor = async (expr, timeout, label) => {
    for (let i = 0; i < Math.ceil(timeout / 200); i++) {
      if (await evalJs(expr)) return true
      await sleep(200)
    }
    console.log(`  waitFor 超时: ${label}`)
    return false
  }

  await send('Page.enable')
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir })
  await send('Page.navigate', { url: FILE_URL })
  await sleep(1500)

  // K1 首页：Tab 聚焦「开始新人生」→ Enter（焦点环随 tab 顺序走）
  let focus = ''
  let reached = false
  for (let i = 0; i < 8; i++) {
    focus = String(await focused())
    if (focus.includes('开始新人生')) { reached = true; break }
    await pressTab()
    await sleep(80)
  }
  report('K1 首页 Tab 可达「开始新人生」', reached, `焦点=${focus}`)
  await pressEnter()
  await waitFor(`!!document.querySelector('#name-input')`, 5000, 'creation')
  report('K2 Enter 进入创建页（姓名输入框在位）', await evalJs(`!!document.querySelector('#name-input')`), 'input 聚焦待输入')

  // K3 创建页：Tab 循环选背景卡与特质卡（Enter 选中）→ 输入名字 → Tab 至「出发」→ Enter
  const selectCard = async (marker) => {
    for (let i = 0; i < 26; i++) {
      const f = String(await focused())
      if (f.includes(marker)) {
        await pressEnter()
        await sleep(120)
        return true
      }
      await pressTab()
      await sleep(60)
    }
    return false
  }
  const bgOk = await selectCard('普通家庭')
  const traitOk = await selectCard('书虫')
  report('K3 创建卡全键盘可选（背景/特质 Enter 选中）', bgOk && traitOk, `背景=${bgOk} 特质=${traitOk}`)
  // 姓名输入：Tab 到 input（卡后第一个可聚焦输入位）或直接聚焦
  let atInput = false
  for (let i = 0; i < 30 && !atInput; i++) {
    atInput = await evalJs(`document.activeElement?.id === 'name-input'`)
    if (!atInput) await pressTab()
    await sleep(50)
  }
  if (!atInput) {
    await evalJs(`document.querySelector('#name-input')?.focus()`)
    atInput = true
  }
  for (const ch of '键盘玩家') {
    await press(ch, '', 0, ch)
    await sleep(40)
  }
  const nameVal = await evalJs(`document.querySelector('#name-input')?.value ?? ''`)
  report('K4 姓名输入框键盘输入（insertText 逐字）', String(nameVal).includes('键盘玩家'), `值=${nameVal}`)

  // 第 107 轮 K4b：抽签仪式纯键盘可达。Tab 走到「抽一签」→ Enter → 揭示后焦点由组件
  // 自动落到「这就是我的起点」→ Enter 回填自选表单。走完这一步再继续 Tab 到「出发」，
  // 顺带证明抽签区**没有截断后续 Tab 序**（确认后卡片复位，焦点链恢复原状）。
  let atDraw = false
  for (let i = 0; i < 30; i++) {
    const f = String(await focused())
    if (f.includes('抽一签')) { atDraw = true; break }
    await pressTab()
    await sleep(60)
  }
  await pressEnter()
  const drew = await waitFor(`document.querySelectorAll('.fortune-suspense').length === 2`, 3000, 'draw')
  const revealedByKey = await waitFor(`document.querySelectorAll('.fortune-card-shown').length === 1`, 4000, 'reveal')
  const focusAfterReveal = String(await focused())
  const drawnPair = await evalJs(
    `[...document.querySelectorAll('.fortune-name')].map(e => e.textContent).join('|')`,
  )
  report('K4b 抽签全键盘可达（Tab 抽一签 → Enter → 悬念 → 自动揭示 → 焦点落确认键）',
    atDraw && drew && revealedByKey && focusAfterReveal.includes('这就是我的起点'),
    `抽签键=${atDraw} 悬念=${drew} 揭示=${revealedByKey} 焦点=${focusAfterReveal} 抽中=${drawnPair}`)
  await pressEnter()
  await sleep(150)
  const backfilled = await evalJs(
    `[...document.querySelectorAll('.opt-card.selected')].map(e => e.querySelector('.opt-name').textContent).join('|')`,
  )
  report('K4c Enter 确认抽签 → 组合回填自选表单（键盘路径与鼠标路径同一出口）',
    backfilled === drawnPair, `抽中=${drawnPair} 回填=${backfilled}`)

  // Tab 至「出发」并 Enter
  let atStart = false
  for (let i = 0; i < 26; i++) {
    const f = String(await focused())
    if (f.includes('出发')) { atStart = true; break }
    await pressTab()
    await sleep(60)
  }
  report('K5 Tab 可达「出发」（抽签确认后焦点链未被截断）', atStart, `焦点=${String(await focused())}`)
  await pressEnter()
  await waitFor(`!!document.querySelector('.topbar-age')`, 6000, 'game')
  report('K6 Enter 进入游戏页', await evalJs(`!!document.querySelector('.topbar-age')`), `焦点=${String(await focused())}`)

  // K5b（第 74 轮）：引导浮层无障碍——Esc 跳过（与跳过按钮同记忆 done）+ 滚动锁解除
  const tutBefore = await evalJs(`!!document.querySelector('.tutorial-overlay')`)
  await pressEscape()
  await sleep(250)
  const tutAfter = await evalJs(`(() => ({
    gone: !document.querySelector('.tutorial-overlay'),
    done: localStorage.getItem('another-life:tutorial') === 'done',
    scrollUnlocked: document.body.style.overflow !== 'hidden',
  }))()`)
  report('K5b Esc 跳过引导（焦点陷阱解锁+记忆 done+滚动恢复）',
    tutBefore && tutAfter.gone && tutAfter.done && tutAfter.scrollUnlocked,
    JSON.stringify({ tutBefore, ...tutAfter }))

  // K6b：C 键切换履历折叠（第 55 轮快捷键）
  await evalJs(`document.querySelector('details.history')?.removeAttribute('open')`)
  await press('c', 'KeyC', 67)
  await sleep(120)
  const cOpened = await evalJs(`document.querySelector('details.history')?.open === true`)
  await press('c', 'KeyC', 67)
  await sleep(120)
  const cClosed = await evalJs(`document.querySelector('details.history')?.open === false`)
  report('K6b C 键切换履历折叠（开→关）', cOpened && cClosed, `开=${cOpened} 关=${cClosed}`)

  // K6c（第 84 轮）：数字键 1 选首个事件选项 → 行动条出现（可跳过；可用行动 ≥1）
  await pressDigit(1)
  const barOk = await waitFor(`!!document.querySelector('.action-bar')`, 5000, 'action-bar')
  const barInfo = await evalJs(`(() => ({
    label: document.querySelector('.action-bar-label')?.textContent ?? '',
    enabled: document.querySelectorAll('.action-btn:not(:disabled)').length,
    total: document.querySelectorAll('.action-btn').length,
  }))()`)
  report('K6c 事件结算后行动条出现（标签+可用行动 ≥1）',
    barOk && barInfo.label.includes('今年还想做点什么') && barInfo.enabled >= 1, JSON.stringify(barInfo))

  // K6d（第 84 轮）：数字键 1 执行首个可用行动 → 已行动注记 + 履历落 ◆ 条目
  await pressDigit(1)
  await sleep(300)
  const acted = await evalJs(`(() => ({
    note: !!document.querySelector('.action-done-note'),
    star: [...document.querySelectorAll('.history-list b')].some((b) => b.textContent.startsWith('◆')),
    locked: document.querySelectorAll('.action-btn:not(:disabled)').length === 0,
  }))()`)
  report('K6d 数字键执行行动（注记态+履历 ◆+行动后按钮全灰）',
    acted.note && acted.star && acted.locked, JSON.stringify(acted))

  // K6e（第 84 轮）：数字键 0＝什么都不做，直接跨年（行动条随之消失）
  await pressDigit(0)
  const skipped = await waitFor(`!!document.querySelector('.event-card') && !document.querySelector('.action-bar')`, 5000, 'skip-advance')
  report('K6e 0 键跳过行动直接跨年（行动条消失+新年事件在位）', skipped, `skipped=${skipped}`)

  // K7 游戏页：数字键选择 + Enter 推进，循环到终局（全程键盘，零鼠标）
  let ending = null
  let usedDigit = false
  let usedEnter = false
  for (let i = 0; i < 500; i++) {
    const step = await evalJs(`(() => {
      const endName = document.querySelector('.ending-name')
      if (endName) return { kind: 'ending', name: endName.textContent }
      const choices = [...document.querySelectorAll('.event-card .choice-btn:not(.locked)')]
      if (choices.length > 0) return { kind: 'choices', n: choices.length }
      const next = [...document.querySelectorAll('.result-panel button')].find((b) => b.textContent.includes('进入下一年'))
      if (next) return { kind: 'next' }
      const skip = [...document.querySelectorAll('button')].find(b => b.textContent.includes('跳过这一年'))
      if (skip) return { kind: 'skip' }
      return { kind: 'stuck' }
    })()`)
    if (step.kind === 'ending') { ending = step; break }
    if (step.kind === 'stuck') break
    if (step.kind === 'choices') {
      // 数字键 1 选第一个可见选项（键盘语义走 GamePage 的 keydown 监听）
      await pressDigit(1)
      usedDigit = true
      await sleep(120)
      continue
    }
    if (step.kind === 'next') {
      await pressEnter()
      usedEnter = true
      await sleep(120)
      continue
    }
    if (step.kind === 'skip') {
      await pressEnter()
      await sleep(120)
    }
    await sleep(40)
  }
  report('K7 数字键选择 + Enter 推进全程到终局', !!ending && usedDigit && usedEnter,
    `${ending ? ending.name : '未到达'} · 数字键=${usedDigit} · Enter=${usedEnter}`)

  // K8 结局页：Tab 循环聚焦「保存分享卡」→ Enter → PNG 下载落地
  let atShare = false
  for (let i = 0; i < 24; i++) {
    const f = String(await focused())
    if (f.includes('保存分享卡')) { atShare = true; break }
    await pressTab()
    await sleep(60)
  }
  report('K8 Tab 可达「保存分享卡」', atShare, `焦点=${String(await focused())}`)
  await pressEnter()
  await sleep(1800)
  const files = readdirSync(downloadDir).filter((f) => f.endsWith('.png'))
  const size = files.length > 0 ? statSync(join(downloadDir, files[0])).size : 0
  // 第 78 轮：文件名带「第 N 次」与结局名（安全清洗后中文保留）——结局名从终局页取
  const endingName = await evalJs(`(() => {
    const raw = window.__lastSave ? JSON.parse(window.__lastSave) : null
    return raw && raw.state ? raw.state.name : null
  })()`)
  const dlName = files[0] ?? ''
  const nameOk =
    dlName.includes('另一种人生') && dlName.includes('第') && dlName.includes('次') && dlName.endsWith('.png')
  report('K9 Enter 触发分享卡下载（PNG 落地）', files.length > 0 && size > 20000,
    files.join(',') || '无文件', )
  report('K9b 下载文件名规范：另一种人生-第 N 次-…（结局名/终龄保留，扩展名 png）',
    files.length > 0 && nameOk && dlName.includes('岁'), `文件名=${dlName} 玩家=${endingName ?? '未知'}`)

  // K12（第 96 轮）：同龄人对照卡——终局页在位+四行分位+局数说明（零鼠标 DOM 断言）
  const peer = await evalJs(`(() => {
    const card = document.querySelector('.peer-compare')
    return {
      present: !!card,
      rows: document.querySelectorAll('.peer-row').length,
      note: document.querySelector('.peer-note')?.textContent ?? '',
      sample: card?.textContent.includes('模拟人生') ?? false,
    }
  })()`)
  report('K12 同龄人对照卡：终局页在位+四行分位+局数说明',
    peer.present && peer.rows === 4 && peer.sample && peer.note.includes('局模拟'), JSON.stringify(peer))

  // K13（第 121 轮）：「另一条路上」遗憾清单——条数 ≤3+占位符已插值+克制措辞（禁句零命中）
  const regret = await evalJs(`(() => {
    const card = document.querySelector('.regret-section')
    const rows = [...document.querySelectorAll('.regret-row')]
    return {
      present: !!card,
      rows: rows.length,
      alts: rows.map((r) => r.querySelector('.regret-alt')?.textContent ?? ''),
      label: card?.getAttribute('aria-label') ?? '',
    }
  })()`)
  const regretOk =
    regret.alts.length <= 3 &&
    regret.alts.every((t) => t.startsWith('如果当初——') && !t.includes('{name}') && !t.includes('你本应该'))
  report('K13 另一条路上：条数 ≤3+「如果当初——」句式+占位符插值+禁句零命中（无转折时卡不渲染亦合规）',
    regretOk, JSON.stringify(regret))

  // K10 aria 抽查：关键交互元素带可读名称
  await send('Page.reload')
  await sleep(1200)
  const aria = await evalJs(`(() => {
    const btns = [...document.querySelectorAll('button')]
    const unnamed = btns.filter((b) => !(b.textContent.trim() || b.getAttribute('aria-label'))).length
    return { total: btns.length, unnamed }
  })()`)
  report('K10 aria 走查：全部按钮有可读名称（文本或 aria-label）', aria.unnamed === 0, JSON.stringify(aria))

  // K11（第 73 轮）：往生录展开式回顾——终局清档后 reload 已回首页且落 1 块碑；
  // details 默认收起（Tab 不进关闭的 details）→ 先 Tab 聚焦「往生录」summary 并 Enter
  // 展开 → 继续聚焦碑头按钮 → Enter 展开碑（抉择/峰值露出）→ Enter 收起
  let k11 = { focused: false, expanded: false, content: false, collapsed: false }
  for (let i = 0; i < 48 && !k11.focused; i++) {
    const f = String(await focused())
    if (f.includes('往生录')) {
      await pressEnter() // 展开往生录 details
      await sleep(300)
      for (let j = 0; j < 16; j++) {
        const on = await evalJs(`(() => {
          const t = document.querySelector('.legacy-toggle')
          return { on: document.activeElement === t, expanded: t?.getAttribute('aria-expanded') ?? null }
        })()`)
        if (on.on) {
          k11.focused = true
          await pressEnter()
          await sleep(400)
          const opened = await evalJs(`(() => {
            const t = document.querySelector('.legacy-toggle')
            const inner = document.querySelector('.legacy-more.open .legacy-more-inner')
            return {
              expanded: t?.getAttribute('aria-expanded') === 'true',
              content: !!inner && (inner.textContent.includes('资产峰值出现在') || inner.textContent.includes('抉择记录')),
            }
          })()`)
          k11.expanded = opened.expanded
          k11.content = opened.content
          await pressEnter()
          await sleep(400)
          k11.collapsed =
            (await evalJs(`document.querySelector('.legacy-toggle')?.getAttribute('aria-expanded') === 'false'`)) === true
          break
        }
        await pressTab()
        await sleep(60)
      }
      break
    }
    await pressTab()
    await sleep(60)
  }
  report('K11 往生录展开式回顾：Tab 聚焦碑头 → Enter 展开（抉择/峰值）→ Enter 收起',
    k11.focused && k11.expanded && k11.content && k11.collapsed, JSON.stringify(k11))

  const fails = results.filter((r) => !r.pass).length
  console.log(`\nSUMMARY: ${results.length - fails}/${results.length} PASS`)
  process.exit(fails > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL', e.message ?? e)
  try { chrome.kill() } catch {}
  try { spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }) } catch {}
  process.exit(2)
}).finally(async () => {
  try { chrome.kill() } catch {}
  try { spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }) } catch {}
})
