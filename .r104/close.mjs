// 第 104 轮关账：推进 WORK_STATE.json 到第 105 轮（单次写、五字段一致）
import fs from 'node:fs'

const V = `第 104 轮「千局 V5 平衡终校（V5 唯一数值轮，机制值解冻）」关账（2026-10-04）：
【边界档闸门】进入本轮前跑 check_all.mjs = 15/15 PASS、总时长 3m15s（build/contrast/css_diff/save_robustness/motion/transition/curve/radar/report/viewport/keyboard/fileui/mobile/npm test/tsc 逐项 PASS）。
【本轮最有价值的产出=两处量测 bug】观察清单报的零值里有两项是判据错而非内容缺口：
①投保率判据 history.some(h=>h.title.includes('投保'))，但 history.title 存的是「事件标题」而非选项文本（engine/events.ts:546），两个保险事件标题为「社保之外，再添一份」「人到中年，保障该补齐了」均不含「投保」二字 → 恒假零；订正为 state.insurance!==undefined 后实测 7.3%。
②走红率判据 t.startsWith('fame_') 匹配不到 minor_fame（不以 fame_ 开头），而 minor_fame 正是 fame.ts 的入场标记 → 订正为 fame 标记全集 {minor_fame,fame_start,fame_update,fame_viral,fame_cash,fame_hate} 后实测 0.8%（9 局）。
教训：报 0% 时先分清「机制到不了」与「量测看不见」，混为一谈会把量测 bug 写成内容缺口、误导后续所有轮次。
【A1/A2】1060 局：卡死 0 / NaN 0 / 单选违规 无 / once 违规 无 / 事件抽取 60,232 次保底 0.0% / 终龄 51-77 均值 74.8 / 结局 13 种。观察清单 13 项=上岸 0.2%（偏离，全池仅 1 枚 civilExam 事件的内容缺口）/ 投保 7.3%（量测订正）/ 购房 13.7% / 定投 11.6% / 行动采纳 5.7% / 离婚 0.0%（真零）/ 留学 0.0%（真零）/ 走红 0.8%（量测订正后仍偏低）/ 传承资格局占比 59.3%（新增，口径=终局现金>0，依 bloodline.inheritanceOf 对 money<=0 返 0）/ 大病返贫率 13.8%（新增，seenEvents 含 hlt_chronic_onset 且终局负债，慢病局 374=35.3%）/ 贫富差距 45.2 倍（偏离，但为混合池口径伪影，R103 已查明 V3 三段 8.8/13.3/7.5 全在带内）/ 终龄 67/77/77（相对 R103 零漂移）/ 幸福 0/37/80 均值 36.9（新增）。
【A3 稀有度终校=否决朴素阈值法】按解锁率直接分档会改 46/59 枚、legendary 从 1 推到 27（一半成就是传奇、标签失去意义）；根因=机器人策略不做目标导向经营、千局口径对罕见成就系统性低估（R100 已实证）。改用有方向性的两端错标规则，共改 16 枚：降档 5 枚（实测>=25% 却标稀档：debt_free 67.9 / iron_body 44.2 / memoir 41.7 / pet_forever 27.8 由 rare→common，clean_living 25.7 由 epic→common）；升 common 2 枚（senior_level 2.9 / independent 1.9 → rare）；零触发 9 枚跨代深链升 legendary（机器不可达≠人类不可达，check 均为纯状态判定、引擎侧无不可达缺陷；其中 ach_old_friend 人类可达性亦存疑，已显式登记为观察项）；其余 43 枚不动。新分布 common 12 / rare 26 / epic 11 / legendary 10（原 9/33/16/1）。执行器 .r104/apply_rarity.ts 三重保险：改写前全量预检（16 条 id 锚点各须命中一次且旧值断言一致，任一不符 exit 1 不写盘）+ 改写后逐条复验目标值 + rarity 条目总数=59 校验。唯一硬约束是 round72.test.ts:97 的四档枚举断言，无逐枚硬编码。
【A4 结局全现 13/16，缺 3 项逐项归因未静默】death_young（终局判定只在终局发生，而千局终局 age<40 的局数为 0；health<=0 的 239 局全在 40 岁后 → 结构性不可达）/ pillar（四项合取，cared_for_parents 511 局、money>=0 629 局、happiness>=40 469 局都充足，但 has_child 仅 21 局=2.0% 把候选压到 12 局、再经财务与幸福筛到 1 局）/ renowned（fame 9 局的成就数 min/中位/max=6/7/12 全>=4，∧money>=0 只剩 2 局，这 2 局最终被更高优先级的 debt_shadow 抢先匹配）。
【⑤ norms.ts 重生成】npx tsx scripts/norms_export.ts 1080；策略池同步升级 9→12（并入 V3 的 career_civil/investor/action_balanced，与 R103 基线同口径；action_balanced 内联同款固定轮换，避免策略名含 action 却无行动轮）。money p50 由 -2,146 转正为 6,430；happinessAvg p50 50→52；achievements 分位完全不变。纯展示数据，不参与引擎结算。
【实测】tsc --noEmit 零输出退出码 0；vitest run 1145/1145 全绿 70 文件与 R103 零漂移；改动面 round72+achievements 51/51；npm run build 通过、dist/index.html 自包含 491.3 kB 0 外链；G5 round101_compare18 V1 基线池 18/18 位移=0、退出码 0（自洽性 0/18）；断言一处未放宽；SPEC 6.70 物理追加于 6 末尾未改既有节号。
【遗留】(1) ach_old_friend 可达性存疑（55 岁 ∧ friend 亲密 85，而普通友年衰减 -2），待 R105 构造测试裁决，必要时降级或改判定；(2) death_young 需引擎层「事件直接致死」能力（机制改动，超出数值轮范围）；(3) pillar 受制全局有娃率 2.0%、renowned 受制 fame 前置仅 9 局，均不静默不放宽；(4) 上岸率 0.2% 仍是内容缺口（全池仅 1 枚 civilExam 事件），本轮未动内容；(5) 离婚/留学两项真零属内容缺口，R105 只修不扩，归 V6 数据轮；(6) check_all.mjs 的 usable 判据（code!==null && out.trim()!==''）把空输出当失败，而 tsc --noEmit 成功时恰好零输出 → 每次必跑满 3 次（本次闸门 tsc 15s 标「重试2次」），判定本身没错只是白烧时间，归 R105 改 check_all 时一并修；(7) R103 遗留未消解（civ_line 死分支未修、late_kid_faraway 仍 0 触发、26-35 与 36-45 桶专属 1/0 未补）。
【下一轮】105《V5 全量体检（只修不扩）》，边界档，进入前须再跑一次全闸门。前置盘点：本轮遗留 6 条（ach_old_friend 可达性裁决最优先）、check_all.mjs 清单 15 项扩至 17+、save_robustness_verify 补 home/city/insurance/fund 四字段两象限 + bloodline 键独立存在性、±2 结论复核抽测、R80 遗留 2 条闭环状态。SPEC 现最大 6.70，下轮追加 6.71（物理追加防乱序）。`

const s = JSON.parse(fs.readFileSync('WORK_STATE.json', 'utf8'))
s.current_round = 105
s.round_status = 'not_started'
s.last_completed_round = 104
s.attempts_on_current_round = 0
s.last_verification = V
fs.writeFileSync('WORK_STATE.json', JSON.stringify(s, null, 2) + '\n')
console.log('WORK_STATE OK:', s.current_round, s.round_status, s.last_completed_round, s.attempts_on_current_round)
console.log('last_verification 长度:', V.length)