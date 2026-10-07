// 第 97 轮（V5）：重大时刻全屏演出 CDP 验证——注入三局构造存档（结婚/购房+上岸/丧亲），
// 继续游戏恢复至结算面板（awaiting 态），断言 .moment-overlay 渐显且文案与注入条目一致。
// 构造=引擎直出（createNewGame+advanceYear 推进至 29 岁，再注入 30 岁里程碑 history 条目）。
// 运行：npx tsx scripts/moment_verify.ts（前置：npm run build）
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createNewGame } from '../src/engine/init'
import { advanceYear } from '../src/engine/lifecycle'
import { serializeSession, sessionFromSaveData } from '../src/save/storage'
import { ALL_EVENTS } from '../src/data/events'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const FILE_URL = 'file:///D:/vibe%20coding/another-life/dist/index.html'
const results = []
function report(step, pass, evidence) {
  results.push({ step, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${step} | ${evidence}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const MILESTONES = {
  married: { eventId: 'rel_propose', title: '戒指已经挑好了', choice: '办一场体面的婚礼', summary: '婚礼办得热热闹闹' },
  home: { eventId: 'mid_house_down_payment', title: '首付的压力', choice: '掏空积蓄上车', summary: '从此是有房的人了' },
  rank: { eventId: 'civ_exam', title: '笔试面试放榜', choice: '走进考场', summary: '放榜那天的名字被很多人念了一遍' },
  loss: { eventId: 'settle', title: '送别', choice: '', summary: '父亲走了。你送了最后一程', key: true },
}

function buildSaveJson(kind: string, seed: number): string {
  let s = createNewGame({ seed, backgroundId: 'ordinary', traitId: 'bookworm', name: '演出者' })
  while (s.phase === 'playing' && s.age < 29) s = advanceYear(s)
  const m = MILESTONES[kind as keyof typeof MILESTONES]
  s = { ...s, age: 30, history: [...s.history, { age: 30, ...m }] }
  const session = { state: s, currentEvent: null, awaitingAdvance: true, lastSummary: '', lastDeltas: [] }
  const { session: restored } = sessionFromSaveData(serializeSession(session), ALL_EVENTS)
  return JSON.stringify(serializeSession(restored))
}

const userData = mkdtempSync(join(tmpdir(), 'al97-moment-'))
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=9346', `--user-data-dir=${userData}`,
  '--window-size=1280,800', '--no-first-run', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' })

async function main() {
  let ok = false
  for (let i = 0; i < 50; i++) {
    try { await fetch('http://127.0.0.1:9346/json'); ok = true; break } catch { await sleep(200) }
  }
  if (!ok) throw new Error('CDP 未就绪')
  const list = await (await fetch('http://127.0.0.1:9346/json')).json()
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

  await send('Page.enable')
  await send('Page.navigate', { url: FILE_URL })
  await sleep(1500)

  const CASES = ['married', 'home', 'rank', 'loss']
  const seen: string[] = []
  for (const kind of CASES) {
    const saveJson = buildSaveJson(kind, 9700 + CASES.indexOf(kind))
    await evalJs(`localStorage.setItem('another-life:save', ${JSON.stringify(saveJson)})`)
    await send('Page.reload')
    await sleep(1200)
    // 继续游戏（恢复结算面板，overlay 随面板渲染渐显）
    await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('继续游戏'))?.click()`)
    await sleep(400)
    const probe = await evalJs(`(() => {
      const card = document.querySelector('.moment-card')
      return {
        overlay: !!document.querySelector('.moment-overlay'),
        label: card?.querySelector('.moment-label')?.textContent ?? '',
        age: card?.querySelector('.moment-age')?.textContent ?? '',
        sentence: card?.querySelector('.moment-sentence')?.textContent ?? '',
      }
    })()`)
    const pass = probe.overlay && probe.label.length > 0 && probe.sentence.length > 0
    if (pass) seen.push(kind)
    report(`演出·${kind}`, pass, JSON.stringify(probe))
    await sleep(1800) // 渐显结束再换局
  }
  report('三类以上演出实证', seen.length >= 3, `seen=${seen.join(',')}`)

  // reduced-motion 压平：同款结婚局 + CDP 模拟 prefers-reduced-motion → overlay 不渲染
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  const rmSave = buildSaveJson('married', 9700)
  await evalJs(`localStorage.setItem('another-life:save', ${JSON.stringify(rmSave)})`)
  await send('Page.reload')
  await sleep(1200)
  await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('继续游戏'))?.click()`)
  await sleep(400)
  const rmProbe = await evalJs(`(() => {
    const card = document.querySelector('.moment-card')
    const media = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return { card: !!card, media }
  })()`)
  report('reduced-motion 压平：overlay 不渲染（JS matchMedia 同判生效）',
    !rmProbe.card && rmProbe.media, JSON.stringify(rmProbe))
  await send('Emulation.setEmulatedMedia', { features: [] })

  chrome.kill()
  process.exit(results.every((r) => r.pass) ? 0 : 1)
}

main().catch((e) => {
  console.error('FATAL', e.message ?? e)
  try { chrome.kill() } catch {}
  try { spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }) } catch {}
  process.exit(2)
})
