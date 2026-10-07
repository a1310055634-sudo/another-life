import { useRef, useState } from 'react'
import type { SaveData, SaveMeta } from '../save/storage'
import { ACHIEVEMENTS } from '../engine/achievements'
import { getVolume, setVolume, hasExplicitPreference, type SoundVolume } from '../sound'
import {
  getAmbientEnabled,
  setAmbientEnabled,
  startAmbient,
  stopAmbient,
  refreshAmbientVolume,
} from '../ambient'
import { readLegacy, clearLegacy, collectedAchievementIds, type LegacyEntry } from '../legacy'
import { fmtMoney } from '../components/AttrBar'

type SaveState = 'none' | 'ok' | 'corrupt' | 'unavailable'

interface Props {
  saveMeta: SaveMeta | null
  saveState: SaveState
  /** 损坏/存储不可用时的原因说明 */
  saveReason: string
  importError: string | null
  /** 待确认的导入存档（非空时显示替换确认面板） */
  pendingImport: SaveData | null
  onContinue: () => void
  onStart: () => void
  onImportFile: (file: File) => void
  onConfirmImport: () => void
  onCancelImport: () => void
  /** 导出存储中的原始存档（损坏档救援） */
  onExportRaw: () => void
}

function fmtTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function HomePage({
  saveMeta,
  saveState,
  saveReason,
  importError,
  pendingImport,
  onContinue,
  onStart,
  onImportFile,
  onConfirmImport,
  onCancelImport,
  onExportRaw,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  // 有存档时"开始新人生"先就地确认覆盖，不弹原生对话框
  const [confirmNew, setConfirmNew] = useState(false)
  // 第 38 轮：音效开关（默认关；偏好存 localStorage，独立于存档数据）
  // 第 52 轮：三态音量（关/低/高）+ reduced-motion 说明行（未显式设置且系统偏好减弱动态时显示）
  const [volume, setVolumeState] = useState<SoundVolume>(getVolume)
  const [rmNote] = useState(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches && !hasExplicitPreference()
    } catch {
      return false
    }
  })
  // 第 53 轮：往生录（挂载读一次；本页操作后本地同步，不订阅外部变化）
  const [legacy, setLegacy] = useState<LegacyEntry[]>(readLegacy)
  // 第 76 轮：环境音开关（默认关；独立键 another-life:ambient，与音效三态解耦）
  const [ambientOn, setAmbientOn] = useState(getAmbientEnabled)
  // 第 73 轮：展开式回顾——受控单开（null=全收起），碑头按钮 Enter/Space 原生触发
  const [openLegacy, setOpenLegacy] = useState<number | null>(null)
  const [collectedCount, setCollectedCount] = useState(() => collectedAchievementIds().length)
  const [confirmClear, setConfirmClear] = useState(false)
  const hasExisting = saveState === 'ok' || saveState === 'corrupt'
  // 第 19 轮首页成就入口（SPEC §5）：成就属于当前这一局，从存档读取已解锁名单
  const unlocked = saveMeta?.achievements ?? []

  const handleNewClick = () => {
    if (hasExisting) setConfirmNew(true)
    else onStart()
  }

  return (
    <div className="home">
      <h1 className="home-title">另一种人生</h1>
      <p className="home-sub">
        从 18 岁开始，每年做一次选择。学业、事业、金钱、爱与健康，<br />
        所有决定都会写进你的人生。
      </p>

      {saveState === 'ok' && saveMeta && (
        <div className="save-chip" aria-label="存档状态">
          上次玩到：{saveMeta.name} · {saveMeta.age} 岁{saveMeta.savedAt ? ` · ${fmtTime(saveMeta.savedAt)}` : ''}
        </div>
      )}
      {saveState === 'corrupt' && (
        <div className="banner warn-card" role="alert">
          <p>⚠️ 检测到存档已损坏：{saveReason || '内容无法读取'}。原文件已保留，可先导出排查。</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onExportRaw}>
            导出原存档文件
          </button>
        </div>
      )}
      {saveState === 'unavailable' && (
        <div className="banner warn-card" role="alert">
          <p>⚠️ {saveReason || '浏览器存储不可用'}。本次游玩可正常进行，但进度无法自动保存，可随时导出存档文件备份。</p>
        </div>
      )}

      {pendingImport && (
        <div className="banner warn-card" role="alert">
          <p>
            要导入的存档：{pendingImport.state.name} · {pendingImport.state.age} 岁。
            {hasExisting ? '导入将替换现有存档，' : ''}确认导入吗？
          </p>
          <div className="banner-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={onConfirmImport}>
              确认导入
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelImport}>
              取消
            </button>
          </div>
        </div>
      )}

      {importError && (
        <div className="banner warn-card" role="alert">
          <p>⚠️ {importError}</p>
        </div>
      )}

      {saveState === 'ok' && (
        <button type="button" className="btn btn-primary btn-lg" onClick={onContinue}>
          继续游戏
        </button>
      )}
      {!confirmNew ? (
        <button type="button" className="btn btn-ghost btn-lg" onClick={handleNewClick}>
          开始新人生
        </button>
      ) : (
        <div className="banner warn-card" role="alert">
          <p>
            {saveState === 'corrupt'
              ? `现有存档已损坏${saveReason ? `（${saveReason}）` : ''}，开始新人生将替换它。可以先导出保留，或确认替换。`
              : `开始新的人生会覆盖现有存档（${saveMeta?.name} · ${saveMeta?.age} 岁）。确定要重新开始吗？`}
          </p>
          <div className="banner-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { setConfirmNew(false); onStart() }}>
              {saveState === 'corrupt' ? '替换并开始新人生' : '覆盖存档，开始新人生'}
            </button>
            {saveState === 'corrupt' && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onExportRaw}>
                先导出原存档
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmNew(false)}>
              取消
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onImportFile(f)
          e.target.value = ''
        }}
      />
      <div className="home-secondary">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
          导入存档文件
        </button>
        {saveState === 'ok' && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onExportRaw}>
            导出存档文件
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-pressed={volume !== 'off'}
          aria-label={`氛围音效${volume === 'off' ? '已关闭（默认）' : `已设为${volume === 'low' ? '低' : '高'}`}`}
          onClick={() => {
            // 第 52 轮：三态循环 关→低→高→关
            const next: SoundVolume = volume === 'off' ? 'low' : volume === 'low' ? 'high' : 'off'
            setVolume(next)
            setVolumeState(next)
            refreshAmbientVolume() // 第 76 轮：环境音增益跟随三态
          }}
        >
          音效：{volume === 'off' ? '关' : volume === 'low' ? '低' : '高'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-pressed={ambientOn}
          aria-label={`人生阶段环境音${ambientOn ? '已开启' : '已关闭（默认）'}`}
          onClick={() => {
            // 第 76 轮：环境音独立开关（默认关；开启即手势，AudioContext resume 合法）
            const next = !ambientOn
            setAmbientEnabled(next)
            setAmbientOn(next)
            if (next) startAmbient()
            else stopAmbient()
          }}
        >
          环境音：{ambientOn ? '开' : '关'}
        </button>
      </div>
      {rmNote && (
        <p className="home-sub" aria-live="polite">
          已按系统「减弱动态效果」偏好保持音效关闭；点击上面的开关可自行开启。
        </p>
      )}

      <details className="card home-ach">
        <summary>
          成就（已解锁 {unlocked.length} / {ACHIEVEMENTS.length}）
        </summary>
        <p className="home-ach-hint">
          {saveState === 'ok'
            ? `读取自当前存档（${saveMeta?.name ?? ''} 的这一局）。`
            : '还没有进行中的存档——开始新的一局后，成就会在游玩过程中解锁。'}
        </p>
        <ul className="ach-list">
          {ACHIEVEMENTS.map((a) => {
            const got = unlocked.includes(a.id)
            // 第 31 轮：隐藏成就未解锁时遮罩名称与条件（数据在引擎侧，呈现层只负责不剧透）
            const masked = !got && a.hidden === true
            return (
              <li key={a.id} className={got ? 'ach-got' : 'ach-locked'}>
                <b>{got ? '🏅' : '🔒'} {masked ? '？？？' : a.name}</b>
                <span>{masked ? '隐藏成就——玩到揭晓的那一天' : a.desc}</span>
              </li>
            )
          })}
        </ul>
      </details>

      {/* 第 53 轮：往生录——多周目博物馆（独立 localStorage 键，不碰存档数据） */}
      <details className="card home-ach">
        <summary>往生录（走过 {legacy.length} 段人生 · 成就收集 {collectedCount} / {ACHIEVEMENTS.length}）</summary>
        <p className="home-ach-hint">
          {legacy.length === 0
            ? '还没有走完过一局。每一段走到终点的人生，都会在这里留下一块碑。'
            : '每一段认真走完的人生，都值得一块碑。'}
        </p>
        {legacy.length > 0 && (
          <>
            <ul className="legacy-list">
              {[...legacy].reverse().map((e, i) => {
                const open = openLegacy === i
                const achNames = (e.achievements ?? [])
                  .map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name)
                  .filter(Boolean)
                return (
                <li key={`${e.seed}-${e.finishedAt}-${i}`} className="legacy-entry">
                  <button
                    type="button"
                    className="legacy-toggle"
                    aria-expanded={open}
                    onClick={() => setOpenLegacy(open ? null : i)}
                  >
                    <b>
                      <span className={`legacy-grade legacy-grade-${e.grade}`}>{e.grade}</span>{' '}
                      {e.generation && e.generation >= 2 ? `【第 ${e.generation} 代】` : ''}
                      {e.name} · {e.endingName} · {e.age} 岁
                    </b>
                  </button>
                  <span className="legacy-epitaph">{e.epitaph}</span>
                  <span className="legacy-meta">
                    峰值 {fmtMoney(e.peakMoney)} · 成就 {e.achievements.length} 枚 ·{' '}
                    {new Date(e.finishedAt).toLocaleString('zh-CN')}
                  </span>
                  <div className={`legacy-more${open ? ' open' : ''}`}>
                    <div className="legacy-more-inner">
                      {Array.isArray(e.keyChoices) && e.keyChoices.length > 0 ? (
                        <ul className="legacy-choices">
                          {e.keyChoices.map((c, j) => (
                            <li key={j}>{c}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="home-ach-hint">这段人生没有留下更多抉择记录。</p>
                      )}
                      {e.peakAge !== undefined && (
                        <span className="legacy-meta">资产峰值出现在 {e.peakAge} 岁</span>
                      )}
                      {achNames.length > 0 && (
                        <span className="legacy-meta">携 {achNames.length} 枚成就离开：{achNames.join('、')}</span>
                      )}
                    </div>
                  </div>
                </li>
                )
              })}
            </ul>
            {confirmClear ? (
              <p className="home-ach-hint">
                确定清空全部 {legacy.length} 段人生记录吗？
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    clearLegacy()
                    setLegacy([])
                    setCollectedCount(0)
                    setConfirmClear(false)
                  }}
                >
                  确认清空
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmClear(false)}>
                  再想想
                </button>
              </p>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmClear(true)}>
                清空往生录
              </button>
            )}
          </>
        )}
      </details>

      <p className="home-hint">一局约 15～25 分钟 · 全程离线运行 · 进度自动保存在本机浏览器</p>
    </div>
  )
}
