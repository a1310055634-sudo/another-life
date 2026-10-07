import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from './engine/session'
import { chooseOption, nextYear, recoverMissingEvent, startSession } from './engine/session'
import { ALL_EVENTS } from './data/events'
import type { SaveData, SaveMeta } from './save/storage'
import {
  clearSaveFrom,
  deserializeSave,
  loadSessionFrom,
  readSaveMetaFrom,
  saveSessionTo,
  sessionFromSaveData,
} from './save/storage'
import { downloadRawSave, downloadSaveFile, getBrowserStorage } from './save/browser'
import { playClick, playPageFlip, playAchievement } from './sound'
import { performAction } from './engine/actions'
import { buildBloodlineEntry, applyBloodline, writeBloodline, readBloodline, willAllocationOf, pickMottoTriple, mottoById } from './engine/bloodline'
import { CHILD_NICKNAMES, pickName } from './data/names'
import { appendLegacy } from './legacy'
import { judgeEnding } from './engine/outcomes'
import { buildEndingEpilogue } from './engine/epilogues'
import HomePage from './pages/HomePage'
import CreationPage from './pages/CreationPage'
import GamePage from './pages/GamePage'
import EndingPage from './pages/EndingPage'

type Screen = 'home' | 'creation' | 'game'
type SaveState = 'none' | 'ok' | 'corrupt' | 'unavailable'

/** 一局一个随机 seed；进入游戏后一切随机都由 seed 复现 */
function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [session, setSession] = useState<Session | null>(null)
  // 首页存档状态：有效摘要 / 损坏（保留原文可导出）/ 存储不可用 / 无存档
  const [saveMeta, setSaveMeta] = useState<SaveMeta | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('none')
  const [saveReason, setSaveReason] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null) // 自动保存失败（游戏页横幅）
  const [restoreIssue, setRestoreIssue] = useState<string | null>(null) // 存档事件 ID 未知（游戏页横幅）
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<{ data: SaveData; unknownEventId: string | null } | null>(null)

  const refreshHome = useCallback(() => {
    const r = readSaveMetaFrom(getBrowserStorage())
    setSaveState(r.kind === 'ok' ? 'ok' : r.kind)
    setSaveMeta(r.kind === 'ok' ? r.meta : null)
    setSaveReason(r.kind === 'corrupt' || r.kind === 'unavailable' ? r.reason : '')
  }, [])

  useEffect(() => {
    refreshHome()
  }, [refreshHome])

  // 自动存档：角色创建、每次选择结算、每次进入下一年都会改变 session，
  // 统一在这一处落盘；终局即清档（结局是终点，不提供"继续"）。
  useEffect(() => {
    if (!session) return
    if (session.state.phase === 'ended') {
      // 第 53 轮：往生录——清档前落一条人生记录（幂等键防 effect 双调重复）
      const endedState = session.state
      const endedJudge = judgeEnding(endedState)
      const peaks = endedState.snapshots.map((s) => s.money)
      // 第 73 轮：展开式回顾素材——关键抉择摘录（key 履历优先，至多 3 条）与峰值年龄
      const choiceEntries = endedState.history.filter(
        (h) => h.summary && h.eventId !== 'settle' && h.eventId !== 'ach',
      )
      const keyPicked = choiceEntries.filter((h) => h.key).slice(0, 3)
      const keyChoices = (keyPicked.length > 0 ? keyPicked : choiceEntries.slice(0, 3)).map(
        (h) => `${h.age} 岁 · ${h.summary}`,
      )
      const peakSnapshot = endedState.snapshots.reduce(
        (best, s) => (s.money > best.money ? s : best),
        endedState.snapshots[0],
      )
      appendLegacy({
        name: endedState.name,
        endingId: endedJudge.id,
        endingName: endedJudge.name,
        grade: endedJudge.grade,
        age: endedState.age,
        peakMoney: Math.max(endedState.money, ...(peaks.length > 0 ? peaks : [endedState.money])),
        epitaph: buildEndingEpilogue(endedState, endedJudge.id)[0] ?? '',
        achievements: [...endedState.achievements],
        seed: endedState.seed,
        finishedAt: Date.now(),
        keyChoices,
        ...(peakSnapshot ? { peakAge: peakSnapshot.age } : {}),
      })
      clearSaveFrom(getBrowserStorage())
      setSaveError(null)
      return
    }
    const r = saveSessionTo(session, getBrowserStorage())
    setSaveError(
      r.ok
        ? null
        : `自动保存失败：${r.error}。进度尚未写入浏览器，可点下方「导出存档」先把文件保住。`,
    )
  }, [session])

  // 第 52 轮：成就解锁音——监听成就数增长（读档首挂不播：初值 -1 → 首个 effect 只记数）
  const prevAchCount = useRef(-1)
  useEffect(() => {
    if (!session) {
      prevAchCount.current = -1
      return
    }
    const n = session.state.achievements.length
    if (prevAchCount.current >= 0 && n > prevAchCount.current) playAchievement()
    prevAchCount.current = n
  }, [session])

  const clearTransient = () => {
    setSaveError(null)
    setRestoreIssue(null)
    setImportError(null)
    setPendingImport(null)
  }

  const handleStart = (name: string, backgroundId: string, traitId: string) => {
    clearTransient()
    // 覆盖旧存档的确认在首页完成；走到这里即玩家已确认
    setSession(startSession({ seed: randomSeed(), name, backgroundId, traitId }, ALL_EVENTS))
    setScreen('game')
  }

  // 第 94 轮：承继血脉开局——新 seed 独立掷、遗产到账、generation:N 标记、姓氏锁定
  // 第 122 轮：家训三选一（祖先条目 finishedAt 派生散列，同键恒同三张）+ 编年摘要注入创建页
  const bloodlineEntry = readBloodline()
  const mottoTriple = bloodlineEntry ? pickMottoTriple(bloodlineEntry.finishedAt) : undefined
  const mottoHint = bloodlineEntry?.mottoText ? ` 家训：「${bloodlineEntry.mottoText}」` : ''

  const handleStartBloodline = (name: string, backgroundId: string, traitId: string, mottoId?: string) => {
    clearTransient()
    const entry = readBloodline()
    const session = startSession({ seed: randomSeed(), name, backgroundId, traitId }, ALL_EVENTS)
    if (entry) {
      const childName = `${entry.surname}${pickName(CHILD_NICKNAMES, session.state.seed, 0x94, 1)}`
      const injected = applyBloodline({ ...session.state, name: childName }, entry, mottoId)
      // 家训落键（可选字段成对写入；编年面板读键展示）
      const motto = mottoById(mottoId)
      writeBloodline(motto ? { ...entry, mottoId: motto.id, mottoText: motto.text } : entry)
      setSession({ ...session, state: injected })
    } else {
      setSession(session)
    }
    setScreen('game')
  }

  // 第 94 轮：以子女之名承继血脉——终局态写入 bloodline 键，跳创建页开启承继
  // 第 117 轮：遗嘱分配方式从状态标记归一（无标记=even=旧行为）随条目落键
  const handleContinueBloodline = () => {
    const entry = buildBloodlineEntry(
      session!.state,
      readBloodline()?.generation ?? 0,
      Date.now(),
      willAllocationOf(session!.state.tags),
    )
    writeBloodline(entry)
    setScreen('creation')
  }

  /** 放弃这局 / 再活一次：不删存档 —— 进度仍在，首页可"继续游戏"接回 */
  const handleRestart = () => {
    setSession(null)
    clearTransient()
    refreshHome()
    setScreen('home')
  }

  const handleContinue = () => {
    setImportError(null)
    const r = loadSessionFrom(getBrowserStorage(), ALL_EVENTS)
    if (!r.ok) {
      refreshHome()
      setImportError(`读取存档失败：${r.reason}`)
      return
    }
    clearTransient()
    setSession(r.session)
    setRestoreIssue(
      r.unknownEventId
        ? `存档里记录的事件（${r.unknownEventId}）在当前版本不存在，无法原样恢复；这一年可以跳过继续，年度结算照常进行。`
        : null,
    )
    setScreen('game')
  }

  const handleSkipYear = () => {
    setSession((s) => (s ? recoverMissingEvent(s, ALL_EVENTS) : s))
    setRestoreIssue(null)
  }

  const handleImportFile = async (file: File) => {
    setImportError(null)
    let text: string
    try {
      text = await file.text()
    } catch (e) {
      setImportError(`读取文件失败：${e instanceof Error ? e.message : String(e)}。现有存档未改动。`)
      return
    }
    const r = deserializeSave(text, ALL_EVENTS)
    if (!r.ok) {
      setImportError(`导入失败：${r.reason}。现有存档未改动。`)
      return
    }
    // 已有存档（含损坏档）→ 先经玩家确认再替换
    if (saveMeta || saveState === 'corrupt') {
      setPendingImport({ data: r.data, unknownEventId: r.unknownEventId })
      return
    }
    applyImport(r.data, r.unknownEventId)
  }

  const applyImport = (data: SaveData, unknownEventId: string | null) => {
    const { session: restored } = sessionFromSaveData(data, ALL_EVENTS)
    const r = saveSessionTo(restored, getBrowserStorage())
    setSaveError(
      r.ok
        ? null
        : `导入的进度已在本次游玩中生效，但写入浏览器存储失败：${r.error}。可点下方「导出存档」保留文件。`,
    )
    setRestoreIssue(
      unknownEventId
        ? `导入的存档里记录的事件（${unknownEventId}）在当前版本不存在；这一年可以跳过继续。`
        : null,
    )
    setPendingImport(null)
    setImportError(null)
    setSession(restored)
    setScreen('game')
    refreshHome()
  }

  const handleExportCurrent = () => {
    if (session) downloadSaveFile(session)
  }

  const handleExportRaw = () => {
    if (!downloadRawSave(getBrowserStorage())) {
      setImportError('没有可导出的存档文件。')
    }
  }

  let page
  if (screen === 'creation') {
    page = (
      <CreationPage
        onStart={readBloodline() ? handleStartBloodline : handleStart}
        onBack={handleRestart}
        mottoTriple={mottoTriple}
        bloodlineHint={
          readBloodline()
            ? `承继血脉：先辈「${readBloodline()!.ancestorName}」（第 ${readBloodline()!.generation} 代），开局注入遗产 ${readBloodline()!.inheritanceMoney.toLocaleString('zh-CN')} 元${mottoHint}`
            : undefined
        }
      />
    )
  } else if (screen === 'game' && session) {
    if (session.state.phase === 'ended') {
      page = (
        <EndingPage
          session={session}
          onRestart={handleRestart}
          onContinueBloodline={handleContinueBloodline}
        />
      )
    } else {
      page = (
        <GamePage
          session={session}
          onChoose={(i) => {
            playClick() // 第 38 轮：选择咔哒（呈现层，默认静音）
            setSession((s) => (s ? chooseOption(s, i) : s))
          }}
          onNext={() => {
            playPageFlip() // 第 38 轮：跨年轻翻页声（与 year-flip 转场同拍）
            setSession((s) => (s ? nextYear(s, ALL_EVENTS) : s))
          }}
          onAction={(id) => {
            playClick() // 第 84 轮：行动咔哒（与选择同款，默认静音）
            setSession((s) => {
              if (!s) return s
              const r = performAction(s.state, id)
              return r.ok ? { ...s, state: r.state } : s
            })
          }}
          onRestart={handleRestart}
          notice={restoreIssue}
          onSkipYear={handleSkipYear}
          saveError={saveError}
          onExport={handleExportCurrent}
        />
      )
    }
  } else {
    page = (
      <HomePage
        saveMeta={saveMeta}
        saveState={saveState}
        saveReason={saveReason}
        importError={importError}
        pendingImport={pendingImport?.data ?? null}
        onContinue={handleContinue}
        onStart={() => setScreen('creation')}
        onImportFile={handleImportFile}
        onConfirmImport={() => pendingImport && applyImport(pendingImport.data, pendingImport.unknownEventId)}
        onCancelImport={() => setPendingImport(null)}
        onExportRaw={handleExportRaw}
      />
    )
  }

  return <div className="app">{page}</div>
}
