// S6 失败诊断：只读，量测 bloodline 键在各个操作点的实际值。
import { spawn, execSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const FILE_URL = 'file:///D:/vibe%20coding/another-life/dist/index.html'
const SAVE_KEY = 'another-life:save'
const BLOODLINE_KEY = 'another-life:bloodline'

const userData = mkdtempSync(join(tmpdir(), 'al105-bldiag-'))
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9361', `--user-data-dir=${userData}`, '--window-size=420,820', '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' })
let msgId = 0
const pending = new Map()
let ws
function send(method, params = {}) { return new Promise((res, rej) => { pending.set(++msgId, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: msgId, method, params })) }) }
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error('eval err: ' + JSON.stringify(r.exceptionDetails).slice(0, 200))
  return r.result.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(expr, t, label) { const t0 = Date.now(); while (Date.now() - t0 < t) { if (await evalJs(expr)) return; await sleep(120) } throw new Error('timeout ' + label) }
const dump = async (tag) => {
  const v = await evalJs(`localStorage.getItem(${JSON.stringify(BLOODLINE_KEY)})`)
  console.log(`${tag}: ${v === null ? 'null' : v}`)
}
async function main() {
  for (let i = 0; i < 50; i++) { try { await fetch('http://127.0.0.1:9361/json'); break } catch { await sleep(200) } }
  const list = await (await fetch('http://127.0.0.1:9361/json')).json()
  ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); if (m.error) reject(new Error(m.error.message)); else resolve(m.result) } }
  await send('Page.navigate', { url: FILE_URL })
  await waitFor(`document.readyState === 'complete'`, 10000, 'load')
  await sleep(400)

  const SEED = JSON.stringify({ generation: 3, surname: '林', inheritanceMoney: 123456, ancestorName: '林晚', ancestorEndingId: 'pillar', finishedAt: 1750000000000 })
  console.log('SEED literal: ' + SEED)
  await evalJs(`localStorage.clear(); true`)
  await evalJs(`localStorage.setItem(${JSON.stringify(BLOODLINE_KEY)}, ${JSON.stringify(SEED)}); true`)
  await dump('after set        ')
  await evalJs(`location.reload()`)
  await waitFor(`document.readyState === 'complete'`, 10000, 'reload1')
  await sleep(800)
  await dump('after reload(首页)')
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('开始新人生')).click()`)
  await waitFor(`!!document.querySelector('#name-input')`, 5000, 'creation')
  await dump('at creation page ')
  await evalJs(`(() => { const inp = document.querySelector('#name-input'); const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(inp,'血'); inp.dispatchEvent(new Event('input',{bubbles:true})); return true })()`)
  await evalJs(`document.querySelectorAll('.opt-grid')[0].querySelector('button').click(); true`)
  await evalJs(`document.querySelectorAll('.opt-grid')[1].querySelector('button').click(); true`)
  await sleep(200)
  await evalJs(`document.querySelector('.creation-actions .btn-primary').click()`)
  await waitFor(`!!document.querySelector('.topbar-age')`, 6000, 'game')
  await dump('in game          ')
  await evalJs(`localStorage.removeItem(${JSON.stringify(SAVE_KEY)}); true`)
  await dump('after remove save')
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e.message ?? e); process.exit(2) }).finally(() => { try { chrome.kill() } catch {}; try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }) } catch {} })