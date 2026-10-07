// 第 96 轮（V5）生成物：同龄人对照分位表（千局模拟 1080 局）。
// 复跑命令：npx tsx scripts/norms_export.ts 1080
// 生成日期：2026-10-03；策略池：9 策略轮换（与 round39 --pool=new 同源）。
// 纯展示数据：仅供 EndingPage「同龄人对照」卡读取，不参与任何引擎结算。
export interface NormDimension { p10: number; p25: number; p50: number; p75: number; p90: number }
export interface Norms { sampleCount: number; generatedAt: string; money: NormDimension; age: NormDimension; achievements: NormDimension; happinessAvg: NormDimension }

export const NORMS: Norms = {
  "sampleCount": 1080,
  "generatedAt": "2026-10-03",
  "money": {
    "p10": -883822,
    "p25": -496796,
    "p50": -2146,
    "p75": 89713,
    "p90": 402330
  },
  "age": {
    "p10": 72,
    "p25": 77,
    "p50": 77,
    "p75": 77,
    "p90": 77
  },
  "achievements": {
    "p10": 5,
    "p25": 6,
    "p50": 8,
    "p75": 9,
    "p90": 10
  },
  "happinessAvg": {
    "p10": 31,
    "p25": 39,
    "p50": 50,
    "p75": 60,
    "p90": 72
  }
}
