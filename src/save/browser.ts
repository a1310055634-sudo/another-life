// 浏览器环境适配（第 18 轮）：localStorage 访问器与存档文件下载。
// 只做 I/O 搬运，不做任何规则计算 —— 规则与校验都在 storage.ts 纯函数里。
import type { Session } from '../engine/session'
import { SAVE_KEY, serializeSession, type SaveStorage } from './storage'

/** 返回包一层 try 语义的 localStorage 适配器；访问失败会原样抛出，由调用方捕获成提示 */
export function getBrowserStorage(): SaveStorage {
  return {
    getItem(key) {
      return window.localStorage.getItem(key)
    },
    setItem(key, value) {
      window.localStorage.setItem(key, value)
    },
    removeItem(key) {
      window.localStorage.removeItem(key)
    },
  }
}

function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]+/g, '')
}

/** 把当前进行中的一局导出为 JSON 文件（换浏览器/存储不可用时的手动备份） */
export function downloadSaveFile(session: Session): void {
  downloadJson(
    `another-life-${safeFileName(session.state.name) || 'save'}-${session.state.age}s.json`,
    JSON.stringify(serializeSession(session), null, 2),
  )
}

/** 导出存储里的原始存档文本（含损坏存档的救援导出）。没有可导出内容时返回 false */
export function downloadRawSave(storage: SaveStorage): boolean {
  let raw: string | null
  try {
    raw = storage.getItem(SAVE_KEY)
  } catch {
    return false
  }
  if (raw === null) return false
  downloadJson('another-life-save.json', raw)
  return true
}
