// 第 34 轮（动效 II）浏览器级验收：
// ① 跨年「翻开新的一年」转场真实播放且播完隐身（fill forwards 末帧 opacity 0）；
// ② 结算卡/事件卡 rise-in 入场、选项 stagger 延迟递增（click 后同帧 getAnimations 确定性捕获）；
// ③ 快速连点不卡死不重复结算：连点风暴（含同步双击）后「年龄增量 == 进入下一年点击数」、
//    结算面板与事件卡 DOM 互斥、履历无相邻重复条目、风暴后再来一整回合仍响应；
// ④ prefers-reduced-motion 降级：全部新动画关闭、遮罩不出现、数据直出、连点逻辑不变。
// 每实例独立 Chrome（独立 user-data-dir，端口 9236/9237 避让）。
// 前置：npm run build 已产出最新 dist。
// 运行：node scripts/round34_transition_check.mjs
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
  const userData = mkdtempSync(join(tmpdir(), `al34-${name}-`))
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
  // 页面错误钩子：本轮全部交互期间的 error / unhandledrejection 都算失败
  await evalJs(`(() => {
    window.__errs = []
    window.addEventListener('error', (e) => window.__errs.push(String(e.message)))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('rejection:' + String(e.reason)))
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
    setter.call(inp, '转场体检员')
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

const AGE = `parseInt(document.querySelector('.topbar-age')?.textContent) || null`
// 遮罩样式事实（computed style 是声明，getAnimations 是运行证据）
const OVERLAY = `(() => {
  const f = document.querySelector('.year-flip')
  const b = document.querySelector('.year-flip-band')
  if (!f || !b) return null
  const cf = getComputedStyle(f)
  const cb = getComputedStyle(b)
  return {
    ariaHidden: f.getAttribute('aria-hidden'),
    pointerEvents: cf.pointerEvents,
    z: cf.zIndex,
    bandAnim: cb.animationName,
    bandDur: cb.animationDuration,
    bandFill: cb.animationFillMode,
    opacity: cb.opacity,
    text: b.textContent,
  }
})()`
const HISTORY_DUPS = `(() => {
  const items = [...document.querySelectorAll('.history-list li')].map(li => li.textContent)
  let dups = 0
  for (let i = 1; i < items.length; i++) if (items[i] === items[i - 1]) dups++
  return { total: items.length, dups }
})()`

/** 连点风暴一步：结算面板→同步双击「进入下一年」；事件卡→同步双击首个可选项。
    返回动作与互斥观测，供不变量统计。 */
const STORM_STEP = `(() => {
  const out = {}
  const panel = document.querySelector('.result-panel')
  const card = document.querySelector('.event-card')
  if (panel && card) { out.action = 'MUTEX_VIOLATION'; return out }
  if (panel) {
    // 第 84 轮：panel 内含行动条——推进按钮按文本定位（首按钮可能是行动按钮）
    const btn = [...panel.querySelectorAll('button')].find((b) => b.textContent.includes('进入下一年'))
    if (!btn) { out.action = 'NO_ADVANCE_BTN'; return out }
    btn.click(); btn.click()
    out.action = 'advance'
    return out
  }
  if (card) {
    const btn = card.querySelector('.choice-btn:not(.locked)')
    if (!btn) { out.action = 'NO_UNLOCKED_CHOICE'; return out }
    btn.click(); btn.click()
    out.action = 'choose'
    return out
  }
  out.action = 'idle'
  return out
})()`

async function storm(ctx, name, iters) {
  const age0 = await ctx.evalJs(AGE)
  let advance = 0, choose = 0, violations = [], anomalies = []
  for (let i = 0; i < iters; i++) {
    const step = await ctx.evalJs(STORM_STEP)
    if (step.action === 'advance') advance++
    else if (step.action === 'choose') choose++
    else if (step.action === 'MUTEX_VIOLATION') violations.push(`第${i}步 面板与事件卡同时出现`)
    else if (step.action !== 'idle') anomalies.push(`第${i}步 ${step.action}`)
    await sleep(45)
  }
  // 等风暴中的最后一次点击落定
  const t0 = Date.now()
  while (Date.now() - t0 < 4000) {
    const s = await ctx.evalJs(`!!document.querySelector('.result-panel') || !!document.querySelector('.event-card') || !!document.querySelector('.ending')`)
    if (s) break
    await sleep(100)
  }
  const age1 = await ctx.evalJs(AGE)
  const hist = await ctx.evalJs(HISTORY_DUPS)
  report(`${name} 连点风暴：年龄增量(${age1}-${age0}=${age1 - age0}) === 进入下一年点击数(${advance})，无重复结算`,
    typeof age0 === 'number' && typeof age1 === 'number' && age1 - age0 === advance,
    `choose=${choose} 次、履历 ${hist.total} 条`)
  report(`${name} 连点风暴：结算面板与事件卡 DOM 互斥全程未被破坏`, violations.length === 0,
    violations.length ? violations.join('；') : '0 次互斥 violations')
  report(`${name} 连点风暴：履历无相邻重复条目（双击重复结算即会出现）`, hist.dups === 0,
    `相邻重复 ${hist.dups} 处`)
  return { anomalies, age0, age1, advance }
}

async function runInstance(name, port, reduceMotion) {
  console.log(`\n──── 实例 ${name}${reduceMotion ? '（模拟 prefers-reduced-motion: reduce）' : '（正常动效）'} ────`)
  const ctx = await launch(name, port, reduceMotion)
  try {
    const mm = await ctx.evalJs(`window.matchMedia('(prefers-reduced-motion: reduce)').matches`)
    report(`${name} 媒体查询模拟生效`, mm === reduceMotion, `matchMedia reduce = ${mm}`)

    // ── 转场遮罩 ──
    const ov = await ctx.evalJs(OVERLAY)
    if (!reduceMotion) {
      report(`${name} 遮罩挂载：aria-hidden 纯视觉 + pointer-events none + --z-overlay`,
        ov && ov.ariaHidden === 'true' && ov.pointerEvents === 'none' && ov.z === '100', JSON.stringify(ov))
      report(`${name} 翻页带动画挂载：year-flip-sweep 0.64s（--dur-slow ×2）`,
        ov.bandAnim === 'year-flip-sweep' && ov.bandDur === '0.64s' && ov.bandFill.includes('forwards'),
        `anim=${ov.bandAnim} dur=${ov.bandDur} fill=${ov.bandFill}`)
      // 真实播放：40ms 采样 opacity@transform，多帧变化且末态 opacity 收敛 0
      await ctx.evalJs(`(() => {
        window.__band = []
        window.__bs = setInterval(() => {
          const b = document.querySelector('.year-flip-band')
          if (b) { const cs = getComputedStyle(b); window.__band.push(cs.opacity + '@' + cs.transform) }
        }, 40)
        return true
      })()`)
      await sleep(1800)
      const band = await ctx.evalJs(`(() => { const s = (window.__band || []).slice(); clearInterval(window.__bs); return s })()`)
      const uniq = [...new Set(band)]
      report(`${name} 翻页带真实播放（opacity/transform 多帧变化）`, uniq.length >= 3,
        `采样 ${band.length} 帧 / 去重 ${uniq.length} 种：[${uniq.slice(0, 3).join(' , ')}…]`)
      const finalOv = await ctx.evalJs(OVERLAY)
      report(`${name} 翻页带播完隐身（fill forwards 末帧 opacity 0，不永久遮挡）`,
        finalOv.opacity === '0', `末态 opacity=${finalOv.opacity}`)
    } else {
      report(`${name} 降级：遮罩不出现（animation none + 底态 opacity 0）`,
        ov && ov.bandAnim === 'none' && ov.opacity === '0' && ov.pointerEvents === 'none',
        JSON.stringify(ov))
    }

    // ── 结算卡入场：click 后页面内轮询（React 刷新在微任务，同步读太快），
    //    首次看到面板立即读 computed style + getAnimations（320ms 动画窗口内，确定性捕获）──
    const settle = await ctx.evalJs(`(() => new Promise((resolve) => {
      const btn = document.querySelector('.event-card .choice-btn:not(.locked)')
      if (!btn) return resolve(null)
      btn.click(); btn.click() // 同步双击：第二次必须被 no-op 守卫吞掉
      const t0 = Date.now()
      const poll = () => {
        const p = document.querySelector('.result-panel')
        if (p) {
          const cs = getComputedStyle(p)
          return resolve({ anim: cs.animationName, dur: cs.animationDuration,
            running: p.getAnimations().map(a => a.animationName),
            text: p.querySelector('.result-summary')?.textContent ?? '' })
        }
        if (Date.now() - t0 > 3000) return resolve({ panelMissing: true })
        setTimeout(poll, 30)
      }
      poll()
    }))()`)
    if (!settle || settle.panelMissing) {
      report(`${name} 选择后结算面板出现`, false, JSON.stringify(settle))
      return
    }
    if (!reduceMotion) {
      report(`${name} 结算卡 rise-in 入场（声明 0.32s + 运行中动画捕获）`,
        settle.anim === 'rise-in' && settle.dur === '0.32s' && settle.running.includes('rise-in'),
        `anim=${settle.anim} dur=${settle.dur} running=[${settle.running}]`)
    } else {
      report(`${name} 降级：结算卡无动画且数据直出`,
        settle.anim === 'none' && settle.running.length === 0 && settle.text.length > 0,
        `anim=${settle.anim} running=${settle.running.length} summary="${settle.text.slice(0, 24)}…"`)
    }

    // ── 跨年：事件卡入场 + 选项 stagger（同样的页面内轮询捕获）──
    const adv = await ctx.evalJs(`(() => new Promise((resolve) => {
      const btn = [...document.querySelectorAll('.result-panel button')].find(b => b.textContent.includes('进入下一年'))
      if (!btn) return resolve(null)
      const ageBefore = ${AGE}
      btn.click()
      const t0 = Date.now()
      const poll = () => {
        const c = document.querySelector('.event-card')
        if (c) {
          const cs = getComputedStyle(c)
          return resolve({ ageBefore, info: { card: {
            anim: cs.animationName, dur: cs.animationDuration,
            running: c.getAnimations().map(a => a.animationName),
            choices: [...c.querySelectorAll('.choice-btn')].map(b => {
              const s = getComputedStyle(b)
              return { anim: s.animationName, delay: s.animationDelay, running: b.getAnimations().length }
            }),
          } } })
        }
        if (Date.now() - t0 > 3000) return resolve({ cardMissing: true, ageBefore })
        setTimeout(poll, 30)
      }
      poll()
    }))()`)
    if (!adv || adv.cardMissing) {
      report(`${name} 进入下一年后事件卡出现`, false, JSON.stringify(adv))
      return
    }
    const card = adv.info.card
    if (!reduceMotion) {
      const delays = card.choices.map((c) => parseFloat(c.delay))
      const inc = delays.every((d, i) => i === 0 || d > delays[i - 1])
      report(`${name} 事件卡 rise-in 入场`, card.anim === 'rise-in' && card.running.includes('rise-in'),
        `anim=${card.anim} running=[${card.running}]`)
      report(`${name} 选项 stagger：延迟严格递增且都在运行`, inc && card.choices.every((c) => c.running > 0),
        `delays=[${delays.join(', ')}]s × ${card.choices.length} 选项`)
    } else {
      report(`${name} 降级：事件卡与选项无动画`,
        card.anim === 'none' && card.running.length === 0 && card.choices.every((c) => c.anim === 'none' && c.running === 0),
        `card=${card.anim} choices=${card.choices.map((c) => c.anim).join(',')}`)
    }

    // ── 连点风暴：不卡死、不重复结算、状态一致 ──
    const s = await storm(ctx, name, reduceMotion ? 14 : 30)
    report(`${name} 连点风暴：无异常动作（无未解锁选项/无缺失按钮）`, s.anomalies.length === 0,
      s.anomalies.length ? s.anomalies.join('；') : '0 异常')

    // ── 风暴后再来一整回合：页面仍响应（不卡死）──
    const alive = await ctx.evalJs(`(() => {
      const card = document.querySelector('.event-card')
      if (!card) return { phase: 'ended-or-panel', hasCard: false }
      const btn = card.querySelector('.choice-btn:not(.locked)')
      if (!btn) return { phase: 'no-choice', hasCard: true }
      btn.click()
      return { phase: 'clicked', hasCard: true }
    })()`)
    let panelOk = false
    const t3 = Date.now()
    while (Date.now() - t3 < 4000) {
      if (await ctx.evalJs(`!!document.querySelector('.result-panel') || !!document.querySelector('.ending')`)) { panelOk = true; break }
      await sleep(100)
    }
    if (alive.phase === 'clicked' && panelOk) {
      const adv2 = await ctx.evalJs(`(() => {
        const ageNow = ${AGE}
        const btn = [...document.querySelectorAll('.result-panel button')].find(b => b.textContent.includes('进入下一年'))
        if (!btn) return { ageNow, advanced: false }
        btn.click()
        return { ageNow, advanced: true }
      })()`)
      let nextOk = false
      const t4 = Date.now()
      while (Date.now() - t4 < 4000) {
        if (await ctx.evalJs(`!!document.querySelector('.event-card') || !!document.querySelector('.ending')`)) { nextOk = true; break }
        await sleep(100)
      }
      report(`${name} 风暴后整回合仍响应（选择→结算→跨年）`,
        adv2.advanced && nextOk, `age=${adv2.ageNow} advanced=${adv2.advanced} nextShown=${nextOk}`)
    } else {
      report(`${name} 风暴后整回合仍响应`, panelOk, `phase=${alive.phase} settled=${panelOk}（提前终局或仍在结算，页面未卡死）`)
    }

    // ── 页面错误 ──
    const errs = await ctx.evalJs(`window.__errs`)
    report(`${name} 全程零页面错误`, Array.isArray(errs) && errs.length === 0,
      errs.length ? errs.slice(0, 3).join('；') : '0 错误')
  } finally {
    try { ctx.chrome.kill() } catch {}
    try { execSync(`taskkill /PID ${ctx.chrome.pid} /T /F`, { stdio: 'ignore' }) } catch {}
  }
}

await runInstance('motion', 9236, false)
await runInstance('reduce', 9237, true)

const fails = results.filter((r) => !r.pass).length
console.log(`\nSUMMARY: ${results.length - fails}/${results.length} PASS`)
process.exit(fails > 0 ? 1 : 0)
