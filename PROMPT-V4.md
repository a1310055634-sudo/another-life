# 《另一种人生》V4 精修计划 · 夜班任务书（第 61–81 轮）

你负责执行《另一种人生》V4 精修：清偿 V3 挂账的五条限制（策略盲区、孙辈天花板、家庭线健康偏向、引导焦点、往生录回顾），把 V3 探明的内容薄处补厚（教育线、朋友系统、兄弟姐妹、宠物、婚姻深水区、倦怠线），并完成一轮呈现精致化（往生录 II、引导 II、岁月长河、音景 II、印刷质感、分享卡 II），最后以千局 V4 完成平衡收官。

项目目录：D:\vibe coding\another-life

前提：V3（第 41–60 轮）已于 2026-10-02 全部关账交付——测试基线 946/946（48 文件）、事件池 178、成就 46、结局 13 种 × 后记 39 段四形态定向分派、存档 v2、dist 394.1 kB 自包含可 file:// 打开、千局 1000 局零异常。V4 不推翻 V1/V2/V3 任何验收，回归网只增不减。

**快照免责**：本任务书中出现的行号、现值计数、建议参数均为 2026-10-03 写作时快照，一律以开工时文件现读为准；偏离建议参数必须在账本写明决策与理由，不得悄悄改规格让验收"通过"。

## V4 的设计依据（第 58 轮千局与 V3 体检实证，作为对照基准）

- 孙辈链路天花板：fam_grandchild_time 触发 1.2%、late_story_grandchild 0%（孙辈需孩子 ≥29 + 婚礼里程碑 ms_wedding 双链叠加）。
- 四枚 0% 成就：ach_first_degree / ach_old_friend / ach_reunion / ach_phd（机器人策略盲区，人类可达）。
- 策略偏向：F 段 family_line 的 death_ill 结局 37% 偏高（机器人在健康事件上也选首项=硬扛向）。
- 结构性空白（代码探查实证）：兄弟姐妹不存在（RelationKind 7 种：parent/friend/partner/spouse/child/pet/grandchild，无 sibling）；朋友衰减 −2/年 全类型最快且无取名池（取名池 namePoolFor 只覆盖 child/grandchild/partner，friend 只有事件静态具名）；pet 衰减 0（宠物永生不老、无离世）；无不育/婚姻危机/倦怠事件线；教育事件仅 6 条（全池最薄文件：basic 20/career 14/education 6/finance 10/health 14/late 34/midlife 28/parents 6/relationship 28/youth 18）；时代氛围事件自 R27/R47 后未再加密。
- R58 千局基准（V4 各轮对照口径）：混合策略结婚率 24.5%（F 段 family_line 51.0%）、终龄均值 72.0、S 级 8.5%、B 段债务结局 7.8%、父母去世覆盖 98.3% 人均 1.72 次、慢病确诊 21.5%、含饴弄孙 1.2%。

## 任务执行规则：一次触发只做一轮

1. 每次触发时，重新读取 WORK_STATE.json、PROGRESS.md（尾部 V4 账本）、本任务书，以及当前轮次涉及的源码和测试。不要假设上次触发成功，也不要根据任务书内嵌的状态快照覆盖项目文件中的实际状态——一切以文件现读为准。
2. 开工引导：若 WORK_STATE.json 为 current_round=60 且 round_status=completed（V3 已整体交付），先把状态推进为 current_round=61、round_status=not_started、last_completed_round=60、attempts_on_current_round=1，在 PROGRESS.md 末尾开「V4 账本」段落，然后执行第 61 轮。若 current_round 已在 61–80 区间，按 round_status 接续（in_progress 从未完成处续做、不覆盖已有有效实现；not_started 开工本轮）。若 current_round=81 且 round_status=completed，只报告 V4 完成状态，不再修改代码。
3. 一次触发只完成 current_round 指向的一轮的实现、必要验证和进度记录，之后立即结束。明确禁止在一次触发中连续完成多轮。
4. 并发保护：检测到同一轮已有其他进程正在编辑（当前轮文件集 mtime 距检测时刻小于 3 分钟，或 PROGRESS.md 已出现本轮新段落而 WORK_STATE 尚未关账）时，不并行改写任何文件。对方未关账时在 PROGRESS.md 记录观察到的活跃迹象后停止本次执行；对方已关账时零写入纯报告让位，不追加会劫持「下一轮唯一入口」定位的记录。
5. 一轮只有在本轮的实现、验收和记录全部完成后才能关账。失败时保留本轮为 in_progress，在 PROGRESS.md 写明失败命令、失败原因、受影响文件和下一步；下一次触发接续这一轮。验收失败修复重验至多 2 次，仍失败则挂账收工。
6. 关账时更新 WORK_STATE.json：current_round、round_status、last_completed_round、attempts_on_current_round、last_verification 必须彼此一致。完成一轮后，只把下一轮标记为 not_started；不要顺手开始它。attempts_on_current_round 在每次接续同一轮时 +1，成功关账后清回 1。
7. 不重置已完成的轮次，不删除用户资料与存档，不恢复旧版本覆盖新代码，不提交或推送代码（本项目无 git 仓库，保持无 git 操作），不杀既有 dev server，不为测试杀掉其他端口的服务。

## 每轮共同要求

- **开工三步**：①从 PROGRESS.md「V4 账本」找到当前轮的接续位置和已完成工作；②读本轮规格的「前置盘点」清单所列文件，确认现值与快照是否一致；③写一份本轮短执行清单（含验收清单编号）再动手。
- 遵循 SPEC.md 已有规则与验收标准；V4 的机制变化（兄弟姐妹、挚友线、婚姻深水区、倦怠线、宠物生命周期、教育纵深）必须在同轮同步进 SPEC.md 对应章节（沿用 §6.35 起编号），不得让文档、引擎、界面各说各话。
- 保持分层：规则逻辑在 src/engine，事件文本与选项数据在 src/data/events，React 组件只负责显示。
- **存档永不升版本**：V4 全程 SAVE_VERSION 恒为 2（src/engine/init.ts），禁止再动存档迁移；新增字段一律可选加默认值——新关系种类 sibling、宠物 birthAge、burnout/best_friend/marriage_crisis 等标记对旧档天然兼容（旧档没有该字段即正常语义：无手足、无标记）。往生录等多周目数据仍用独立 localStorage 键 `another-life:legacy`，V4 扩展字段一律可选、旧条目缺字段时展示层自然降级，禁止写入存档 v2 结构。新增关系种类与关系级字段必须同步 src/engine/validate.ts（或现读到的等价校验入口），并附「旧档（无新字段）加载可读」测试。
- **随机支流纪律（V4 新增，违者必炸回归网）**：新增的非事件类随机——手足定数、取名、宠物寿命、年志生活流抽取等——**禁止消耗主 rng 流**（主 rng 流位移会让全部固定 seed 断言连片失效）。实现方式：用 seed 派生的独立散列或独立 mulberry32 实例（如 `mulberry32(seed ^ 0x<常数>)`，先现读 namePoolFor 的既有随机来源，跟随同一模式）。凡涉随机支流的轮次，硬验收必含一条：**outcomes.test 的 18 局固定 seed 模拟逐局结果与改动前完全一致（零位移）**。
- 回归网：946 个测试是 V3 基线，只增不减。已知硬编码锚点（新增事件/改数据的轮次必须同步并在记录中说明新计数）：health.test.ts 与 relationDecay.test.ts 的全池计数（现 178）；各文件级计数与窗口断言——basic 20 / career 14 / education 6 / finance 10 / health 14 / late 34 / midlife 28 / parents 6 / relationship 28 / youth 18；outcomes.test.ts 的 V2_NEW_EVENT_IDS 排除表（现 56 个，新事件 id 必须追加并注明轮次）；relationDecay.test.ts 的衰减率表（parent 1 / friend 2 / partner 1 / spouse 1 / child 1 / pet 0 / grandchild 0，改动须同步断言）；round32_css_diff.mjs 类名基线 109（呈现轮改 CSS 必须过守卫，注释措辞避开守卫正则）。
- 新增事件一律遵守：≥2 个有效选项（singleChoiceOk 白名单仍仅 hlt_body_intensive 一个，不得新增无标记单选）、once/cooldown 语义明确、不假设玩家有配偶/孩子/房产/积蓄/稳定工作/手足（手足相关事件必须以 sibling 在册为资格门控）、金额与现有物价感知一致（数千元=大额、数百至两千=中额）。新事件的模拟验证沿用既有方法：真实 drawEvent + 新事件权重×50 + 错误状态从不进入候选的断言；新事件的数据文件归属先核对文件级计数与窗口断言，跨文件放置前先盘点。
- 阶段隔离（V4 特有）：
  - 第 61–72 轮（机制与内容）：允许改 engine、data 与 scripts；影响数值语义的改动（概率、金额、衰减、资格窗口、收入修正）必须附调整前后对照模拟（至少 100 局或孪生对照），对照数据写入账本；纯文本轮用 era_fingerprint + era_fp_compare 证明机制值零变化（注意剥除 delayed.summary）。
  - 第 73–78 轮（呈现）：允许改 CSS、组件、新增展示组件；禁止修改引擎数值与结算逻辑；需要数据支撑只读不写。
  - 第 79 轮是唯一平衡轮：千局观察与稀有度终校，只调稀有度标签数据；任何权重调整须有前后对照。
  - 第 80–81 轮只修最终验收发现的缺陷，不做新扩充。
- 每轮宁小勿大：一轮装不下时砍内容不砍验收，按本轮「砍量预案」执行，砍掉的部分写进账本"遗留与后续"，等后续轮或用户定夺。
- 工程坑（本机已验证，深夜必读）：bash 处理中文会被 GBK 化，中文内容一律用 Read+Write+Edit 工具，不走 bash 内联（echo/sed/heredoc 写中文会毁掉中文锚点）；含 $() 的复杂脚本写成 .js/.mjs 文件再执行；浏览器验证用 headless Chrome + CDP 脚本模式，独立 user-data-dir + 高位调试端口（9227 曾被 aDrive.exe 占用，用 93xx），用完即清进程；探针导航后轮询关键计数而非定值 sleep；CDP click 后加 80ms sleep 等 React commit（React 18 DOM 刷新在微任务，同步读会假红）；终局后 App 清档——脚本读 localStorage 须在推进循环内缓存存档，注入置 phase='ended' 后由 Node 侧回填；跨层断言用自洽断言（浏览器与 node 首选项路径 30 岁后有 history ±2 小分叉，断言不得依赖两路径逐位一致）；effects 数组内写 summary 是类型错误，事件写完立即 tsc；事件 cooldown 由 session.chooseOption 落账（直调 applyChoice 有假象）；relationKinds 存在性检查是 OR 语义，AND 用 minCloseness 多键；Edit 文件尾追加只锚最后唯一行并把收尾原样拼回。
- 每轮完成前至少执行 `npm test`（基线 946 只增不减）、`npx tsc --noEmit` 和 `npm run build`（build 已含 inline-dist 内联步骤，产物须保持自包含可 file:// 打开），并加跑与本轮改动面相关的既有回归脚本（round32–37 各验脚本、round48/55、mobile_verify、fileui_verify、keyboard_verify、save_robustness_verify、era 指纹工具——凡本轮改动可能波及的都要跑，必要时把 check_all.mjs 的清单扩入新脚本）。结果写入本轮记录，不能引用旧轮结果。
- **验收清单逐条编号给证据**：本轮规格的「验收清单」逐条编号（A1、A2…），关账时逐条给出证据（命令+关键数字/测试名），不允许"全部通过"一句话带过。
- 每轮结束时在 PROGRESS.md 的「V4 账本」记录：目标、实现文件、关键行为、验证命令及真实结果、验收清单逐条证据、遗留与后续、下一轮唯一入口。

## 阶段总览

| 阶段 | 轮次 | 主题 | 允许改动 |
|---|---|---|---|
| 一 | 61–63 | 链路清偿（千局策略库/孙辈链路/教育纵深） | scripts + engine + data，数值改动附对照 |
| 二 | 64–69 | 关系与状态真实化（手足/挚友/婚姻/倦怠/宠物） | engine + data，数值改动附对照 |
| 三 | 70–72 | 内容与文本（时代质感/年志生活流/成就三期） | data 为主，纯文本轮零机制值 |
| 四 | 73–78 | 呈现精致化（往生录 II/引导 II/岁月长河/音景 II/印刷质感/分享卡 II） | CSS + 组件，引擎只读 |
| 五 | 79–81 | 平衡收官（千局 V4/全量体检/总验收交付） | 79 唯一数值轮，80–81 只修不扩 |

---

## 第 61 轮：千局策略库 V2 —— 盲区清偿与偏向修正

**目标**：让机器人像人一样权衡，清掉四枚 0% 成就里的策略性盲区与 family_line 的健康硬扛偏向，并为第 79 轮千局 V4 建立新基线。本轮 scripts 轮，产品源码 src/ 零改动。

**前置盘点**：读 `scripts/strategy_contrast.ts`（四策略 rotate/health_aware/survival_best/balanced 的评分函数与 pick 兜底分支）、`scripts/round39_balance_sim.ts`（策略池 5 种、A/B/C/F 分段与局数配比、random 策略）、`src/engine/achievements.ts` 中 ach_first_degree / ach_old_friend / ach_reunion / ach_phd 四枚的解锁条件（逐枚摘录进账本）；对照 PROGRESS.md 第 58 轮千局基准数。

**设计决策（建议基线，偏离须记录）**：新策略以新名并列、旧策略保留不动——`family_line_v2`（基础评分=survival_best 综合分；健康类事件选 health 增益最大项而非首项；出现求婚/婚礼推进类事件必选推进项；伴侣/子女/父母维护事件优先）、`study_line`（在 family_line_v2 基础上，age<45 且 smarts≥55 时教育深造类事件选学业项）、`friend_line`（关系维护类事件选 friend 维护项，验证 ach_old_friend 路线）。策略池轮换配比沿用 R58：A 段 360/B 段 360/C 段 180/F 段 100=1000 局，F 段改用 family_line_v2。

**工作项**：①在 strategy_contrast.ts 实现三个新策略（评分函数+单测式自检：给定构造事件卡断言选中和预期）；②round39_balance_sim.ts 策略池扩入新策略并保留旧池开关（命令行参数可选新旧池，保证对照干净）；③先跑旧池千局复现 R58 基线（允许 ±2% 内浮动，超出先查环境），再跑新池千局；④两张分布表并排出账本。

**验收清单**：
- A1 千局前后对照表入账本（四枚成就逐枚触发局数、F 段 death_ill%、混合结婚率、13 结局覆盖、终龄/资产分布、零卡死/零 NaN/零单选/零 once/保底）。
- A2 新池 F 段（family_line_v2）death_ill ≤25%。
- A3 新池混合结婚率 ≥24.5%（不降于 R58 基线）。
- A4 原四枚 0% 成就至少 2 枚在新池千局中现身。
- A5 新池 1000 局零卡死/零 NaN/零单选/零 once 违规。
- A6 src/ 零改动证明：`npm test` 946/946 不变（脚本轮不改产品码，测试数应恰为 946）、tsc 干净、build 正常。

**同步锚点**：无产品码改动；round39/strategy_contrast 的新策略入 README 脚本说明可留到 81 轮。

**验证命令**：`npx tsx scripts/round39_balance_sim.ts`（新旧池各一次）、`npm test`、`npx tsc --noEmit`、`npm run build`。

**砍量预案**：千局时长超预算时先降 C 段局数，保 A/B/F 段；A4 不足 2 枚时如实记录缺口与原因（资格年统计），归 79 轮复核，不得硬凑。

**账本要求**：新旧池对照表 + 新策略参数摘要 + 「V4 新基线」声明（此后各轮对照以本轮新池千局为准，R58 基线只作历史参照）。

## 第 62 轮：孙辈链路打通

**目标**：破除「孩子 ≥29 + 婚礼里程碑 ms_wedding」双链叠加天花板（fam_grandchild_time 1.2%、late_story_grandchild 0%），让含饴弄孙成为可经历的晚年内容。

**前置盘点**：现读 `src/data/events/relationship.ts` 中 fam_grandchild 的 requires（快照：孩子 ≥29 + ms_wedding + ms_grandchild 待办，任一选项以 relation kind grandchild add 落真实关系+乳名池具名+birthAge 盖章）与 fam_grandchild_time（快照：孙辈 ≥3、每孙至多一次）；`src/data/events/late.ts` 中 late_story_grandchild（快照：62–77、once、requires 仅 has_child 标记）；`src/engine/children.ts` 里程碑表（12/15/18/22/26/29 六档，确认 ms_wedding 所在档）。

**根因排查（先做，写入账本）**：late_story_grandchild 若资格仅 has_child，为何千局 0%？三层漏斗统计法定位：在 round39 模拟挂钩统计「62–77 且 has_child 的资格年数」→「该事件入候选次数」→「被抽中次数」。漏斗断在哪层（资格永假 / 入候选但竞争落败 / 从未模拟到该窗口），修法就指向哪层。

**设计决策（建议基线，偏离须记录）**：fam_grandchild 放宽为「孩子 ≥26 且 ms_wedding」或「孩子 ≥30 无须婚礼里程碑」双通道（选定一条写死）；late_story_grandchild 资格改为「任一 grandchild 在册」；若漏斗显示竞争落败，给孙辈域事件适度提权或加 stagger 窗口。若排查后需要补位入口事件（如「子女电话报喜」——孩子 ≥31 无婚礼里程碑路径），至多 1 个，走排除表与计数同步。

**工作项**：①根因漏斗（先于任何改动）；②按选定口径改 requires；③正反单测（无子女/子女未达龄/子女达龄无婚礼/双通道各一）；④孪生对照（同 seed 放宽前后：孙辈出现局占比、首次含饴弄孙年龄分布）；⑤300 局×新事件权重×50 证明可达 + 千局抽测实际触发率。

**验收清单**：
- A1 根因结论与漏斗数据入账本。
- A2 千局或加权模拟：fam_grandchild_time ≥5%、late_story_grandchild >0。
- A3 资格正反测试四路齐全（错误状态从不入候选断言）。
- A4 旧档兼容：无孙辈即无该链路，加载不报错。
- A5 计数同步：relationship.ts 或 late.ts 文件级计数（28/34→新值）+ 全池 178→新值 + V2_NEW_EVENT_IDS 追加（若新增事件）。
- A6 outcomes.test 18 局零位移（若因放宽资格产生位移，须逐局说明并记录决策——本条预期零位移，非零必须解释）。

**同步锚点**：SPEC §6.20 更新（资格口径）、relationDecay/health.test 全池计数。

**验证命令**：`npm test`、`npx tsc --noEmit`、`npm run build`、`npx tsx scripts/round39_balance_sim.ts`（抽测配比可降为 A 120/B 120/C 60/F 100=400 局）。

**砍量预案**：双通道口径装不下时只做「≥26+ms_wedding」单通道放宽 + late_story_grandchild 资格修正；补位入口事件归遗留。

## 第 63 轮：教育纵深 —— 在职深造与证书资格

**目标**：教育是全池最薄文件（仅 6 事件），给成年后的学习一条可走的线，并为 ach_first_degree/ach_phd 提供机器可达路径。

**前置盘点**：现读 `src/engine/education.ts`（学历层级语义与判定）与 `src/data/events/education.ts`（6 事件的窗口与效果）、`src/engine/income.ts`（薪资公式中学历项现值）、`src/engine/career.ts` 晋升条件；ach_first_degree/ach_phd 解锁条件摘录。

**设计决策（建议基线，偏离须记录）**：事件链 4 枚落 education.ts（6→10+）：①在职备考（requires 在职+age 22–45；代价：当年 stress +X、余裕下降——用既有属性口径）；②深造录取（requires 备考完成标记+smarts≥55；延迟 1 年到货用 pending/delayed 机制）；③毕业跳档（education 档位 +1，once）；④学历兑现（跳档后窗口：收入修正 +6% 档、晋升折算放宽 promoteEvery −1 或等效最小实现——选定写死）。读研→读博两段共用链、按学历档位区分，避免两套链。

**工作项**：①income.ts/education.ts 最小语义改动（附孪生对照：同 seed 深造与否的收入/职级轨迹表，≥100 局分布漂移入账本）；②4 事件写入 education.ts；③education.test 文件级计数与窗口断言同步（6→10+）；④ach 对接：若 ach_first_degree/ach_phd 语义与深造档位契合，账本记录对接点与构造测试；不契合则如实说明，留 79 轮千局观察。

**验收清单**：
- A1 深造链正反测试（学历已达标/无工作/smarts 不足不可达；完整链可达）。
- A2 孪生对照表：深造线 vs 非深造线同 seed 收入/职级轨迹差异显著且方向正确（深造后期占优）。
- A3 计数同步三件：education.ts 6→新值、全池 178→新值、V2_NEW_EVENT_IDS 追加 4 枚。
- A4 千局抽测深造链触发率 >0 并入账本。
- A5 outcomes.test 18 局零位移（新事件已入排除表，预期零位移）。

**同步锚点**：SPEC 新增 §6.36（教育纵深）。

**验证命令**：三件套 + `npx tsx scripts/round39_balance_sim.ts`（400 局抽测）。

**砍量预案**：读研/读博双段装不下时只做单段「在职深造」；晋升折算放宽若波及 career.test 断言过多，改为只做收入修正一项，放宽归遗留。

## 第 64 轮：兄弟姐妹 I —— 建立与年度动态

**目标**：补上最后一个结构性家庭空白。现代都市背景按独生子女代际设计——手足是「可有」而非「必有」。

**前置盘点**：现读 `src/engine/relations.ts`（RelationKind 表、Relation 字段、namePoolFor、RELATION_DECAY_RATE、aliveOf/estranged/revive 链路）、`src/engine/init.ts`（初始关系如何建立——父母关系在哪创建、rng 如何使用）、`src/engine/parents.ts`（deceased/deathAge 语义与年检推进表，作为手足晚年先逝的复用蓝本）、`src/engine/validate.ts`（关系校验入口）。

**设计决策（建议基线，偏离须记录）**：
- 定数：开局一次定数，独生 60% / 1 个手足 35% / 2 个 5%；birthAge = 玩家年龄 −4…+4 内取整（兄姐为正）；**用随机支流**（seed 派生独立实例）定个数与 birthAge，主 rng 流零位移。
- 取名：namePoolFor 扩 sibling 风格池（兄/姐/弟/妹按相对年龄定标签，名字男女中性池或按 birthAge 正负分池——选定记录）；同样走支流。
- 衰减：sibling −1（稳定关系口径），RELATION_DECAY_RATE 表与 relationDecay 断言同步。
- 晚年先逝：复用 parents.ts 的 deceased 语义；玩家 ≥58 岁起年检小概率表（手足年龄≈玩家±4，兄姐概率略高），数值入小概率表常量并写 SPEC §6.35。
- 不做手足子模拟：手足无职业/婚育轨迹，状态用 closeness+estranged 既有语义承载；疏远与去世互斥（ revive 不得复活已去世者——沿用 R41 断言口径补 sibling 用例）。

**工作项**：①RelationKind 加 sibling+标签；②init.ts 支流定数+取名（旧档无 sibling 即无，天然兼容；validate 同步可选字段）；③衰减表+年检先逝；④单测：定数 seed 确定性（同 seed 同手足配置）、支流零位移、衰减断言、先逝资格；⑤对照模拟 ≥100 局前后（结局/资产/关系分布漂移表入账本）；⑥outcomes.test 18 局逐局零位移硬断言（init 消耗支流后主流不变，预期严格零位移；非零必须查明）。

**验收清单**：
- A1 定数/取名/先逝 seed 确定性测试。
- A2 outcomes.test 18 局逐局零位移。
- A3 对照模拟 ≥100 局前后漂移表入账本。
- A4 relationDecay.test 衰减率表含 sibling −1。
- A5 旧档（无 sibling 字段）加载可读+展示降级不露 undefined。
- A6 疏远复活不得复活已去世者（sibling 用例）。

**同步锚点**：SPEC §6.35 新章节；relationDecay.test 衰减表；validate.ts。

**验证命令**：三件套 + `npx tsx scripts/round39_balance_sim.ts`（400 局抽测手足覆盖率）。

**砍量预案**：先逝概率表装不下时归第 65 轮头部（事件线需要已故资格，正好同轮补），本轮只交建立+衰减+取名。

## 第 65 轮：兄弟姐妹 II —— 事件线

**目标**：给手足以情感叙事，不只结算关系值。

**前置盘点**：确认第 64 轮已关账（sibling kind 在册）；现读 parents.ts 事件（parents.ts 6 事件）的父母资格门控写法作为蓝本；核对 relationship.ts/parents.ts 的文件级计数断言归属（决定 siblings.ts 独立文件的新断言放哪——建议新建 siblings.test.ts 挂文件级计数+窗口断言，并同步 health.test/relationDecay.test 的全池计数）。

**设计决策（建议基线，偏离须记录）**：新文件 `src/data/events/siblings.ts`，≥7 事件、窗口覆盖 20–70：①借钱与还钱（成年期，金钱数百至数万按年龄分档、还钱 delayed）；②合伙创业抉择（30–45，高风险高回报选项，与 fin_side_hustle 区分定位）；③父母赡养分工（requires 父母在册+sibling 在册，与 parents 线互相引用资格）；④遗产之年（requires 父母均已去世+手足在册，once，情感+小额分产）；⑤聚会口角与和解（closeness 低于阈值资格，和解修复选项）；⑥异地重逢（疏远/异地多年资格）；⑦老来相伴（双方均 ≥60，requires 手足在册未去世）。全部 ≥2 有效选项、按在册/已故/疏远资格门控、不依赖其他家庭结构。

**工作项**：①建文件+注册 index.ts；②7 事件；③siblings.test.ts（文件级计数、窗口断言、三状态模拟：手足长线/疏远线/已故线各抽到对应事件且错误状态从不入候选）；④无手足局全池抽 200 次零 sibling 事件泄漏断言；⑤计数四处同步：siblings.ts 新计数、全池 178→新值、V2_NEW_EVENT_IDS 追加、health.test/relationDecay.test 全池数。

**验收清单**：
- A1 三状态模拟 + 零泄漏断言。
- A2 每事件正反可用性测试。
- A3 计数四处同步并在账本记录新计数。
- A4 outcomes.test 18 局零位移（排除表生效）。

**同步锚点**：SPEC §6.35 扩事件线小节。

**验证命令**：三件套 + 三状态模拟脚本（.ts 写 scripts/ 下或临时脚本用后即删，账本注明）。

**砍量预案**：7 事件装不下保 5（①③⑤⑦+任一），砍掉的写遗留；⑤⑥可合并为「疏远与重逢」一枚。

## 第 66 轮：挚友线 —— 朋友具名与挚友标记

**目标**：朋友是全类型衰减最快（−2/年）、最泛称的关系，把它做成可经营的长线，并为 ach_old_friend 铺机器可达路径。

**前置盘点**：现读 relations.ts 的 namePoolFor 与 friend 具名三级来源（事件静态具名>池>泛称）；全池搜 pet→friend 关系的建立入口（哪些事件 relation add friend、是否带名）；ach_old_friend 解锁条件摘录；RELATION_DECAY_RATE 与断言现值。

**设计决策（建议基线，偏离须记录）**：
- 取名池：friend 风格池（老×/×哥/阿×/小×，×取常用单字名池）；建立时未具名者由池补名（支流随机，seed 确定）。
- 挚友标记承载：**建议 Relation 可选字段** `bestFriend?: boolean`（validate 同步可选）；备选方案=全局 tags 约定 `best_friend:<标识>`——两者选一写 SPEC §6.37，全局 tags 方案须解决多朋友标识问题，故优先建议关系级字段。
- 升降标记：年度结算时 closeness ≥60 盖标记、<40 摘除；挚友衰减改 −1（decay 表+断言同步；非挚友维持 −2）。
- 挚友事件 ≥4（relationship.ts 或新文件，按文件级计数纪律选）：深夜倾诉（requires 自身或挚友 happiness<40）、婚礼伴郎（requires 有 spouse+挚友在册）、跨城探望（挚友 estranged/低亲密资格，修复向）、争吵与和好。
- ach_old_friend 对接：现读其解锁条件，若语义为「维持挚友 N 年」则在结算处接计数；若语义不同，账本记录差异与决策，不强改成就语义。

**工作项**：①池+补名（支流）；②标记升降（年度结算钩子，位置现读 lifecycle/relations 的年结入口）；③decay 调整+断言；④4 事件；⑤对照模拟 ≥100 局（挚友达成率、挚友维持年数分布、前后对照入账本）；⑥outcomes.test 18 局零位移。

**验收清单**：
- A1 取名 seed 确定性；无池可名时泛称兜底不露 undefined。
- A2 标记升降正反测试（60 升/40 降/边界年）。
- A3 衰减表断言同步（friend 2→挚友 1/普通 2 双档）。
- A4 对照模拟表入账本。
- A5 计数同步（落哪个文件同步哪个+全池+排除表）。
- A6 outcomes.test 18 局零位移。

**同步锚点**：SPEC §6.37（挚友线）。

**验证命令**：三件套 + 400 局抽测挚友达成率。

**砍量预案**：4 事件装不下保 2（深夜倾诉+争吵与和好）；ach 对接不顺时只记录不改判定。

## 第 67 轮：婚姻深水区 —— 危机与修复

**目标**：婚姻不只有和睦和丧偶，中间地带要有真实的低谷与爬出。

**前置盘点**：现读 spouse 关系建立链（求婚→婚礼）与配偶相关结局的资格判定（outcomes.ts 中逐结局列资格表：哪些结局 requires spouse 在册——family_hearth 等，全部摘录）；relationDecay spouse −1 现值；relationship.ts/midlife.ts 现有婚姻维护事件清单（避免撞题）。

**设计决策（建议基线，偏离须记录）**：
- 危机标记：建议关系级可选字段（同 66 轮风格）或全局 tag，选一写 SPEC §6.38。
- 危机进入：危机事件选项可进入；危机期间 spouse 衰减 −1→−3（数值改动，附对照）。
- 危机事件 ≥5（窗口 28–60）：七年之痒、冷战分居、异地考验（requires 职业异地语义或叙事化）、修复之旅（花钱档中额）、婚姻咨询（年开销数百至两千、随通胀，连续年可持续）。修复选项摘除标记并回补 closeness；置之不理则衰减加重可致 estranged（不自动离婚）。
- 离婚最小语义（装不下砍掉留账）：主动抉择事件（危机深重年出现一次）→ spouse 关系结束（移出在册、history 留痕）+ 一次性资产分割 money×50% + child 关系全部保留（共同抚养语义）+ 第 67 轮须交「配偶相关结局资格表逐条复核」（离异后哪些结局资格变化，逐条写明）。

**工作项**：①标记+衰减加重（对照模拟：危机年有无干预的 closeness 轨迹与结局漂移 ≥100 局）；②5 事件；③离婚语义（若做）：结局资格审计表+单测；④计数同步。

**验收清单**：
- A1 危机线正反测试（无 spouse 不可达；修复摘标记；置之不理衰减加重）。
- A2 对照模拟表入账本（衰减 −3 的漂移）。
- A3 离婚（若做）：结局资格审计表逐条入账本+SPEC；child 关系保留断言。
- A4 计数同步；A5 outcomes.test 18 局零位移。

**同步锚点**：SPEC §6.38（婚姻深水区）。

**验证命令**：三件套 + 400 局抽测危机线触发率与修复成功率。

**砍量预案**：优先保 5 事件+危机标记；离婚分支超载即砍，写遗留（这是预设的砍法，不算失败）。

## 第 68 轮：倦怠与心理韧性线

**目标**：stress 属性已有但没有可体验的长期后果，补一条可管理的心智健康线。

**前置盘点**：现读 stress 的全部来源与消耗（attrs.ts、事件效果扫描 stress +/−）、lifecycle/年结入口（标记检查点挂哪）、health.ts 14 事件与窗口断言（决定落点）、youth_resign_impulse（既有高压力事件，避免撞题）。

**设计决策（建议基线，偏离须记录）**：burnout 为全局 tag；年结检查：stress ≥80 连续 2 年 → 盖 burnout 标记；burnout 期间 happiness −1/年（轻度下漂，写死入 SPEC §6.39）；stress <60 摘除。事件 ≥6（主窗 25–55，落 midlife.ts 为主、1–2 个晚年复发落 late.ts）：失眠、效率崩塌（requires 在职+burnout）、心理咨询（年开销数百至两千、通胀系数，选项非羞辱化文案）、病假（在职资格）、休假重启、换岗轻装（在职资格）。健康钩子沿用既有 lifestyle 风险口径，**不改公式**。

**工作项**：①标记升降（年结钩子+单测：连续 2 年进入、<60 摘除、边界年）；②6 事件（计数同步：midlife.ts 28→新值、late.ts 34→新值、全池、排除表）；③孪生对照（同 seed 候倦怠年：有/无干预的 stress/health/happiness 轨迹差异表）。

**验收清单**：
- A1 标记升降正反测试。
- A2 孪生对照差异显著且方向正确入账本。
- A3 计数同步记录新计数。
- A4 事件文案非羞辱化自查（走查记录）。
- A5 outcomes.test 18 局零位移。

**同步锚点**：SPEC §6.39（倦怠线）。

**验证命令**：三件套 + 400 局抽测倦怠覆盖率。

**砍量预案**：6 事件装不下保 4（失眠/心理咨询/休假重启/换岗轻装）；晚年复发事件归遗留。

## 第 69 轮：宠物真实化 —— 衰老与离别

**目标**：pet 衰减 0 = 永生不老，补完从领养到离别的一生。

**前置盘点**：全池搜 pet 关系建立入口与既有宠物事件（存在哪些、落在哪个文件、领养入口是否已有）；Relation 的 birthAge 字段（child/grandchild 在用）；parents.ts 哀伤期（grief_parent）实现口径（复用蓝本）；relations.test 的 pet 断言现值。

**设计决策（建议基线，偏离须记录）**：
- 领养：若无入口则新增领养事件（requires 无 pet 在册；≥2 选项含「再想想」）落 relationship.ts。
- 年龄：pet 补 birthAge（**旧档已有宠物无 birthAge → 按本轮加载当年起算 0 岁并在账本说明此近似**）；新领养 birthAge=0（幼体）或 1（收留成体，事件两选项区分）。
- 寿命：12–16 年，**每只宠物在其建立时用支流散列（seed+关系标识）一次定寿**，主 rng 零位移。
- 衰老：≥10 岁盖 aging 标记（事件资格）；离世：年龄 ≥ 寿命即当年离世（确定性）或 ≥寿命−2 起年检小概率（选定一条写死）；离世复用 deceased 语义（alive:false+deceased+deathAge）。
- 哀伤：grief_pet 1–2 年轻度 happiness 下漂（复用 grief_parent 口径参数）；「再领养」抉择事件收束哀伤（once）。
- 事件 ≥5：领养、疫苗与生病（vet 开销数百档）、陪伴（玩家 happiness<45 年 happiness 小回+8 档）、衰老照护（aging 资格）、离别与再领养。

**工作项**：①birthAge+寿命支流；②离世+哀伤钩子；③5 事件（计数同步落点按盘点定）；④relations.test 同步；⑤寿命 seed 确定性测试+旧档兼容测试。

**验收清单**：
- A1 寿命 seed 确定性；A2 旧档 pet 无 birthAge 兼容；A3 离世后宠物类事件资格消失（断言）；A4 grief_pet 自然消退断言；A5 计数同步；A6 outcomes.test 18 局零位移。

**同步锚点**：SPEC §6.40（宠物生命周期）；relationDecay pet 0 维持不变（在世不衰减，寿命封顶管离别——账本写明此设计）。

**验证命令**：三件套 + 400 局抽测领养率/离世覆盖。

**砍量预案**：5 事件装不下保 3（领养/衰老照护/离别与再领养）；「年检小概率」若装不下用确定性到龄离世。

## 第 70 轮：时代纵深 II —— 代际质感补密

**目标**：R27/R47 后时代氛围未再加密，按数据补薄处。纯文本轮，机制值零变化。

**前置盘点**：跑 `npx tsx scripts/age_heatmap.ts` 取各年龄桶覆盖现值（快照基准：R47 后 70–77 已补，预计最薄为 26–35 与 56–65，以实测为准）；era_audit.mjs 词表现值（手机/微信/扫码/报纸…）；round48_text_audit.ts 的扫描维度。

**设计决策（建议基线）**：词表 +10（短视频/直播/外卖/网约车/快递柜/网购节/网课/电竞/智能手表/朋友圈——以现读词表去重为准）；新增 ≥6 纯氛围事件定向补最薄桶（每事件 ≥2 选项、金额零或小额、无机制效果——效果数组只允许零值或纯文本 summary 字段放置遵守 effects 无 summary 纪律，纯氛围事件用既有氛围事件 youth_livehouse/mid_nav_memory/late_group_rumor 的写法作蓝本）。

**工作项**：①热力图实测前后表；②词表扩容+全池扫描报告（矛盾=0 才过关）；③6 事件写入对应年龄文件（计数同步+排除表）；④era_fingerprint + era_fp_compare 证明全池机制值零变化（剥 delayed.summary）。

**验收清单**：A1 热力图前后对比表入账本；A2 时代词扫描零矛盾；A3 指纹零变化；A4 计数同步；A5 outcomes.test 18 局零位移（排除表生效）。

**验证命令**：三件套 + era 指纹对 + `npx tsx scripts/age_heatmap.ts` + `npx tsx scripts/round48_text_audit.ts`。

**砍量预案**：6 事件装不下保 4；词表扩容不减。

## 第 71 轮：年志生活流

**目标**：跨年结算的年志只有收支与大事，补一句「生活在流过」的质感。纯文本轮，零机制值、零 rng 位移。

**前置盘点**：现读年结入口的 yearLog 生成处（条目结构、当年语义——yearLog 只保留当年，跨年翻转时被替换）；结局年与 >75 岁的判定点；era 指纹工具对 yearLog 的覆盖方式（指纹应证明零机制值）。

**设计决策（建议基线，偏离须记录）**：每年年结追加至多 1 条氛围行；池 ≥40 条=季节 4 × 人生段 3（青年/中年/晚年）× 若干变体，意象覆盖天气/节气/街巷/餐桌/身体感；抽取**用独立散列（seed+age+年份序号）取模**，绝不消耗主 rng；同一年不重复同一意象（池内去重取样）；>75 岁与结局年不加；氛围行带统一前缀标记（如「——」或既有年志的次要条目样式）便于走查与测试定位。

**工作项**：①池数据（新文件 src/data/yearlife.ts 或落现有文本数据文件，选定记录）；②年结钩子一行注入；③单测：seed 确定性（同 seed 同年同句）、>75/结局年不加、池取模分布；④era_fingerprint 证明；⑤10 局抽样年志节录入账本。

**验收清单**：A1 seed 确定性；A2 outcomes.test 18 局逐局零位移（硬验收——本条失败=抽取误用主 rng，立即改）；A3 指纹零机制值变化；A4 同质化扫描（意象重复清单）零告警。

**验证命令**：三件套 + era 指纹对。

**砍量预案**：池 ≥40 装不下保 24（4 季×3 段×2 变体）。

## 第 72 轮：成就三期

**目标**：成就随 V4 新机制生长，46→52+。

**前置盘点**：现读 achievements.ts 全 46 枚清单（id/条件/稀有度）逐枚对照下列候选防撞题；achievements.test 的计数断言与动态显示断言现值。

**设计决策（建议基线，偏离须记录）**：新增 ≥6 枚：手足情深（sibling 在册且 closeness≥60 达 N 年）、挚友如兄（bestFriend 维持 ≥10 年——对接 66 轮标记）、学无止境（深造跳档完成——对接 63 轮）、破镜重圆（marriage_crisis 进入后修复成功——对接 67 轮）、它们的一生（送别一只寿命 ≥12 的宠物——对接 69 轮）、倦怠突围（burnout 进入后恢复——对接 68 轮）；每枚先查防撞再定条件；稀有度按 400 局本地实测初校（79 轮终校）；**不误奖励富裕开局**：涉及资产条件的沿用 ach_young_savings 的 bg_wealthy 排除先例；条件依赖的机制若被前序轮砍量砍掉（如离婚分支未做），对应成就改条件或砍掉，账本写明。

**工作项**：①6 枚条件实现+正反测试+可达构造路线记录；②稀有度初校表；③achievements.test 计数断言同步（46→52+）。

**验收清单**：A1 每枚正反测试；A2 可达路线记录（构造 seed 或选项序列）；A3 稀有度初校表入账本；A4 成就总数动态显示断言不回归；A5 bg_wealthy 排除复核。

**验证命令**：三件套 + 400 局抽测新成就触发率。

**砍量预案**：保 4 枚核心（手足/挚友/倦怠突围/它们的一生），其余归遗留。

---

## 第 73 轮：往生录 II —— 展开式回顾（呈现阶段起点，引擎只读）

**目标**：清偿 V3 遗留⑤，让每块碑背后的一生可以被重新翻开。本轮起引擎只读不写。

**前置盘点**：现读 `src/legacy.ts`（LegacyEntry 10 字段：name/endingId/endingName/grade/age/peakMoney/epitaph/achievements/seed/finishedAt；LEGACY_CAP=50 FIFO；同 seed+终龄+endingId 去重）与写入调用点（终局时谁调 append）；EndingPage/LifeReport 的数据源（哪些可序列化摘要能在终局时快照进 legacy 条目——引擎只读消费）。

**设计决策（建议基线，偏离须记录）**：LegacyEntry V4 扩展可选字段：`keyChoices?: string[]`（≤3 条关键抉择摘录，终局时从既有报告数据取）、`peakAge?: number`、`achievementNames?: string[]`（展示用，避免展示层再查表）；**旧条目缺字段自然降级**（读到什么展示什么，不重写旧数据）。UI：墓碑条目可展开/收起（展开区=墓志铭全文+关键抉择+成就墙+五格数字），动画走既有 --dur token，键盘可达（Tab 聚焦/Enter 展开/C 折叠沿用既有键位约定——现读 keyboard_verify 的既有断言保持兼容）。

**工作项**：①类型+写入点扩展（终局快照进条目）；②展开 UI 组件；③keyboard_verify 扩展断言（展开/收起零鼠标）；④fileui_verify 扩展（两局后往生录两条+展开断言）；⑤旧条目降级测试（构造无新字段条目注入 localStorage）。

**验收清单**：A1 CDP 真实两局后展开断言（数据与对局一致）；A2 旧条目降级不露 undefined；A3 keyboard 扩展全绿；A4 file:// 验证；A5 round32_css_diff 守卫。

**验证命令**：三件套 + keyboard_verify + fileui_verify + mobile_verify。

**砍量预案**：五格数字若取数复杂，保 keyChoices+成就墙两项扩展。

## 第 74 轮：引导 II —— 焦点陷阱与细节无障碍

**目标**：清偿 V3 遗留④，把首局引导的无障碍补齐。

**前置盘点**：现读 `src/components/Tutorial.tsx`（步骤结构、跳过/完成记忆、挂载点）；fileui 2.P/6.6 既有引导断言（保持兼容）；index.css 引导浮层的 z-index 与遮罩实现。

**设计决策（建议基线，偏离须记录）**：①锁 body 滚动（浮层开启时 overflow hidden+滚动位置补偿，关闭恢复）；②焦点陷阱（Tab/Shift+Tab 循环在浮层内、开启时焦点入浮层、关闭时焦点归还触发元素）；③Esc=跳过（与既有跳过按钮同记忆语义）；④aria：浮层 role/aria-modal、步骤进度 aria-live、往生录与分享卡交互元素 aria-label 补全走查。

**工作项**：①Tutorial.tsx 四项改造；②aria 走查（清单入账本：补了哪些元素）；③keyboard_verify 扩展断言（焦点循环+Esc 跳过+记忆生效）；④mobile_verify 零回归。

**验收清单**：A1 键盘扩展全绿；A2 引导后二次进入不再出现（既有断言保持）；A3 round32_css_diff 守卫；A4 fileui 2.P/6.6 零回归。

**验证命令**：三件套 + keyboard_verify + fileui_verify + mobile_verify。

**砍量预案**：无（本身体量小；若焦点陷阱与既有 C 键位冲突，以键盘验证脚本为准调和并记录）。

## 第 75 轮：岁月长河 —— 时间轴卷轴化

**目标**：结局页人生时间轴从竖直列表升级为可漫游的岁月长河。纯组件+CSS，数据只读。

**前置盘点**：现读 EndingPage 的 life-timeline 区块（round36 改造后的 ol.life-timeline 结构：★ tl-key 金色转折年等）；history 条目字段（哪些年有什么标记——转折/丧失/里程碑分别可用什么字段过滤，缺字段的过滤项直接砍）；round36_check.mjs 既有断言。

**设计决策（建议基线，偏离须记录）**：①年代分段：按 20 代/30 代/…分组，组头粘性显示（年代+该段一句概括如「而立前后」）；②侧锚点导航（点击/键盘跳转到段首）；③过滤视图：全部/★转折/丧失/里程碑三档筛选（丧失=父母/手足/伴侣去世年——字段可用性以前置盘点为准，不可用即砍该档）；④过滤与分段叠加时空段处理（空段显示空态不消失）。

**工作项**：①分段+锚点组件；②过滤；③round36_check 扩展或新增 round75 断言脚本（分段渲染正确性+过滤互斥+键盘可达）；④三视口零溢出（375/600/1280，round32_viewport_shots 复跑）。

**验收清单**：A1 新断言全绿；A2 round36_check 零回归；A3 三视口零横向溢出；A4 键盘可达断言；A5 round32_css_diff 守卫。

**验证命令**：三件套 + round36_check + round32_viewport_shots + mobile_verify。

**砍量预案**：过滤档位按字段可用性收缩，保「全部/★转折」两档为底线。

## 第 76 轮：音景 II —— 人生阶段环境音

**目标**：声音从「事件点缀」到「氛围底色」。程序化合成、无外部资源、默认关。

**前置盘点**：现读 `src/sound.ts` 全结构（AudioContext 管理、三态音量 'off'|'low'|'high' 与增益 0.45/1、基准 PEAK、四音 API、存储键 another-life:sound 与旧 'on'→'high' 迁移）；App/GamePage 的音效调用点；mobile_verify 音效三态断言。

**设计决策（建议基线，偏离须记录）**：三段环境底噪（合成配方自定，建议方向：青年=低频 city 噪+偶发高频粒子；中年=中频暖噪+缓慢 LFO；晚年=极低频起伏+稀疏正弦簇），按 age 段切换、切换 2s 淡入淡出；独立开关（默认关）+音量跟随既有三态；存储建议新独立键 `another-life:ambient`（与 sound 键解耦，避免动既有迁移逻辑——选定写 SPEC §6.27 补注）；补 1–2 处关系里程碑音（如婚礼/子女出生，复用既有合成器风格）。

**工作项**：①合成器+三配方；②开关+持久化+设置入口（首页音效区，现读 HomePage 开关结构）；③mobile_verify 扩展断言（默认关/开启持久化/reduced-motion 下默认静音不变）；④build 自包含核对（dist 无外部音频资源——本来就地合成，核对体积增量入账本）。

**验收清单**：A1 mobile 扩展全绿；A2 默认关+跟随三态断言；A3 build 体积增量记录（预期 <10 kB 级）；A4 file:// 正常发声（fileui 抽测）。

**验证命令**：三件套 + mobile_verify + fileui_verify。

**砍量预案**：三段装不下保两段（青年/晚年）；里程碑音归遗留。

## 第 77 轮：报告印刷质感

**目标**：人生报告从「数据面板」到「装帧印刷」。全 CSS token，引擎只读。

**前置盘点**：现读 index.css 报告区 token 与类名（--paper 家族、--old-gold、评级章 .ending-grade 现状、round37_report_check 断言锚点）；round32_css_diff 守卫的基线口径（109 类名零丢失——新增类名允许，删改基线类名禁止）。

**设计决策（建议基线，偏离须记录）**：①纸纹底：多层 CSS 渐变细纹（无图片资源）；②数字排版：财务/年龄数字 tabular-nums + 衬线大数字（走既有字体栈）；③评级章精修：conic-gradient 金属光泽+虚线内圈既有结构保留；④分隔线发丝化（1px 半透明 token 色）；⑤关键数据五格的标签小字距（letter-spacing 层级）。对比度全部过 round55 AA 走查。

**验收清单**：A1 round37_report_check 零回归；A2 round32_css_diff 守卫；A3 round55_contrast 零失败；A4 三视口截图走查（round32_viewport_shots）无破版。

**验证命令**：三件套 + round37 + round55 + round32 双脚本。

**砍量预案**：无（纯样式轮；某项效果与既有断言冲突时以断言为准回退该项）。

## 第 78 轮：分享卡 II —— 往生录联动

**目标**：分享卡成为「这一生的藏书票」。

**前置盘点**：现读 `src/components/ShareCard.tsx`（1080×1440 canvas 绘制结构、toDataURL 下载、round37/54 既有断言）；legacy 计数读取入口（第 N 次人生——只读 another-life:legacy 条数）。

**设计决策（建议基线，偏离须记录）**：①雷达区放大 + 关键三属性高亮；②终龄章（右上角小印章）；③「第 N 次人生」印章（legacy 条数，无往生录时显示「第 1 次人生」）；④结局名排版精修（大字+分隔饰线）；⑤下载文件名带结局名（文件名安全字符清洗，中文保留）。

**验收清单**：A1 CDP 截图核对卡片内容与页面数据一致；A2 下载落地断言（文件名含结局名）；A3 round37/54 零回归或扩展断言；A4 375 下入口可用不破版（mobile_verify）；A5 无往生录（首次）时不报错。

**验证命令**：三件套 + round37 + mobile_verify + keyboard_verify。

**砍量预案**：印章联动若 legacy 读取在 canvas 绘制时序上有障碍，降级为卡片外 UI 显示，账本记录。

---

## 第 79 轮：千局 V4 —— 平衡终校（唯一数值轮）

**目标**：千局视野下的 V4 平衡终校。本轮只调稀有度标签数据；任何权重调整附前后对照。

**前置盘点**：第 61 轮 V4 新基线千局表（对照基准）；achievements.ts 全 52+ 枚稀有度现值；round39_balance_sim 千局参数。

**工作项**：①round39_balance_sim 跑 1000 局（新策略池全量，配比同 61 轮）；②重点观察清单逐项入账本：手足覆盖率与 sibling 事件触发率、挚友达成率与维持年数、深造链触发率、婚姻危机线触发率（与离婚率，若引入）、宠物领养率与离世覆盖、倦怠线触发率、fam_grandchild_time 与 late_story_grandchild 实测、四枚旧 0% 成就现身数、13 种结局全现、终龄/资产/结婚率相对 61 轮基线漂移；③稀有度终校：52+ 枚全表过一遍，只改 rarity 标签（legendary/epic/rare/common），触发率实测表为据；④若有权重调整：调整前后 1000 局对照，账本写明理由。

**验收清单**：
- A1 1000 局零卡死/零 NaN/零单选/零 once/保底正常。
- A2 观察清单逐项数据入账本。
- A3 稀有度全表校准记录（改了哪些、依据哪个实测数）。
- A4 13 结局全现（缺失的给出资格年统计与归因，不得静默）。

**验证命令**：`npx tsx scripts/round39_balance_sim.ts`（1000 局）、`npm test`（稀有度若入测试断言须同步）、`npx tsc --noEmit`、`npm run build`。

**砍量预案**：观察项可分两次触发完成统计（本轮先跑完出报告，若时长不够只读收工留 in_progress，下一次触发接续校准）——这是本任务书唯一允许跨触发的轮，须在账本写明两段进度。

## 第 80 轮：V4 全量体检

**目标**：交付前最后一遍全身体检，只修不扩。

**前置盘点**：check_all.mjs 现清单（15 项）；V4 各轮新增的回归脚本清单（从账本汇总）；V3 第 59–60 轮 ±2 分叉已定案（探针 seed 假阳性、非引擎缺陷）的结论记录。

**工作项**：①check_all.mjs 扩入 V4 新脚本（keyboard/mobile/fileui 扩展项若已并入原脚本则不重复挂；目标 16+ 项全绿一次通过）；②fileui_verify 扩展覆盖：往生录 II 展开回顾、引导 II（焦点陷阱）、岁月长河、分享卡 II；③save_robustness_verify 复跑并补用例：含 sibling/pet birthAge/burnout 等 V4 新字段的存档读写、无新字段旧档读写；④±2 结论复核抽测一次：受控 seed 注入法（沿用 V3 定案方法）验证「引擎+UI 位级确定」结论仍成立，抽测结果入账本（不是重新定案）；⑤确认 dist 由当前源码最后一次成功构建产出（时间戳+构建日志）。

**验收清单**：
- A1 check_all 全绿（16+ 项）或逐项如实记录失败与原因。
- A2 file:// 全流程实测：开局→选择→跨年→续档→结局→往生录 II→回首页。
- A3 新字段旧档兼容实测通过。
- A4 ±2 结论复核一致。

**验证命令**：`node scripts/check_all.mjs`、三件套、save_robustness_verify。

**砍量预案**：无（只修不扩；发现缺陷修复后重验至多 2 次，仍失败如实挂账）。

## 第 81 轮：V4 总验收与交付

**目标**：逐项验收，宣告完成。产品源码零改动（只改文档与状态）。

**工作项**：①SPEC 增补 §10c《V4 交付总览》：能力 × SPEC 章节 × 实现对照表（21 轮逐行）+ 千局 V4 终校准摘要；②README V4 重写：事件/成就/测试新计数、V4 玩法清单、脚本清单增补；③最终验收逐项报告：V1 §7 十项 + V2 七项 + V3 七项 + V4 新增项（策略库与盲区清偿/孙辈链路/教育纵深/手足系统/挚友线/婚姻深水区/倦怠线/宠物生命周期/年志生活流/时代纵深 II/成就三期/往生录 II/引导 II/岁月长河/音景 II/印刷质感/分享卡 II/千局 V4 分布）逐项通过/失败/有理由的限制；④未解决问题如实记录，不得把失败写成完成；⑤全部通过后 WORK_STATE 关账 current_round=81/completed，宣告 V4 整体完成。

**验收清单**：A1 SPEC/README 与实现一致抽查（每 V4 机制抽 1 处文档描述与代码对照）；A2 逐项验收报告完整；A3 三件套 + check_all 本轮实跑全绿；A4 WORK_STATE 关账五字段一致。

**验证命令**：三件套 + `node scripts/check_all.mjs`。

---

## 每次触发结束时的固定回报

在本次执行结果中说明：
1. 本次唯一执行的轮次（或并发让位/仅报告完成的原因）。
2. 修改了什么，涉及哪些文件。
3. 本轮验收清单逐条证据（A1、A2…通过/失败）。
4. 本次实际执行的验证命令和结果。
5. WORK_STATE.json 与 PROGRESS.md 是否完成一致更新。
6. 下一次触发应执行的轮次及入口。

报告完成后立即停止，不得继续下一轮。
