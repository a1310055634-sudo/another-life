// 第 33 轮（动效 I）浏览器级验收：count-up 真实滚动且结束帧收敛到终值；
// prefers-reduced-motion 模拟下无滚动（直出终值）且过渡全部关闭。
// 每实例独立 Chrome（独立 user-data-dir，端口 9234/9235 避让）。
// 前置：npm run build 已产出最新 dist。
// 运行：node scripts/round33_motion_check.mjs
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

async function launch(name, port, reduceMotion) {
  const userData = mkdtempSync(join(tmpdir(), `al33-${name}-`))
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userData}`,
    '--window-size=420,820',
    '--no-first-run', '--disable-gpu', 'about:blank',
  ], { stdio: 'ignore' })
  let ok = false
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json`); ok = true; break } catch { await sleep(200) }
  }
  if (!ok) throw new Error(`${name}: CDP 端口未就绪`)
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
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

  await send('Page.enable')
  if (reduceMotion) {
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
  }
  await send('Page.navigate', { url: FILE_URL })
  const t0 = Date.now()
  while (Date.now() - t0 < 10000) {
    if (await evalJs(`document.readyState === 'complete'`)) break
    await sleep(120)
  }
  await sleep(700)

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
    setter.call(inp, '动效体检员')
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
  return { chrome, ws, send, evalJs }
}

// 结果面板里的金钱 count-up span（无属性 <span>，仅 CountUp 产生）
const SPANS = `[...document.querySelectorAll('.delta-row span.delta span')].map(s => s.textContent)`

// 采集一回合：装 30ms 采样钩子 → 选择 → 等结果面板 → 收集滚动样本。
// 返回 { samples, finalTexts }；面板无金钱 delta 时返回 null（调用方推进下一年重试）。
async function sampleRound(ctx) {
  const { evalJs } = ctx
  await evalJs(`(() => {
    window.__samples = []
    window.__sampler = setInterval(() => {
      const t = ${SPANS}
      if (t.length) window.__samples.push(t.join('|'))
    }, 30)
    return true
  })()`)
  await evalJs(`document.querySelector('.event-card .choice-btn:not(.locked)')?.click()`)
  const t0 = Date.now()
  while (Date.now() - t0 < 5000) {
    if (await evalJs(`!!document.querySelector('.result-panel')`)) break
    await sleep(100)
  }
  await sleep(1500) // 覆盖 320ms 动画全程
  const samples = await evalJs(`window.__samples`)
  await evalJs(`clearInterval(window.__sampler); window.__samples = undefined; true`)
  const finals = await evalJs(SPANS)
  if (!samples || samples.length === 0) return null // 本回合无金钱 delta
  return { samples, finals }
}

async function runInstance(name, port, reduceMotion) {
  console.log(`\n──── 实例 ${name}${reduceMotion ? '（模拟 prefers-reduced-motion: reduce）' : '（正常动效）'} ────`)
  const ctx = await launch(name, port, reduceMotion)
  try {
    const mm = await ctx.evalJs(`window.matchMedia('(prefers-reduced-motion: reduce)').matches`)
    report(`${name} 媒体查询模拟生效`, mm === reduceMotion, `matchMedia reduce = ${mm}`)

    if (!reduceMotion) {
      // 过渡挂载证据：按压 transform、属性条 width（--dur-slow 320ms）
      const trans = await ctx.evalJs(`(() => {
        const probe = document.createElement('button'); probe.className = 'choice-btn'
        document.body.appendChild(probe)
        const cs = getComputedStyle(probe)
        const out = { choice: { property: cs.transitionProperty, duration: cs.transitionDuration } }
        probe.remove()
        const bar = document.querySelector('.attr-fill')
        out.attrFill = { property: getComputedStyle(bar).transitionProperty, duration: getComputedStyle(bar).transitionDuration }
        return out
      })()`)
      report(`${name} choice-btn 按压过渡挂载（含 transform）`,
        trans.choice.property.includes('transform') && trans.choice.duration.includes('0.05'),
        JSON.stringify(trans.choice))
      report(`${name} attr-fill 宽度过渡挂载（--dur-slow 320ms）`,
        trans.attrFill.property.includes('width') && trans.attrFill.duration.includes('0.32'),
        JSON.stringify(trans.attrFill))
    } else {
      // 降级证据：三类元素 + 属性条过渡全关
      const trans = await ctx.evalJs(`(() => {
        const mk = (cls) => { const el = document.createElement(cls === 'btn' ? 'button' : 'div'); el.className = cls; document.body.appendChild(el); return el }
        const btn = mk('btn'), choice = mk('choice-btn'), opt = mk('opt-card')
        const out = {
          btn: getComputedStyle(btn).transitionDuration,
          choice: getComputedStyle(choice).transitionDuration,
          opt: getComputedStyle(opt).transitionDuration,
          attrFill: getComputedStyle(document.querySelector('.attr-fill')).transitionDuration,
        }
        ;[btn, choice, opt].forEach(e => e.remove())
        return out
      })()`)
      report(`${name} reduced-motion 下过渡全关（btn/choice/opt/attr-fill 均 0s）`,
        [trans.btn, trans.choice, trans.opt, trans.attrFill].every(d => d.startsWith('0s')),
        JSON.stringify(trans))
    }

    // 找一回合有金钱 delta 的结算，采集滚动样本（最多 12 回合）
    let round = null
    for (let i = 0; i < 12 && !round; i++) {
      round = await sampleRound(ctx)
      if (!round) {
        const advanced = await ctx.evalJs(`(() => {
          const next = document.querySelector('.result-panel button')
          if (next) { next.click(); return true }
          const skip = [...document.querySelectorAll('button')].find(b => b.textContent.includes('跳过这一年'))
          if (skip) { skip.click(); return true }
          return false
        })()`)
        if (!advanced) break
        const t0 = Date.now()
        while (Date.now() - t0 < 5000) {
          if (await ctx.evalJs(`!!document.querySelector('.event-card') || !!document.querySelector('.result-panel')`)) break
          await sleep(100)
        }
      }
    }
    if (!round) {
      report(`${name} 采集到金钱 delta 回合`, false, '12 回合内未出现金钱 delta')
      return
    }

    if (!reduceMotion) {
      const uniq = [...new Set(round.samples)]
      report(`${name} count-up 真实滚动（多帧文本变化）`, uniq.length >= 2,
        `样本 ${round.samples.length} 帧 / 去重 ${uniq.length} 种：[${uniq.slice(0, 4).join(' , ')}${uniq.length > 4 ? ' …' : ''}]`)
      const stableTail = round.samples[round.samples.length - 1] === round.samples[round.samples.length - 2]
        && round.samples[round.samples.length - 2] === round.samples[round.samples.length - 3]
      report(`${name} 动画结束帧收敛（末三帧一致 = 终值稳定显示）`, stableTail,
        `末三帧 [${round.samples.slice(-3).join(' , ')}]`)
      report(`${name} 结束帧文本与结算面板当前显示一致`,
        round.samples[round.samples.length - 1] === round.finals.join('|'),
        `末帧 ${round.samples[round.samples.length - 1]} / DOM ${round.finals.join('|')}`)
    } else {
      const uniq = [...new Set(round.samples)]
      report(`${name} reduced-motion 下无滚动（仅一种文本 = 直出终值）`, uniq.length === 1,
        `样本 ${round.samples.length} 帧 / 去重 ${uniq.length} 种：${uniq[0]}`)
      report(`${name} 直出值与结算面板当前显示一致`, uniq[0] === round.finals.join('|'),
        `样本 ${uniq[0]} / DOM ${round.finals.join('|')}`)
    }
  } finally {
    try { ctx.chrome.kill() } catch {}
    try { execSync(`taskkill /PID ${ctx.chrome.pid} /T /F`, { stdio: 'ignore' }) } catch {}
  }
}

await runInstance('motion', 9234, false)
await runInstance('reduce', 9235, true)

const fails = results.filter((r) => !r.pass).length
console.log(`\nSUMMARY: ${results.length - fails}/${results.length} PASS`)
process.exit(fails > 0 ? 1 : 0)
