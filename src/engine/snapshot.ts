// 年度快照（第 21 轮）：从任意 GameState 取一个展示用的人生切面。
// 纯函数、不消耗 RNG、不影响任何规则结算；init（开局切面）与 lifecycle（年度切面）共用。
import type { GameState, YearlySnapshot } from './types'

/** 快照只读这四个字段，开局状态（尚无 snapshots 数组）也可取切面 */
export type SnapshotSource = Pick<GameState, 'age' | 'money' | 'attrs' | 'career'>

export function takeSnapshot(state: SnapshotSource): YearlySnapshot {
  return {
    age: state.age,
    money: state.money,
    attrs: { ...state.attrs },
    career:
      state.career.kind === 'employed'
        ? { kind: 'employed', level: state.career.level }
        : { kind: state.career.kind },
  }
}
