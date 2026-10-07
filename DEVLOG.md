# 《另一种人生》开发日志（DEVLOG）— 接手 agent 入口

> 本文件是技术交接入口。写于 2026-09-28 项目整体交付之后，供接手的 agent 快速建立准确心智模型。
> 历史过程看 PROGRESS.md（逐轮执行记录，含每次触发的完整时间线），游戏规则与验收标准看 SPEC.md，玩家向说明看 README.md。

## 0. 项目现状与首要纪律

- **20 轮全部完成，项目已整体交付**。WORK_STATE.json = `current_round: 20 / round_status: completed / last_completed_round: 20`，此为终态。
- **定时任务若再触发**：任务书快照常携带过时状态（如"15 轮完成、16 轮 in_progress"），一律以文件现读为准。核实 WORK_STATE 仍为 20/completed 后**只报告完成状态、零写入、不重跑 build**（build 会覆写已逐字节核验的 dist）。此模式已被多次再触发验证。
- **用户主动要求的新开发**不经过轮次系统，正常改码即可，但仍然：每轮改动跑三件套、在 PROGRESS.md 追加带日期的执行记录、不动已完成的轮次状态。
- **本目录不是 git 仓库**（`git status` exit 128 属预期），规则禁止提交/推送。
- 分层纪律（SPEC 约束，违反会被 review 打回）：**规则逻辑全在 `src/engine/` 纯函数；事件文本与选项在 `src/data/events/`；React 组件只负责显示**。复杂游戏规则不许塞进页面组件。

## 1. 文档地图

| 文件 | 作用 |
|---|---|
| SPEC.md | 游戏规格与验收标准（§7 最终验收已全部勾选附证据）；终局年龄等规则以此为准 |
| PROGRESS.md | 逐轮执行记录（含并发协作时间线、每次验证的真实结果）；改码后在此追加记录 |
| WORK_STATE.json | 20 轮状态机（current_round/round_status/last_completed_round/attempts_on_current_round/last_verification 五字段须彼此一致） |
| README.md | 玩家向：快速开始、离线版、存档说明、验收脚本清单 |
| DEVLOG.md | 本文件：架构、不变量、坑、续作指南 |

## 2. 技术架构

**栈**：React 18 + TypeScript（lib ES2020，**无 replaceAll/.at()**，用正则和 `[length-1]`）+ Vite + Vitest。纯前端无服务器，不联网。

```
src/
  engine/    全部纯函数规则：
    types.ts        GameState/GameEvent/Effect/EventCondition/Relation/PendingEffect 等全部类型
    rng.ts          mulberry32，rngState 存于 GameState → 存档可复现
    init.ts         createNewGame/previewStart（同一套收敛计算）
    validate.ts     validateState（非法状态检测）
    lifecycle.ts    advanceYear 年度结算（编号步骤见 §4）
    events.ts       drawEvent 加权抽取 / isEventAvailable / visibleChoices /
                    conditionFailReason / choiceGateReason（门槛中文说明，逐条镜像判定）
    session.ts      回合状态机 startSession/chooseOption/nextYear/recoverMissingEvent/
                    traitWeightFor（特质类别权重）
    education.ts    五学制（复读1/大专3/本科4/硕士2/博士4）、高考分档、skills 双通道
    career.ts       求职/晋升/年度考核；RETIRE_AGE=65、退休金 0.4 倍（提前退休 0.32），
                    保底 12000 封顶 60000；⚠️ jobStressPerYear 定义在 data/careers.ts
    finance.ts      开支分层/阶梯利息(10万起2%封顶30000)/负债利息5%封顶20000/
                    四档财务压力/BIG_SPEND_THRESHOLD=3000/CHILD_EXPENSE=10000
    relations.ts    六种关系效果(add/remove/deltaCloseness/convertFrom/revive)、
                    疏远结算、relationDeltaChips
    health.ts       LIFESTYLE_HEALTH_DRIFT 五标记年度漂移、HEALTH_SINGLE_HIT_LIMIT=6、
                    低健康三档预警
    outcomes.ts     ★ DEFAULT_MAX_AGE=77 唯一来源；ENDINGS 13 结局优先级表（数组顺序即优先级）、
                    judgeEnding、buildEndingSummary
    achievements.ts 31 成就（check 只读 + unlock 落账写 key 履历 eventId='ach'）
    validateEvents.ts 事件池坏数据静态校验
  data/      backgrounds(10) / traits(6) / careers(JOB_CATALOG 9 岗位) /
             events/(basic/youth/education/career/finance/relationship/midlife/late/health，
             index.ts 合并为 ALL_EVENTS，全池 122 个)
  save/      storage.ts 存档信封纯函数（五级校验+SAVE_MIGRATIONS 迁移链+注入式 SaveStorage）/
             browser.ts（localStorage 适配 + Blob 导出）
  pages/     HomePage / CreationPage / GamePage / EndingPage
  components/EventCard / AttrBar
scripts/     验收与诊断工具（见 §6）
```

**页面流**：HomePage（继续/新人生/成就面板/导入导出）→ CreationPage（背景×特质+开局预览）→ GamePage（顶栏属性/事件卡/结算面板/履历）→ EndingPage（评级徽章/维度标签/这一生/人生转折/时间线）。

## 3. 核心机制速览

- 18 岁起步，每年一回合：抽事件 → 选择 → 结算 → 年度结算 → 下一年。终局 77 岁（DEFAULT_MAX_AGE，唯一来源 outcomes.ts），健康归零提前死亡。一局 15~25 分钟。
- **RNG 可复现**：mulberry32，rngState 在 GameState 内；抽事件消耗的随机数即时写回；工资 ±8% 波动用同一 RNG；零工收入不参与波动（保证精确对账）。同 seed + 同选择序列 = 完全同一局。
- **checkLifeEnd 与结局解耦**：引擎只写三值结束方式 ID 进 `state.endingId`（自然走完/积劳成疾/英年早逝），具体 13 结局由 EndingPage 用 judgeEnding 现算。ENDINGS 优先级：death_young/death_ill 硬条件置顶 → S 热爱成真·薪火不熄 → A 家和事兴·一个人的丰盈·东山再起·财务自由·顶梁柱 → C 劳碌半生 → D 债影随行 → B 平凡之路 → gray_dusk 恒真兜底。
- **结局总结防泄漏**：buildEndingSummary 的引号内容只取 key 履历原文、relations 真名、已解锁成就名；测试锁定「引号内容 ⊆ 履历标题∪成就名∪出身特质名」，不得引用未发生事件。
- **存档**：localStorage 键 `another-life:save`，单槽。信封 `SaveData{saveVersion:1, savedAt, state, currentEventId, awaitingAdvance, lastSummary, lastDeltas}`。自动保存时点：创建/每次选择结算/每次进年。ended 清档（结局是终点）；放弃不删档可接回。损坏/高版本/字段非法 → 拒读且**绝不写回**（原档保留可导出）；未知事件 ID → 横幅 + 玩家显式「跳过这一年」（recoverMissingEvent），不静默重抽。
- **延迟效果**：`years` 作者侧写年，引擎换算 dueAge；支持 education/addSkills/relation/repeat（周期性，如理疗年卡）。当年授予的标记**次年才计漂移**（drift 读年初 tags 快照）。

## 4. 年度结算顺序（lifecycle.ts，编号注释在源码里）

`1) 到期延迟效果（含延迟学历/技能/关系/周期）→ 2) 学生进度（技能成长/学制推进/毕业/高考——RNG 只在放榜一刻消耗）→ 2.5) 在职年度结算（工龄/涨薪/考核晋升/65 自动退休）→ 工资 ±8% 波动 → 租金/失业救济 → 开支（学生学制特例/年龄分层/生活方式标记/孩子 10000/年）→ 利息（按年初余额）→ 压力漂移 → 疏远结算（亲密度≤0 自动 estranged，确定性不耗 RNG）→ 生活方式健康漂移 → 低健康预警 → 成就判定 → 终局检查`。

**顺序是测试锁定的**：既有大量"精确到元"的对账测试（利息按年初余额、漂移按年初快照），乱动顺序会成片破坏固定 seed 复现。

## 5. 关键不变量（都有测试锁定，改码前先读）

1. **applyChoice 选项索引 = 原始 choices 下标**（不是可见列表下标）；越界/隐藏时兜底第一个可见项。UI 传原始索引；隐藏选项不可被结算。
2. **普通事件须 ≥2 个有效选项才可进入事件卡**（isEventAvailable）；`singleChoiceOk` 强制剧情白名单**全池恰 1 项：`hlt_body_intensive`**（低健康强制干预，数据侧有理由注释）。
3. **seenEvents 语义 = 「经历过」**：仅 applyChoice 写入，抽中不写；跨"跳过这一年"恢复后 once 事件再抽中不算剧情矛盾。
4. **负债门槛**：money<0 时即时支出 ≥3000 的选项引擎级自动隐藏；教育/技能投资豁免（复读/自考/培训班负债仍可见——低学历上进路不能被堵死）。
5. 属性 clamp(0,100)；金钱可负但 sanitizeMoney 限 ±2 万亿，杜绝 NaN 传播。
6. 单步即时健康伤害 ≤6（HEALTH_SINGLE_HIT_LIMIT=6），validateEvents 强制。
7. promote 效果的选项必须带 `requires.promotionAvailable`（校验器强制——jobLevels 表达不了各岗位 maxLevel 差异）。
8. 门槛说明（conditionFailReason/choiceGateReason）逐条镜像判定逻辑，**两组合镜一致性有全池×多状态测试**——改 checkCondition 必须同步改镜像；前端不暴露 tag ID/权重倍率（有 GATE_TAG_LABELS 中文映射）。
9. ended 后一切操作 no-op（结束后不能抽事件/续推/重复触发结局）；phase!=='playing' 时 advanceYear 原样返回。
10. 存档恢复的信封语义校验：playing + awaitingAdvance=false + currentEventId=null 是非法组合（引擎不可能产生，恢复即软死局），deserializeSave 拒绝。

## 6. 验证工作流

**每次改动后的三件套（不可引用旧结果）**：

```bash
npm test              # 基线 485/485（19 个测试文件）
npx tsc --noEmit      # 必须干净
npm run build         # = vite build + scripts/inline-dist.mjs 内联；JS 298.52 kB
```

**专项脚本**（README 有同清单）：

```bash
npx tsx scripts/check-pool.ts             # 事件池结构校验（加事件后先跑）
npx tsx scripts/window_stats.ts           # 池年龄窗口分布（青年80/中年73/晚年45，窗口相交计数）
npx tsx scripts/final_acceptance_sim.ts   # 120 局固定 seed 批量模拟（结局分布/保底/单选/NaN/卡死）
npx tsx scripts/strategy_contrast.ts      # 四种机器人策略对照（证 death_ill 偏斜=策略后果非数值缺陷）
npx tsx scripts/probe_endings_round17.ts  # 结局/健康轨迹探针
node scripts/fileui_verify.mjs            # file:// 生产 dist 全流程实测（自起 headless Chrome，见脚本头注释）
node scripts/mobile_verify.mjs            # 375px 视口全程实测
node scripts/save_robustness_verify.mjs   # 损坏/高版本/未知事件存档实测
```

**离线交付的关键事实**：`npm run build` 产出的 `dist/index.html` 是**自包含单文件**（验收时 362,344 字节，JS/CSS 已内联），双击即玩。真因背景：Chrome 对 file:// 页面的外部 `type="module"` 脚本强制 CORS（`CorsDisabledScheme`），所以 `vite base:'./'` 不够、必须内联（inline-dist.mjs 已接入 build script，含 `</script` 转义与未内联中止守卫）。`dist/assets/` 目录是与内联版并存的 base:'./' 中间产物，**无害勿误判**。

## 7. 如何继续开发（按改动类型）

- **新增事件**：在 `data/events/` 对应年龄段文件加 GameEvent → `check-pool.ts` + 三件套 → **同步硬编码池计数断言**（`health.test.ts:220` 断言 `ALL_EVENTS` 长度 122；creation.test 有基础池计数）→ 为该事件写正反两向门控/效果测试（验证规则结果，不是文字存在）。
- **新增成就**：`achievements.ts` 加 AchievementDef（check 只读）。UI 总数走 `ACHIEVEMENTS.length` 动态计算，但需检查引用总数的相关测试断言。警惕富裕开局白拿（历史漏洞：ach_young_savings 曾被 18 岁富裕开局直接解锁，加 `!bg_wealthy` 修复）。
- **新增结局**：`outcomes.ts` ENDINGS 数组**尾部追加即最低优先级**，位置即优先级；必须配"可达状态 + 不满足关键条件的对照状态"两组测试；宽泛结局不得抢先吞特定结局（优先级表已有 4 组多命中断言）。结局不得要求本游戏没有产生途径的 tag。
- **改 GameState / 存档结构**：走查创建角色、年度结算、事件效果、关系、成就、现有测试、存档恢复全路径；涉及存档格式必须 bump saveVersion 并在 SAVE_MIGRATIONS 加迁移，旧档要能读。
- **改 UI**：组件只做显示；门槛解释用现成的 conditionFailReason/choiceGateReason；锁定选项用既有 🔒 禁用样式；保持米白暖色视觉与 420px 断点，别引入新界面系统。
- **回归测试风格**：Vitest，固定 seed + 精确对账（孪生对照法：跨状态比较按"单年增量"断言，累计差会被利息/漂移逐年污染）；行为级长线模拟用"按年轮换候选 cands[year%len]"策略（固定选第一个会把池尾事件饿死）。

## 8. 已知遗留（已定性，非遗漏）

1. **levelTitles**：晋升不更新逐级岗位头衔。JobDef 仅单一 title 字段，顶栏显示「职级 N」无信息丢失；补 9 岗位×4 级头衔属内容扩充，定性为显示打磨不修。要做的话：JobDef 加 titles 数组 + career.ts 晋升时切换 + employedLabel 接线。
2. **debt_shadow 机器人占比高**（120 局 58 个）：真人有还债/消费选项可主动规避，strategy_contrast.ts 已证明是策略后果非数值缺陷。
3. 长尾 UI 路径（成就页逐项交互等）仅单测覆盖，无浏览器自动化。
4. headless 无法字面"双击"，以 file:/// URL 等价验证（同一协议同一相对路径解析）。
5. 游戏性备注：求婚事件纯运气抽中（有人 20 岁抽中有人 28 岁才中，加权随机的预期行为）。

## 9. 环境坑清单（全部实测踩过，按主题分组）

**Windows / bash**
- 深夜 bash 中文输出会被 GBK 化——中文锚点 grep/sed 全失配。**中文内容编辑一律 Read+Edit 工具；批量中文校验写 .py/.mjs 落盘再跑**（python -c 内含反引号/多行中文同样会出事）。
- console 管道显示乱码 ≠ 文件损坏：用 node/python 以 utf-8 读入做内容断言判真伪。
- `find src -name "*.ts" -o -name "*.tsx" -newer F` 有优先级坑（-newer 只作用第二分支）：正确写法 `find src -type f \( -name "*.ts" -o -name "*.tsx" \) -newer F`。

**dev server**
- **陈旧 vite 进程是白屏/幽灵页首因**：模块图不认识新文件时整页白屏报 `XXX is not defined`，或不白屏但跑旧模块（新 UI 不出现即为铁证）。build/vitest 通过可佐证代码无问题——**先换新端口重启 dev server 再查代码**。
- 用前先探活（有的实例只监听 ::1，curl 127.0.0.1 会误报死，用 localhost 或 [::1]）；死则新起端口；**不杀其他端口的服务**；清理自起进程按 PID/taskkill 精确杀，勿宽杀 node.exe。

**浏览器自动化（IAB）**
- IAB **不支持 file: 导航**——file:// 验证必须自起 headless Chrome（`--remote-debugging-port`）+ Node 原生 WebSocket 直连 CDP（三个 .mjs 验收脚本即此模式，可复跑）。
- evaluate 有 3 秒内部上限；单次调用 ≤2 步；Playwright locator click 持续超时，**用 evaluate 内页面侧 element.click()（按 textContent.includes 找按钮）**；连续点击每步间隔让 React 提交。
- 后台/失焦标签页 setTimeout 被深度节流（220ms 步进实测慢 60 倍）：用 **MessageChannel 宏任务 await** 推进（不受节流也不受 React 18 异步提交影响），或置前台。
- evaluate 沙箱动态 import 报 importModule is not defined：绕过 `new Function('u','return import(u)')`。
- IAB file chooser 不支持上传：DataTransfer 注入 File + dispatchEvent('change')。
- 按钮文本匹配用 textContent.includes（textContent 无空格，`/^1 /` 这类正则永不匹配）。
- window 临时变量挺不过 reload：跨刷新用 sessionStorage。

**CDP（headless Chrome）**
- Runtime.evaluate returnByValue 对裸 DOM 元素报 `Object reference chain is too long`：waitFor 表达式必须包 `!!`。
- headless --window-size 宽度下限约 500px：375px 视口用 `Emulation.setDeviceMetricsOverride`。
- 查残留 Chrome 进程时，命令行关键词会匹配到查询进程自身的 bash/powershell 造成假象——**以端口无监听为准**。

**测试 / 引擎**
- 行为级长线模拟中对 currentEvent 的可见性断言必须加 `!session.awaitingAdvance` 守卫（结算阶段事件仍挂着，否则双重计数假报"单选项"）。
- 引擎断言 API 区分：`visibleChoices` 只管选项级 requires+isBigSpend；事件级 requires/年龄/once/冷却查 `isEventAvailable`。用错会误判"门控失效"。
- CSS 伪元素文本（::before/::after）出现在 ax 快照里但 TreeWalker/textContent 找不到：判真伪用 `getComputedStyle(el,'::before').content` + 检查元素文本是否为空（`.history-body i:empty` 守卫即此坑产物）。
- 跨状态金钱对照按单年增量断言（孪生对照法）。

**多实例并发（若恢复定时触发模式）**
- 唯一可靠的"对方已关账"信号 = PROGRESS/WORK_STATE 的关账写入；**mtime 沉默与进程扫描都不可靠**（对方可能在长测试/浏览器实测阶段，或用宿主内 evaluate 跑试玩无独立进程）。
- 树内改动 + WORK_STATE not_started 的不一致，最可能是对方正活跃而非死半成品；判活双证据：末次写入 <5 分钟 + 观察期内有新增写入，同时满足即撤退转只读。
- 复验方纪律：只读监控等对方关账 → 独立复验 → 只在 PROGRESS 增量补记录 + WORK_STATE.last_verification，**绝不动轮次字段**；共享文件编辑前基于最新版本重读（Edit 报 modified since read 时重读再改）。
- 收尾常漏三处：PROGRESS 轮次表格行、头部"最后更新/上次验证"、WORK_STATE 一致性——关账前自查。

## 10. 三天开发史一句话版（细节在 PROGRESS.md）

2026-09-26 起 20 轮定时触发：1~5 定规格/搭骨架/状态模型/年度推进/事件引擎 → 6~7 首个可玩版+角色创建 → 8~13 六大系统（教育/职业/财务/关系/健康/成就因果链）→ 14~16 青/中/晚年内容（池 86→105→121）→ 17 结局系统（13 结局优先级表）→ 18 存档系统 → 19 交互打磨（≥2 选项规则/门槛中文说明/重复事件清点，池 122）→ 20 最终验收与离线交付（file:// 内联修复/120 局模拟/README）。多数轮次经历两到四次独立触发的实现+复验交叉，最终基线 485/485、tsc 干净、build+内联全绿，SPEC §7 十项验收全过。
