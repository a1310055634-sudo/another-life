import { useMemo, useState } from 'react'
import { BACKGROUNDS } from '../data/backgrounds'
import { TRAITS } from '../data/traits'
import { previewStart } from '../engine/init'
import { EDU_LABELS, SKILL_LABELS } from '../engine/education'
import { ATTR_KEYS, ATTR_LABELS } from '../engine/attrs'
import { FortuneDraw } from '../components/FortuneDraw'
import type { MottoDef } from '../engine/bloodline'
import type { AttrKey } from '../engine/types'

interface Props {
  onStart: (name: string, backgroundId: string, traitId: string, mottoId?: string) => void
  /** 第 94 轮：承继血脉横幅（先辈 bloodline 键在册时展示代数提示） */
  bloodlineHint?: string
  /** 第 122 轮：家训三选一（承继局限定；祖先条目 finishedAt 派生，同键恒同三张） */
  mottoTriple?: MottoDef[]
  onBack: () => void
}

const TAG_LABELS: Record<string, string> = {
  bg_ordinary: '普通出身',
  bg_wealthy: '家境优渥',
  bg_rural: '农家出身',
  bg_single_parent: '单亲家庭',
  has_connections: '家人脉',
  hardworking: '能吃苦',
  empathetic: '共情力',
  money_anxiety: '金钱焦虑',
  bookworm: '爱读书',
  social_butterfly: '人脉广',
  ambitious: '事业心',
  laid_back: '心态好',
  frugal_minded: '会省钱',
  risk_taker: '敢冒险',
}

export default function CreationPage({ onStart, onBack, bloodlineHint, mottoTriple }: Props) {
  const [name, setName] = useState('')
  const [bgId, setBgId] = useState(BACKGROUNDS[0].id)
  const [traitId, setTraitId] = useState(TRAITS[0].id)
  // 第 122 轮：家训三选一（承继局限定；未选=无家训=旧行为）
  const [mottoId, setMottoId] = useState<string | undefined>(undefined)

  const preview = useMemo(() => previewStart(bgId, traitId), [bgId, traitId])

  const start = (): void => onStart(name, bgId, traitId, mottoId)

  return (
    <div className="creation">
      {bloodlineHint && (
        <p className="banner warn-card" role="status">🩸 {bloodlineHint}</p>
      )}
      {mottoTriple && mottoTriple.length > 0 && (
        <section className="motto-pick" aria-label="家训三选一">
          <h3 className="motto-head">祖上留下的家训，挑一条带上路</h3>
          <div className="motto-opts">
            {mottoTriple.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`motto-btn${mottoId === m.id ? ' on' : ''}`}
                aria-pressed={mottoId === m.id}
                onClick={() => setMottoId(mottoId === m.id ? undefined : m.id)}
              >
                「{m.text}」
              </button>
            ))}
          </div>
          <p className="motto-hint">家训是开局的一点点底气，也是这户人家的规矩。</p>
        </section>
      )}
      <h1 className="page-title">你的人生，从 18 岁开始</h1>

      <label className="field-label" htmlFor="name-input">
        你的名字（留空则随机取名）
      </label>
      <input
        id="name-input"
        className="name-input"
        value={name}
        maxLength={12}
        placeholder="比如：林知远"
        onChange={(e) => setName(e.target.value)}
      />

      <h2 className="section-title">家庭背景</h2>
      <div className="opt-grid">
        {BACKGROUNDS.map((bg) => (
          <button
            key={bg.id}
            type="button"
            aria-pressed={bgId === bg.id}
            className={bgId === bg.id ? 'opt-card selected' : 'opt-card'}
            onClick={() => setBgId(bg.id)}
          >
            <span className="opt-name">{bg.name}</span>
            <span className="opt-desc">{bg.desc}</span>
            <span className="opt-pros">▲ {bg.pros}</span>
            <span className="opt-cons">▼ {bg.cons}</span>
            <span className="opt-influence">→ {bg.influence}</span>
          </button>
        ))}
      </div>

      <h2 className="section-title">天赋特质</h2>
      <div className="opt-grid">
        {TRAITS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={traitId === t.id}
            className={traitId === t.id ? 'opt-card selected' : 'opt-card'}
            onClick={() => setTraitId(t.id)}
          >
            <span className="opt-name">{t.name}</span>
            <span className="opt-desc">{t.desc}</span>
            <span className="opt-pros">▲ {t.pros}</span>
            <span className="opt-cons">▼ {t.cons}</span>
            <span className="opt-influence">→ {t.influence}</span>
          </button>
        ))}
      </div>

      {/* 第 107 轮：抽签仪式与自选**并列**（不清除自选、不改默认流程）。
          抽中后只回填上面两个 state，开局仍走 onStart(name, bgId, traitId)，
          引擎侧零改动——「抽签 = 自选」的机制等价由 previewStart 天然保证。 */}
      <FortuneDraw
        current={{ bgId, traitId }}
        onPick={(b, t) => {
          setBgId(b)
          setTraitId(t)
        }}
      />

      <h2 className="section-title">开局预览</h2>
      <div className="preview-card" aria-live="polite">
        <div className="preview-row preview-money">
          <span>起始资金</span>
          <strong>¥{preview.money.toLocaleString('zh-CN')}</strong>
        </div>
        <div className="preview-row">
          <span>家庭</span>
          <span>{preview.parents}</span>
        </div>
        <div className="preview-row">
          <span>学历 · 技能</span>
          <span>
            {EDU_LABELS[preview.education]} · {SKILL_LABELS.academics} {preview.skills.academics} /{' '}
            {SKILL_LABELS.vocational} {preview.skills.vocational}
          </span>
        </div>
        <div className="preview-attrs">
          {ATTR_KEYS.map((k: AttrKey) => (
            <div key={k} className="preview-attr">
              <span className="preview-attr-label">{ATTR_LABELS[k]}</span>
              <div className="preview-bar" role="presentation">
                <div className="preview-bar-fill" style={{ width: `${preview.attrs[k]}%` }} />
              </div>
              <span className="preview-attr-num">{preview.attrs[k]}</span>
            </div>
          ))}
        </div>
        <div className="preview-tags">
          {preview.tags.map((t) => (
            <span key={t} className="preview-tag">
              {TAG_LABELS[t] ?? t}
            </span>
          ))}
        </div>
      </div>

      <div className="creation-actions">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={start}
        >
          18 岁，出发
        </button>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          返回首页
        </button>
      </div>
    </div>
  )
}
