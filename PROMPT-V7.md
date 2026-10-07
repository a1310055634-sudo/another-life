# 《另一种人生》V7 计划 · 夜班任务书（第 112–126 轮）

你负责执行《另一种人生》V7：在 V5+V6（82–111 轮）交付态之上，用 15 轮把游戏往「更真实、内容更丰富」再推一层。主线七件事：**死亡窄门补现**（清偿 §10e 结构性项）、**心理健康线**、**育儿参与线**、**同事与邻里关系**（关系网首次扩出家庭圈）、**创业事件族**、**遗嘱与遗产分配**（接通血脉传承）、**年关系统**，辅以性格成长、养老方式线、「如果当初」遗憾清单、血脉家训深化、时代纵深 IV、池扩容、成就五期、千局终校收官。

**用户裁决记录（2026-10-06，全部按建议基线执行）**：
1. 创业做**纯事件族**，不建持久经营状态（business 字段留给 V8 评估）；
2. 育儿线做**轻量版**孩子去向分化（tag+文案），不改孩子系统结构、不改结局判定；
3. 死亡窄门题材**限意外/急病两类**，禁灾难/暴力/他杀题材；
4. 离婚率（5–12%）、上岸率（5–15%）两个 band 挂账**在收官轮清偿**（调权重附前后对照）。

**既有红线不变（用户 2026-10-03 裁决延续）**：灰色风险线不做（新增事件禁赌禁毒禁网贷题材，模板文案中「赌」字限于既有 trait 名「敢闯敢赌」）；同性伴侣线不做；无日历年约束（GameState 无年份字段，一切周期机制按玩家年龄锚定，禁止引入日历年字段）；存档 SAVE_VERSION 恒为 2。

项目目录：D:\vibe coding\another-life

前提：V6（第 107–111 轮）已于 2026-10-05 全部关账交付——V5+V6 整体完成，WORK_STATE=111/completed。基线快照（V6 关账，R111 实跑）：测试 **1210/73 文件**；事件池 **290**（分类 关系97/生活55/职业47/健康37/金钱34/教育20）；结局 **16** 种；成就 **59** 枚；独立存储键 **6** 个（save/legacy/sound/ambient/bloodline/tutorial）；dist 自包含 **644,315 字节**可 file://；check_all **18 项**。V7 不推翻 V1–V6 任何验收，回归网只增不减。

**快照免责**：本任务书中出现的行号、现值计数、建议参数均为 2026-10-06 写作时快照，一律以开工时文件现读为准；偏离建议参数必须在账本写明决策与理由，不得悄悄改规格让验收「通过」。

## V7 的设计依据（2026-10-06 题材扫描 + §10e 移交项，作为对照基准）

- **题材扫描实证（2026-10-06）**：①同事/邻居仅存在于事件文案提及，关系系统无 colleague/neighbor 种类；②创业仅有事件级提及（career 家里开店 family_backed、摊主岗位、合伙 rel_old_friend_success），无创业链路；③心理健康仅 burnout（职业倦怠授予制）与挚友情绪事件，无独立情绪线；④遗嘱仅 late.ts 一枚单事件（V2 R29），无分配语义、不接血脉；⑤春节/过年散见于 youth/marriage/relationship/siblings 文案，无「在哪过年」抉择层；⑥特质（trait）开局定死全程不变；⑦返聘已有（career/late），养老方式（居家/随子女/机构）抉择缺位；⑧death_young 千局 0 现身（§10e 定性：结构性不可达）。
- **§10e 移交的四类待裁决项（V7 处置）**：①late_widow_first_year priority → R126 按四档实测取中位档裁决；②fame 链可达性 → R126 数值清偿；③death_young 结构性不可达 → R112 引擎能力清偿；④工程项 5 条（round29 陈旧断言/readLegacy 字段校验/civ_line addTags 死分支/历史重复标题一组/late_widow_social_rebuild 聚合触发低）→ R126 逐项闭环。
- **band 挂账（V5 遗留，R126 清偿）**：离婚率 0.7%<5–12% 带（结构性上限=危机线 3.3%）；上岸率 1.3%<5–15% 带；留学 0% 与 yk_sudden 0% 属「真实性门槛」设计如实保留（不为触发率注水降门槛，但 R126 千局须复核并记录）。

## 任务执行规则：一次触发只做一轮

1. 每次触发时，重新读取 WORK_STATE.json、PROGRESS.md（尾部 V7 账本）、本任务书，以及当前轮次涉及的源码和测试。不要假设上次触发成功，也不要根据任务书内嵌的状态快照覆盖项目文件中的实际状态——一切以文件现读为准。
2. 开工引导：若 WORK_STATE.json 为 current_round=111 且 round_status=completed（V6 已整体交付），先把状态推进为 current_round=112、round_status=not_started、last_completed_round=111、attempts_on_current_round=1，在 PROGRESS.md 末尾（「V6 账本」段落之后）开「V7 账本」段落（格式沿用：`# V7 账本（第 112–126 轮，任务书 PROMPT-V7.md，开账日期）`），然后执行第 112 轮。若 current_round 已在 112–125 区间，按 round_status 接续（in_progress 从未完成处续做、不覆盖已有有效实现；not_started 开工本轮）。若 current_round=126 且 round_status=completed，只报告 V7 完成状态，不再修改代码。
3. 一次触发只完成 current_round 指向的一轮的实现、必要验证和进度记录，之后立即结束。明确禁止在一次触发中连续完成多轮。**唯一例外：第 126 轮（收官轮）允许跨触发分段完成**（千局终校+清偿+交付体量最大），账本必须写明两段进度。
4. 并发保护：检测到同一轮已有其他进程正在编辑（当前轮文件集 mtime 距检测时刻小于 3 分钟，或 PROGRESS.md 已出现本轮新段落而 WORK_STATE 尚未关账）时，不并行改写任何文件。对方未关账时在 PROGRESS.md 记录观察到的活跃迹象后停止本次执行；对方已关账时零写入纯报告让位，不追加会劫持「下一轮唯一入口」定位的记录。
5. 一轮只有在本轮的实现、验收和记录全部完成后才能关账。失败时保留本轮为 in_progress，在 PROGRESS.md 写明失败命令、失败原因、受影响文件和下一步；下一次触发接续这一轮。验收失败修复重验至多 2 次，仍失败则挂账收工。
6. 关账时更新 WORK_STATE.json：current_round、round_status、last_completed_round、attempts_on_current_round、last_verification 必须彼此一致。完成一轮后，只把下一轮标记为 not_started；不要顺手开始它。attempts_on_current_round 在每次接续同一轮时 +1，成功关账后清回 1。**关账双写后必须回读 WORK_STATE 核对生效（R96 写入丢失教训）**。
7. 不重置已完成的轮次，不删除用户资料与存档，不恢复旧版本覆盖新代码，不提交或推送代码（本项目无 git 仓库，保持无 git 操作），不杀既有 dev server，不为测试杀掉其他端口的服务。

## 每轮共同要求

- **开工三步**：①从 PROGRESS.md「V7 账本」找到当前轮的接续位置和已完成工作；②读本轮规格的「前置盘点」清单所列文件，确认现值与快照是否一致；③写一份本轮短执行清单（含验收清单编号）再动手。
- 遵循 SPEC.md 已有规则与验收标准；V7 的机制变化必须在同轮同步进 SPEC.md 对应章节（**沿用现读编号顺延——V6 末 §6 已到 §6.74、交付总览到 §10e，新章节一律物理追加到 §6 小节末尾，编号即物理顺序**；V7 交付总览=§10f），不得让文档、引擎、界面各说各话。
- 保持分层：规则逻辑在 src/engine，事件文本与选项数据在 src/data/events，React 组件只负责显示。
- **存档永不升版本**：V7 全程 SAVE_VERSION 恒为 2（src/engine/init.ts），禁止再动存档迁移；新增可选字段一律 validate+默认值——V7 计划中的新字段（bloodline.motto、bloodline.allocation 等）**只走独立键 another-life:bloodline 的可选字段扩展**，与存档 v2 完全隔离，禁止写入存档 v2 结构；**V7 不新增任何 localStorage 键**（终态仍 6 键，R126 验收核对）。独立键扩展必须附「旧键（无新字段）加载可读」测试。
- **随机支流纪律（违者必炸回归网）**：V7 一切新增非事件类随机（死亡窄门判定、创业成败支流、家训池抽取等）**禁止消耗主 rng 流**，一律 seed 派生独立散列或独立 mulberry32 实例（先现读 suddendeath.ts/civilservice.ts/fame.ts 的既有支流模式）。凡涉随机支流的轮次，硬验收必含：outcomes.test 的 18 局固定 seed 模拟逐局结果与改动前完全一致（零位移）。
- **18 局基线铁律**：V7 全程（112–125 轮）18 局必须零位移——新事件一律追加进 V2_NEW_EVENT_IDS 排除表并注明轮次（**三副本同步：outcomes.test / round39 / round82_stress_probe，R85 教训**），新机制一律「选择性加入」（默认关闭/缺省语义=旧行为）。**唯一豁免轮=第 126 轮**（收官数值轮：稀有度终校+band 清偿调权重，R104 先例），重录必须附逐局归因表（哪局因什么数值改动走向了不同分支），归因不清不得重录；重录后声明「V7 新基线」。
- 回归网：1210 个测试是 V6 基线，只增不减。已知硬编码锚点（新增事件/改数据的轮次必须同步并在记录中说明新计数）：health.test.ts 与 relationDecay.test.ts 的全池计数（快照 290）；各文件级计数与窗口断言（**开工现读为准**）；outcomes.test.ts 的 V2_NEW_EVENT_IDS 排除表（**现读为准**）；relationDecay.test.ts 的衰减率表（R115 加 colleague/neighbor 必须同步断言）；round32_css_diff.mjs 类名基线（**现读为准，V5/V6 已增类**）；check_all.mjs 现清单 **18 项**——改任何验证脚本步数/断言必须同轮 grep check_all 的正则并同步（R78/R80 两次教训）。
- 新增事件一律遵守：≥2 个有效选项（singleChoiceOk 白名单仍仅 hlt_body_intensive 一个，不得新增无标记单选）、once/cooldown 语义明确、不假设玩家有配偶/孩子/房产/积蓄/稳定工作/手足/特定城市/保单/名声（手足事件须 sibling 在册门控、体制内须 civil_servant 门控、名声须 fame 标记门控、城市按 city 字段门控缺省 hometown；**V7 新增门控同理：育儿线须 child 在册、同事线须 colleague 在册、遗嘱须 will_made 或年龄门控、年关线须 city≠hometown 或离乡标记、养老线须年龄窗、性格演化须对应重大标记**）；金额与现有物价感知一致（数千元=大额、数百至两千=中额、数万=重大决定、创业投入=数万级）；新事件的模拟验证沿用既有方法：真实 drawEvent + 新事件权重×50 + 错误状态从不入候选的断言；**新事件写入前先做撞题扫描并在账本记录差异化结论**（R89 car_industry_winter 撞「行业寒冬」先例）。
- 阶段隔离（V7 特有）：
  - 第 112–123 轮（机制与内容）：允许改 engine、data 与 scripts；影响数值语义的改动必须附调整前后对照模拟（至少 100 局或孪生对照，对照数据写入账本）；R126 之外严禁动 outcomes.test 18 局基线；其中 **121 轮为呈现轮（引擎只读，G10 mtime 自查）**、**123 轮为纯文本轮（era 指纹零机制值）**。
  - 第 124–125 轮（内容与校准）：data 为主+scripts；achievements.ts 允许追加条目；机制值（权重/金额/概率）不许动。
  - 第 126 轮是唯一平衡轮（允许跨触发分段）：千局终校+band 清偿+稀有度标签+工程项清偿+交付；任何权重调整须有前后对照。
- 每轮宁小勿大：一轮装不下时砍内容不砍验收，按本轮「砍量预案」执行，砍掉的部分写进账本「遗留与后续」，等后续轮或用户定夺。
- 工程坑（本机已验证，深夜必读，V1–V6 全部在册）：bash 处理中文会被 GBK 化，中文内容一律用 Read+Write+Edit 工具，不走 bash 内联（echo/sed/heredoc 写中文会毁掉中文锚点）；含 $() 的复杂脚本写成 .js/.mjs 文件再执行；浏览器验证用 headless Chrome + CDP 脚本模式，独立 user-data-dir + 高位调试端口（9227 曾被 aDrive.exe 占用，用 93xx），用完即清进程；探针导航后轮询关键计数而非定值 sleep；CDP click 后加 80ms sleep 等 React commit（React 18 DOM 刷新在微任务，同步读会假红）；终局后 App 清档——脚本读 localStorage 须在推进循环内缓存存档；跨层断言用自洽断言；effects 数组内写 summary 是类型错误，事件写完立即 tsc；事件 cooldown 由 session.chooseOption 落账（直调 applyChoice 有假象）；relationKinds 存在性检查是 OR 语义，AND 用 minCloseness 多键；Edit 文件尾追加只锚最后唯一行并把收尾原样拼回；tsx -e 中文串静默失败必须 Read+Edit；IAB evaluate 多语句须 IIFE；**weightedPick 按 priority 分层（priority>0 整层遮蔽 priority=0 新事件，加权模拟须过滤）**；**validateEvents 选项 ≤4 且 ≥2 硬上限**；**即时伤害 ≤−7 禁（致死路径用延迟大额或 R112 lethal 效果）**；**缺省路径不取整（因子=1 须原值返回）**；**追加式写入禁用 rstrip()+含原文 add 组合（index.css 整文件双写事故），追加前先跑 css_diff 确认基线干净**；**build 体积记账双口径（UTF-8 字节/UTF-16 码元，R107 教训）**；**成就判定只读 state——凡成就需读的数据必须在 state/tag 可达（bloodline 独立键不可读，需 tag 镜像）**；**SPEC 插入新章节锚正文首句、标题行绝不进 old_string（§6.36 误吞四连教训）**。
- 每轮完成前至少执行 `npm test`（基线 1210 只增不减）、`npx tsc --noEmit` 和 `npm run build`（产物须保持自包含可 file:// 打开），并加跑与本轮改动面相关的既有回归脚本（round32–37 各验脚本、mobile_verify、fileui_verify、keyboard_verify、save_robustness_verify、era 指纹工具、moment_verify——凡本轮改动可能波及的都要跑，必要时把 check_all.mjs 的清单扩入新脚本）。结果写入本轮记录，不能引用旧轮结果。
- **验收清单逐条编号给证据**：本轮规格的「验收清单」逐条编号（A1、A2…），关账时逐条给出证据（命令+关键数字/测试名），不允许「全部通过」一句话带过。
- 每轮结束时在 PROGRESS.md 的「V7 账本」记录：目标、实现文件、关键行为、验证命令及真实结果、验收清单逐条证据、遗留与后续、下一轮唯一入口。

## 阶段总览

| 阶段 | 轮次 | 主题 | 允许改动 |
|---|---|---|---|
| 一 | 112–119 | 机制与内容（致死引擎/心理/育儿/同事邻里/创业/遗嘱/年关/性格） | engine + data + scripts，数值改动附对照 |
| 二 | 120–123 | 养老与呈现（养老线/遗憾清单/血脉家训/时代纵深 IV） | 121 引擎只读，123 纯文本 |
| 三 | 124–125 | 内容收口（池扩容 290→315+/成就五期 59→65+） | data 为主 + scripts，机制值冻结 |
| 四 | 126 | 千局终校+清偿+交付（唯一数值轮，可跨触发分段） | 全域（权重调整附对照） |

---

## 第 112 轮：事件直接致死引擎与死亡窄门补现

**目标**：清偿 §10e 最大结构性项——death_young 千局 0 现身。给引擎补「事件直接致死」的最小能力，让意外与急病窄门真实可达，死亡在游戏中重新成为真实的可能性。

**前置盘点**：现读 `src/engine/outcomes.ts` death_young 判定条件现值（低龄+健康归零的确切口径）；yk_sudden 现值（R95：即时 −6+延迟 1 年 −100 次年清零——先核实该路径当前是否真能产出 death_young，§10e「结构性不可达」的准确含义以现读归因为准）；`src/engine/suddendeath.ts` 支流模式（盐 0xd34d7e5c 率 0.10）；validateEvents 效果白名单与校验入口；全池「意外/急病」撞题扫描。

**设计决策（建议基线，偏离须记录）**：①新增可选效果 `lethal`（或等效标记）：**语义=该选项结算后健康归零，走既有 checkLifeEnd 死亡路径**（不新写死亡判定代码，复用 16 结局既有判定序）；②校验器守卫（validateEvents 强制）：lethal 只允许出现在「once 事件+支流散列门控（fameChance/suddenRisk 类条件）命中后的选项」上，全池 lethal 事件 ≤2 枚，缺任一守卫即构建红；③新事件 2 枚：意外窄门（age 18–35，requires risk_taker trait 或高危工种标记，支流概率 ~0.08，选项「那一瞬间的选择」致死/「万幸躲过」重伤住院 money 大额）、急病窄门（age 30–50，requires healthRisk 高或 health 低，支流概率 ~0.06，选项「硬扛」（致死）/「立即住院」（money 数万，劫后余生））——**题材限意外/急病，禁灾难/暴力题材，文案克制不猎奇**；④yk_sudden 是否迁移 lethal 以盘点结论为准（迁移则记录决策，不迁移则两窄门并存）。

**工作项**：①lethal 效果接线（applyChoice→attrs.health=0→既有结束检查）+校验器守卫；②2 枚窄门事件+支流实现（沿 suddendeath 模式）；③death.test 或就近测试文件正反+支流确定性；④计数同步（文件级+全池+排除表三副本）；⑤千局验证 death_young 现身。

**验收清单**：
- A1 lethal 校验守卫正反（缺 once/缺支流门控/第 3 枚 lethal 均被拒绝，测试名入账）。
- A2 两窄门事件正反（年龄窗外/无 trait 门控/支流未命中不入候选；命中时选项效果落地）。
- A3 支流确定性（同 seed 同判定，主 rng 零消耗证明）。
- A4 千局（≥1000）death_young 现身 ≥1（目标 1–3% 带；不达标如实归因登记，不硬凑概率）。
- A5 outcomes.test 18 局零位移（新事件入排除表；yk_sudden 已在表内）。
- A6 三件套+计数同步证据。

**同步锚点**：SPEC §6.75（事件直接致死能力，编号现读顺延）；validateEvents；排除表三副本。

**验证命令**：三件套 + `npx tsx scripts/round39_balance_sim.ts`（≥1000 局）+ check_all。

**砍量预案**：2 枚窄门保 1 枚（意外优先）；lethal 守卫不减。

## 第 113 轮：心理健康线 —— 情绪的低谷与走出的路

**目标**：补全游戏最大真实感空白——stress 只有职业倦怠出口，「长期情绪低谷」没有着落。给低谷三条真实的路：自我调节、亲友倾诉、专业求助，求助被写成勇气而非污名。

**前置盘点**：现读 R68 burnout 授予制实现（mid_burnout_onset 模式——**纯阈值判定不可用教训，本线沿用事件授予制**）；happiness/stress 年结口径；friends.ts 情绪低位事件（撞题扫描：fri_倾诉类与本线「倾诉」的差异化=挚友单点事件 vs 状态线）；V6 R110 认知主题事件（题材边界核对）。

**设计决策（建议基线，偏离须记录）**：①状态承载=全局 tag `low_mood`（不加数值字段）；②授予事件 1 枚「看不见抓手的日子」（happiness ≤35 且 stress ≥65，广谱，weight 中低；选项「就让它沉着」（授予 low_mood+如实叙事）/「撑一撑」（不授予，stress +1））；③出路 3 枚（requires low_mood）：自我调节（cd2，happiness +2，慢路不摘 tag）、找人说说话（requires friend 或 partner 或 spouse 在册，closeness +2、happiness +3，摘 tag）、专业求助（money −800/次，happiness +4，摘 tag——文案=预约、倾诉、练习，正向非猎奇）；④天晴事件 1 枚（requires low_mood 且 happiness ≥55：摘 tag+年志「那阵子过去了」——自然恢复通道）；⑤复发语义允许（摘除后满足授予条件可再授予，cooldown 3 防刷）。**红线：不做自伤/自杀题材；文案禁说教禁羞辱；「求助=勇气」叙事定调。**

**工作项**：①mental.ts 新文件 5 事件+注册；②low_mood 门控双镜像（GATE 文案不暴露 tag id）；③mental.test 新建（授予正反/三出路效果/摘除/复发/cooldown）；④计数同步+排除表三副本；⑤文案红线自查记录（禁词表+走查）。

**验收清单**：
- A1 授予正反（幸福不够/压力不够/已有 tag 不再授予）。
- A2 三出路效果与摘除断言（含「找人说说话」无关系在册时不可达）。
- A3 天晴事件摘除断言（happiness 边界）。
- A4 文案红线自查记录（禁词零命中）。
- A5 计数同步+排除表。
- A6 ≥200 局对照：授予率落 8–15% 带、走出率 ≥50%、结局分布漂移任一 ±3pp 内、18 局零位移。

**同步锚点**：SPEC §6.76（心理健康线）；health.test/relationDecay.test 全池数。

**验证命令**：三件套 + ≥200 局对照 + round48_text_audit（新事件时代词扫描）。

**砍量预案**：出路保 2（倾诉+求助）；天晴归遗留。

## 第 114 轮：育儿参与线 —— 家长的抉择

**目标**：孩子目前只在六个里程碑上被动生长，家长是旁观者。在里程碑之间插入真实的养育抉择，并给孩子一个「去向」的轻分化——你陪过的路，会在他 18 岁那年显形。

**前置盘点**：现读 `src/engine/children.ts` 六里程碑（12/15/18/22/26/29）与 childStage 条件枚举现值；EventCondition 是否存在孩子年龄类条件（**若无，兴趣班事件的窗口改挂「玩家年龄 28–40 + child 在册」代理门控，账本记录决策**）；fam_* 既有事件全清单（V2 R26 六枚）撞题扫描；rel_child_question（含 dink 压制）现值。

**设计决策（建议基线，偏离须记录）**：①参与抉择 3 枚（全部 requires child 在册）：兴趣班的周六（child 学龄段，money −2000～−5000，child closeness +3，tag parenting_active）、青春期的门（childStage 12–15 段，抉择「坐下来谈」（closeness +4）/「给他空间」（closeness +2、stress −2））、志愿表上的字（childStage 18 段，抉择三向：尊重他的选择/帮他参谋稳一点的/全力托举梦想——各设 child_path 标记）；②去向分化标记 `child_path: academic | vocational | work`（tag 承载，轻量——不改结局判定、不改 milestones 引擎）；③去向显形 1–2 枚（child 22+ 段或玩家 50+，按 child_path 分化文案：读研的行李/技校的录用通知/第一份工资——均 ≥2 选项、小额金额）；④grandchild 上游观察项：育儿线提升亲子密度后有娃率有无变化只在 R126 千局观察，本轮不专门调参。

**工作项**：①5 枚事件（落 marriage_v5.ts 或新文件 parenting.ts——按计数纪律盘点定）；②child_path 三向分化断言；③closeness 落账断言；④计数同步+排除表三副本；⑤200 局参与率统计。

**验收清单**：
- A1 门控正反（无娃不可达/childStage 窗外不可达/dink tag 局不可达）。
- A2 child_path 三向分化文案断言（构造局逐向验证）。
- A3 closeness 落账与「给他空间」的 stress 补偿断言。
- A4 计数同步+排除表。
- A5 ≥200 局：育儿参与率落 15–30% 带（有娃资格局口径），18 局零位移。

**同步锚点**：SPEC §6.77（育儿参与线）；children 相关测试计数。

**验证命令**：三件套 + ≥200 局对照。

**砍量预案**：参与 3 枚保 2（兴趣班+志愿表）；去向显形归遗留（tag 保留，显形事件下轮可补）。

## 第 115 轮：同事与邻里 —— 关系网走出家门

**目标**：关系系统自 V3 以来第一次扩容——人生一半清醒时间在职场、楼下住着几十年的人，他们此前在游戏里没有名字。

**前置盘点**：现读 `src/engine/relations.ts` kind 清单与衰减率表（parent1/friend2 挚友1/partner1/spouse1 危机−3/child1/pet0/grandchild0/sibling1 快照）；naming 取名池模式（FRIEND_NICKNAMES/CHILD_NICKNAMES 先例）；relationDecay.test 衰减率表与全池计数断言；GATE/顶栏 relationsLine 与 relationDeltaChips 的 kind→文案映射点；同事/邻居撞题扫描（basic/career/late/relationship 文案提及处）。

**设计决策（建议基线，偏离须记录）**：①新 kind 2 个：colleague（同事，衰减 2/年，离职时 ex_ 语义转「前同事」存活不再衰减或衰减 1——选定写死）、neighbor（邻居，衰减 1/年，搬家不转移=同城语义内不处理跨城）；②取名池 COLLEAGUE_NICKNAMES/NEIGHBOR_NICKNAMES（散列支流，沿既有模式）；③入口 2 枚：工位隔壁的人（employed，add colleague）、对门搬来的一家人（adult 广谱，add neighbor）；④深化 6 枚：并肩的加班夜（closeness +3）、一个名额的竞争（抉择：公平竞争/退一步——closeness 二向+stress）、散伙饭（离职/被裁后，ex_ 转换+「以后常联系」叙事）、楼道的闲聊（closeness +2）、装修的噪音（抉择：忍了/好好说——stress 二向）、远亲不如近邻（requires neighbor closeness ≥50 且玩家遭遇负面事件 tag，互助叙事+money 小额或 stress −2）；⑤chips 文案（「和同事X熟络起来」等）+顶栏映射同步。

**工作项**：①relations kind/衰减表/取名池/validate 域扩展；②8 枚事件（落 relationship.ts 或新文件 worklife.ts——计数纪律盘点定）；③relationDecay.test 衰减率表+全池数同步；④chips/顶栏文案断言；⑤200 局覆盖率统计。

**验收清单**：
- A1 新 kind 衰减断言（衰减率表同步证据+ex_ 转换语义）。
- A2 入口正反（在职门控/重复添加 no-op/取名池确定性）。
- A3 8 事件门控矩阵（colleague/neighbor 各自存在性门控零泄漏）。
- A4 chips/顶栏文案断言。
- A5 计数同步+排除表。
- A6 ≥200 局：colleague 覆盖率（在职局口径 20–40%）、neighbor 覆盖率（全局 15–30%）、18 局零位移。

**同步锚点**：SPEC §6.78（关系网扩容）；relationDecay.test。

**验证命令**：三件套 + ≥200 局对照。

**砍量预案**：深化 6 枚保 4（各 kind 保 2）；ex_ 语义简化为「存活低衰减」。

## 第 116 轮：创业事件族 —— 辞职去试试

**目标**：辞职做生意是人生大事，现在只有「家里开店」和「合伙」的事件级提及。补一条纯事件的创业链：冲动与盘算、进账与亏损、守住与关门——不建持久经营状态（那是 V8 的体量）。

**前置盘点**：现读 family_backed（家里开店，career.ts）与 rel_old_friend_success（合伙 2 万 2 年分红 3.6 万，relationship.ts）现值——**撞题扫描定差异化：本线=主动辞职的独立创业链，家族店与合伙语义不动**；教育贷款 delayed 分期表达先例（R92 v5edu）；loseJob/startBusiness? 效果清单现读（确认无 startBusiness——创业的「身份」用 entrepreneur tag 承载，职业变动用 loseJob+后续求职语义）；金额口径（数万=重大决定）。

**设计决策（建议基线，偏离须记录）**：①6 枚（新文件 venture.ts）：辞职去创业（25–45，requires employed+moneyAtLeast 30000，risk_taker 权重加成；loseJob+money −30000+tag entrepreneur；选项二：再攒攒（不触发，happiness −1））、启动的那半年（requires entrepreneur，once，delayed 三期各 −20000 投入）、第一笔进账（requires entrepreneur，支流散列门控 ~0.5 正回馈：money +15000～+30000+「还在路上」叙事）、扩张还是守住（requires entrepreneur，once，抉择二向：扩张（delayed 大额投入+大成或大败支流）/守住（小额稳定 delayed））、关门的那天（requires entrepreneur，支流 ~0.4 或 delayed 失败落点：tag biz_failed+happiness −4+「这段路不算白走」叙事，禁羞辱化）、重新上班（requires biz_failed，求职语义衔接+academics/skills 补偿选项）；②支流盐独立（如 0x7a2e0007），主 rng 零消耗；③成败叙事均不与赌博隐喻挂钩（红线）。

**工作项**：①venture.ts 6 事件+注册；②支流实现与确定性测试；③venture.test 新建（链路正反/门控矩阵/delayed 落地）；④计数同步+排除表三副本；⑤200 局链路统计与文案自查。

**验收清单**：
- A1 链路正反（无业不可达/钱不够隐藏/entrepreneur 门控逐事件核对）。
- A2 支流确定性+成败两向落点断言。
- A3 delayed 分期落地断言（三期投入逐期到账）。
- A4 计数同步+排除表。
- A5 ≥200 局：创业参与率落 3–8% 带（少数路径真实性）、关门率落 40–60% 带、18 局零位移。

**同步锚点**：SPEC §6.79（创业事件族）；finance.test 全池数。

**验证命令**：三件套 + ≥200 局对照。

**砍量预案**：保 4 枚（辞职/第一笔进账/关门/重新上班）；扩张与启动期归遗留。

## 第 117 轮：遗嘱与遗产分配 —— 最后一次安排

**目标**：把 V2 的单枚立遗嘱事件和 V5 旗舰血脉传承接成一体：遗产流向多少、流向谁，成为玩家的决定。让「以子女之名再活一次」继承的不只是钱数，还有你的安排。

**前置盘点**：现读 late.ts 立遗嘱事件现值（撞题：升级它而非并存——升级则其旧选项语义保留或映射，账本记录）；`src/engine/bloodline.ts` 全文（inheritanceOf=min(现金×30%,50 万)、applyBloodline、bloodline 键结构六字段）；bloodline.test 现值（含三代 E2E）；child/grandchild 在册判定口径。

**设计决策（建议基线，偏离须记录）**：①遗嘱抉择事件升级/新增（60–75，once，requires money ≥50000 或 child 在册）：三向抉择——均分（bloodline.allocation='even'，child closeness +2）/多帮衬难的那个（='weighted'，child closeness −1+叙事「手心手背」）/给孙辈留一份（='grandchild'，requires grandchild 在册，否则回落 even 并在选项隐藏）；②bloodline 键扩展可选字段 `allocation`（缺省 'even'=现行语义，旧键兼容测试）；③inheritanceOf 接线：weighted ×1.3（仍 cap 50 万）、grandchild → 无孙辈时回落 even（防御式）；④子女公平感的另一面：偏重局给未偏重 child closeness −1 的同时给「这笔钱有去处」happiness +1（真实感二向，不道德说教）；⑤修改遗嘱 1 枚（requires will tag，cd5，可改 allocation）；⑥临终心愿 1 枚（age ≥73 或 health 低，纯氛围+will_made 联动文案）。

**工作项**：①bloodline.allocation 扩展+兼容测试+inheritanceOf 接线；②3 事件写入（late.ts 计数纪律）；③bloodline.test 扩展（allocation 三向/旧键缺省/无孙辈回落）；④计数同步+排除表三副本；⑤存档 v2 零改动证明（本键隔离断言沿用 R94 模式）。

**验收清单**：
- A1 allocation 三向继承额断言（even=现行值逐位一致/weighted ×1.3 封顶/grandchild 回落）。
- A2 旧 bloodline 键（无 allocation）加载=even 行为逐位不变。
- A3 closeness 二向落账断言。
- A4 存档 v2 结构零改动证明。
- A5 计数同步+排除表。
- A6 outcomes.test 18 局零位移（无遗嘱局=缺省 even=旧行为，结构性保证）。

**同步锚点**：SPEC §6.80（遗嘱与遗产分配）；bloodline.test。

**验证命令**：三件套 + fileui_verify（承继一轮走查含遗嘱）。

**砍量预案**：保遗嘱抉择+接线；修改遗嘱与临终心愿归遗留。

## 第 118 轮：年关系统 —— 今年的年在哪过

**目标**：给「过年」一个抉择层——离乡的人每年都要回答一次「回不回去」。春运、红包、亲戚的提问，中国人的年关第一次成为系统而非散落文案。

**前置盘点**：现读 city 字段与 cityIn 条件（R90）；go_big_city/stay_hometown 标记（V1 埋点）；撞题扫描逐枚列结论：youth 春节事件、marriage 过年事件、siblings 过年文案——**本线定位=「离乡者的年关抉择层」，与既有单点氛围事件差异化**；春运金额口径（数千元=大额）。

**设计决策（建议基线，偏离须记录）**：①今年的年在哪过（22–58，cd3，requires cityIn metro/province 或 go_big_city tag）：回家过年（money −1500 春运、stress −2、parent closeness +2、tag home_for_ny）/留在城市（money +2000 加班或省下、happiness −3、「一个人的年」叙事——非羞辱化，也有自在的写法二选项之一）；②亲戚的提问（requires home_for_ny，once per 授予：工资/对象/二胎三连问，抉择「打太极」（stress +1 圆过去）/「实话说」（happiness −1 但 stress −2+如释重负叙事）；子问题按婚姻/生育状态门控显示——已婚者不问对象、已育者不问二胎）；③留城的年夜饭（requires 留城 tag：一人食/被同事邀请过个年（requires colleague 在册——R115 联动）二向）；④无日历年约束：年关按年龄锚定触发（cd3 轮转），不引入年份。

**工作项**：①3 事件（落 city.ts 或新文件 newyear.ts——计数纪律定）；②子问题条件显示逻辑核对（选项级门控）；③R115 colleague 联动断言；④计数同步+排除表三副本；⑤200 局触发率与回家/留城分布。

**验收清单**：
- A1 门控正反（在乡者不可达/子问题状态门控逐条）。
- A2 回家/留城二向效果与 tag 落账断言。
- A3 与 colleague 在册联动断言（无同事时该选项隐藏）。
- A4 计数同步+排除表。
- A5 ≥200 局：年关线触发率落 10–20% 带（离乡资格局口径）、回家/留城比例非一边倒（任一向 ≥25%）、18 局零位移。

**同步锚点**：SPEC §6.81（年关系统）；撞题扫描结论入 SPEC 补注。

**验证命令**：三件套 + ≥200 局对照。

**砍量预案**：保「在哪过」+「亲戚的提问」；留城年夜饭归遗留。

## 第 119 轮：性格成长 —— 你变了

**目标**：特质开局定死全程不变，「人生改变一个人」无处发生。补一个轻的「你变了」时刻——重大经历之后，你可以承认自己不再是十八岁的那个性子。轻机制、纯增量、缺省=旧行为。

**前置盘点**：现读 traits.ts 六特质与 GATE_TAG_LABELS（确认本roul **不改特质本体与判定逻辑**——演化=文案层+tag）；重大标记清单现值（been_deep_debt/divorced/biz_failed（R116 新增）/V6 丧偶线 tag/marriage_crisis 愈合等——盘点「够重」的标记最少集）；「性格/性子」撞题扫描（2026-10-06 扫描零命中=题材空白确认）。

**设计决策（建议基线，偏离须记录）**：①「你变了」事件 1 枚（requires 上列重大标记之一（tagsAny），once，age ≥30）：抉择「承认自己变了」（addTags persona_shifted+happiness +2+与旧特质和解的叙事——按所触发的标记分化 2–3 种文案支）/「我还是我」（不授 tag+happiness 不变+倔强的温柔叙事）；②回响事件 1 枚（requires persona_shifted，cd6：「老朋友说你也变了」——他人视角回望，closeness +2）；③trait 本体、GATE 判定、创建页零改动（A2 钉死）；④不做特质替换、不做数值重排——演化是叙事层的。

**工作项**：①2 事件（落 basic.ts 或新文件——计数纪律定）；②标记触发的文案支断言（构造 3 种来源标记局）；③计数同步+排除表三副本；④200 局授予率统计。

**验收清单**：
- A1 正反（无重大标记不可达/once 语义/两向效果）。
- A2 traits.ts 与 GATE 判定零改动证明（diff/mtime 证据）。
- A3 文案支按来源标记分化断言。
- A4 计数同步+排除表。
- A5 ≥200 局：授予率落 5–10% 带，18 局零位移。

**同步锚点**：SPEC §6.82（性格成长）；文案支清单入 SPEC。

**验证命令**：三件套 + ≥200 局抽测。

**砍量预案**：保「你变了」主事件；回响归遗留。

## 第 120 轮：养老方式线 —— 怎么老去

**目标**：晚年只有「退休金+返聘」还不够真实——养老去哪儿住、跟谁住，是这一代人真实的家庭议题。给晚年一个方式的抉择，让此后的晚年事件有各自的居所语境。

**前置盘点**：现读 late.ts 晚年事件全清单（**撞题扫描必须逐枚列差异化结论**：适老化改造（V2 R29）=居家内部改造，本线=居所方式抉择层；搭伴同居=婚姻线；返聘=职业线）；retired/age 门控现值；money 门控口径（养老机构费用=数万/年）。

**设计决策（建议基线，偏离须记录）**：①怎么老去（60–72，once）：居家养老（tag elder_home，缺省感最轻）/和子女一起住（requires child 在册，tag elder_with_child，closeness +2 但 happiness −1 的二向真实感——或选项内分化）/去养老院（moneyAtLeast 200000，tag elder_institution，money −30000 押金语义）；②后续事件 3 枚（requires 各 tag，cd4）：养老院的黄昏（棋友/想家抉择）、一屋两代（摩擦与温情二向）、家里的改动（居家版：扶手与夜灯，与适老化改造事件差异化=纯氛围小额）；③方式 tag 不改任何既有晚年事件的可达性（纯增量层，A 钉死——避免劫持 39 段后记与晚年事件网）。

**工作项**：①4 事件（late.ts 计数纪律）；②三向 tag 门控矩阵断言；③既有晚年事件可达性零变化证明（回归断言：构造三向 tag 局逐枚核对既有事件候选集不变）；④计数同步+排除表三副本；⑤200 局覆盖率。

**验收清单**：
- A1 三向门控正反（钱不够机构隐藏/无子女随住隐藏/once 语义）。
- A2 后续事件按 tag 分化断言（跨 tag 零泄漏）。
- A3 既有晚年事件可达性零变化断言（测试名入账）。
- A4 计数同步+排除表。
- A5 ≥200 局：抉择覆盖率落 20–40% 带（有资格局口径）、18 局零位移。

**同步锚点**：SPEC §6.83（养老方式线）；撞题差异化结论入账本。

**验证命令**：三件套 + ≥200 局对照。

**砍量预案**：后续 3 枚保 2；「家里的改动」归遗留（与适老化改造合并评估）。

## 第 121 轮：「如果当初」遗憾清单（呈现轮，引擎只读）

**目标**：结局页新增一张克制的卡——站在人生终点回望关键岔路口，「如果当初」不是悔恨的鞭子，而是对另一条路上那个自己的遥望。纯呈现，引擎零改动。

**前置盘点**：现读 EndingPage 结构与「人生转折」板块（R75 岁月长河/R77 报告改版现值）；HistoryEntry key/choice 字段（key:true 且 choice 非空=玩家真实选择过的转折）；事件表 choices 数据可达路径（按 eventId 查同事件其他选项的文本——只读 data）；reduced-motion 约定现值；keyboard/mobile 验证脚本现步数（**现读为准**）与 check_all 对应正则。

**设计决策（建议基线，偏离须记录）**：①「另一条路上」卡：取 key 转折条目至多 3 条，每条下挂一行「如果当初——{同事件其他可见选项之一的短摘要}」（措辞克制：以「另一条路上的人」视角，禁「你本应该」式追责语气）；②数据源=history+事件表只读查询（引擎不写）；空履历/无 choice 转折→整卡不渲染（降级）；③至多 3 条+折叠展开交互（沿 R73 往生录展开模式，aria-expanded）；④reduced-motion 压平；⑤css 新类登记 round32_css_diff 允许清单。

**工作项**：①对照卡组件+样式；②CDP 真实局断言（至多 3 条+内容⊆事件表选项文本）；③keyboard/mobile 断言扩展+check_all 正则同轮同步；④css_diff GUARD；⑤file:// 抽测。

**验收清单**：
- A1 CDP 真实局渲染断言（条数上限+文本来源合法）。
- A2 降级断言（无转折选择年→卡不渲染，无 NaN/空节点）。
- A3 keyboard/mobile 扩展全绿+check_all 正则同步（grep 证据）。
- A4 css_diff GUARD PASS。
- A5 引擎零改动证明（src/engine mtime 开工/关账对比，G10）。
- A6 三件套+file:// 抽测。

**同步锚点**：SPEC §6.84；check_all 正则。

**验证命令**：三件套 + keyboard_verify + mobile_verify + fileui_verify + check_all。

**砍量预案**：折叠交互砍为直出（至多 3 条静态列表）；条数上限不减。

## 第 122 轮：血脉深化 —— 家训与家族编年

**目标**：让世代传承从「遗产+姓氏」长出「家」的纵深感：承继开局时选一条家训（祖先留下的，不是系统发的），承继面板能看到这条血脉走了几代、每代叫什么。

**前置盘点**：现读 `src/engine/bloodline.ts` 六字段结构（generation/surname/inheritanceMoney/ancestorName/ancestorEndingId/finishedAt）与 applyBloodline；App.handleStartBloodline 与 CreationPage 承继入口（R94/R121 现值）；LegacyEntry.generation 碑文标记（R94）；**成就只读 state 约束——家训选中后须同步 state tag（motto_set 或 motto_{id}）供 R125 成就读取，bloodline 键本身成就系统读不到**。

**设计决策（建议基线，偏离须记录）**：①家训池 6 条（固定文案，各绑定一个开局微效果： happiness+1 或指定属性 +1，二档写死；选中写入 bloodline.motto（可选字段，旧键缺省无 motto=无效果=旧行为）+state tag motto_set）；②承继开局流程：承继按钮→家训三选一（从 6 条池散列抽 3，支流不耗主 rng）→确认→开局（属性微效果+tag+编年面板）；③家族编年：CreationPage 承继入口处显示「第 N 代 · 祖先 XXX · 家训 XXX」摘要行（数据=bloodline 键+legacy 碑文 generation 链，只读）；④非承继局零接触=结构性零位移（A 钉死）；⑤bloodline 键扩展两个可选字段（motto 等），附旧键兼容测试。

**工作项**：①bloodline 扩展+applyBloodline 微效果接线；②家训池数据+散列三选一；③CreationPage 编年摘要+选择 UI；④bloodline.test 扩展（motto/编年/旧键兼容/微效果）；⑤三代 E2E 扩展（gen 1→2→3 编年与家训断言）。

**验收清单**：
- A1 家训三选一落地+微效果断言（同 seed 两次开局一致）。
- A2 旧 bloodline 键（无 motto）承继=现行行为逐位不变。
- A3 编年渲染断言（三代 E2E：generation 链+祖先名+家训逐代正确）。
- A4 存档 v2 零改动证明；非承继局零位移证明。
- A5 支流确定性（家训三选一同 seed 同结果）。
- A6 三件套+fileui 走查（承继一轮含家训）。

**同步锚点**：SPEC §6.85（血脉深化）；bloodline.test。

**验证命令**：三件套 + fileui_verify + 三代 E2E 脚本。

**砍量预案**：编年面板砍为承继入口一行摘要；家训池 6→3。

## 第 123 轮：时代纵深 IV（纯文本轮）

**目标**：V7 七条新线（致死/心理/育儿/同事邻里/创业/遗嘱/年关）需要时代词覆盖审计与氛围补密。纯文本轮，机制值零变化。

**前置盘点**：跑 `npx tsx scripts/age_heatmap.ts` 实测最薄桶（V7 前十二轮扩池后现值）；era_audit 词表现值（**V5 R101 已加考公上岸/灵活就业/直播带货等——新词表必须先现读去重**）；round48_text_audit 现值。

**设计决策（建议基线，偏离须记录）**：①词表 +8（候选：反向春运/电子红包/鸡娃/内卷/心理咨询/断舍离/银发经济/数字遗产——**现读去重后定稿**）；②纯氛围事件 3–4 枚定向补最薄桶（写法沿 youth_livehouse/mid_nav_memory 蓝本：≥2 选项、金额零或小额、无机制效果、题材从 V7 新线取材：年货快递到家/给父母的智能手机教学 II/小区团购群/凌晨的招聘软件——撞题扫描后定）；③era_fingerprint + era_fp_compare 指纹对跑：零机制值变化（剥除 delayed.summary）。

**工作项**：①词表 +8 与全池扫描报告（矛盾=0 才过关）；②3–4 氛围事件+注册；③era 指纹对跑；④计数同步+排除表三副本。

**验收清单**：
- A1 词表现读去重证明（+8 全为新词）。
- A2 时代词扫描零矛盾（round48_text_audit 退出码 0）。
- A3 era 指纹零机制值变化（剥 delayed.summary，diff 证据）。
- A4 计数同步+排除表。
- A5 outcomes.test 18 局零位移；热力图前后对比表入账本。

**同步锚点**：SPEC §6.42 补注（时代纵深 IV 小节，编号现读顺延）。

**验证命令**：三件套 + era 指纹对 + age_heatmap + round48_text_audit。

**砍量预案**：氛围事件保 2；词表保 +5。

## 第 124 轮：事件池扩容收尾 —— 新线互联动（290→≥315）

**目标**：V7 七条新线已立，把老线薄处与新线接点补齐——事件之间的化学反应才是丰富度的本体。

**前置盘点**：全池现值实测（R112–R123 扩池后）；age_heatmap 最薄桶；文件级最薄清单（marriage/friends/pets/parents 的 V7 现值）；千局触发率长尾清单（round39 现值）。

**设计决策（建议基线，偏离须记录）**：①新线联动 ≥10 枚（每枚吃两条线的交点，全部 ≥2 选项+资格门控红线+金额口径一致）：创业×婚姻（一方辞职另一方的态度——requires entrepreneur+spouse/partner）、创业×年关（创业后的第一个年，回家腰杆/硬撑二向）、心理×职场（低谷期的工作日——requires low_mood+employed）、育儿×城市（孩子与大城市——requires parenting_active+cityIn metro）、同事×名声（同事刷到你的号——requires colleague+minor_fame）、遗嘱×手足（遗嘱之后兄弟姐妹的饭桌——requires will tag+sibling 在册）、养老×手足（谁离父母近——requires elder_* tag+sibling 在册）、性格×创业（关門之后的你——requires biz_failed+persona_shifted）、年关×血脉（带着孩子回你的老家——requires home_for_ny+child 在册）、邻里×养老（对门的年轻人搭把手——requires neighbor+elder_home）；②老线薄桶定向 ≥15 枚（marriage+3/friends+2/pets+2/parents+2/通用热力图定向 ≥6——实测为准）；③全部撞题扫描先于写入。

**工作项**：①撞题扫描与定向清单定稿（先列后写）；②≥25 枚按文件归属写入+注册；③全部计数同步（各文件级+全池+排除表注明轮次）；④age_heatmap 前后对照；⑤200 局抽测出触发率长尾改善表。

**验收清单**：
- A1 池计数 ≥315+各文件新计数表。
- A2 排除表三副本追加（注明轮次）。
- A3 联动事件两线交点门控断言（抽 5 枚构造局验证缺一线即不可达）。
- A4 撞题扫描记录；A5 触发率长尾改善表；A6 outcomes.test 18 局零位移。

**同步锚点**：各文件测试计数同步；health.test/relationDecay.test 全池数。

**验证命令**：三件套 + 200 局抽测 + age_heatmap。

**砍量预案**：保 18 枚底线（联动 ≥8+老线 ≥10），砍掉主题写遗留。

## 第 125 轮：成就五期 —— V7 机制成就（59→≥65）

**目标**：成就随 V7 新线生长，每枚都有真实的构造路线。

**前置盘点**：现读 achievements.ts 59 枚全清单（防撞题）；V7 新机制成就钩子清单（lethal 窄门/low_mood 摘除/parenting_active/child_path/colleague/neighbor/entrepreneur/biz_failed/will tag/home_for_ny/persona_shifted/elder_*/motto_set）；**成就只读 state——bloodline 键不可读，motto 成就须读 motto_set tag（R122 已镜像）**。

**设计决策（建议基线，偏离须记录）**：新增 ≥6 枚：白手起家（entrepreneur+未 biz_failed+money ≥100000，rare）、求助的勇气（曾 low_mood 且现无 low_mood+happiness ≥50，rare——「曾」语义用 resume 式双标记或 onset 标记实现，盘点定）、良师父母（parenting_active+child closeness ≥75，rare）、远亲不如近邻（neighbor closeness ≥70，common）、十年归途（home_for_ny+age ≥45+parent closeness ≥60，common）、家风相传（motto_set+generation tag N≥2，epic——血脉局专属）、安其所（elder_* 任一 tag+happiness ≥60，rare）；稀有度 400 局初校（R126 终校）。

**工作项**：①≥7 枚条件实现+正反测试；②achievements.test 计数断言同步（59→新值）+动态显示不回归；③可达构造路线记录（构造 seed 或选项序列）；④400 局抽测出稀有度初校表。

**验收清单**：
- A1 每枚正反+可达构造路线记录。
- A2 稀有度初校表入账本。
- A3 成就计数断言同步+动态显示不回归。
- A4 400 局抽测触发率表。

**同步锚点**：SPEC §6.86；achievements.test。

**验证命令**：三件套 + 400 局抽测。

**砍量预案**：保 5 枚（白手起家/求助的勇气/良师父母/远亲不如近邻/家风相传）。

## 第 126 轮：千局 V7 终校+挂账清偿+全量交付（唯一数值轮，允许跨触发分段）

**目标**：千局视野下的 V7 平衡终校；清偿 §10e 与 V5/V7 全部可清挂账；全量体检与交付宣告。这是 V7 唯一允许动数值语义、唯一允许 18 局基线重录的轮。

**前置盘点**：R103/V6 千局基线现值；achievements 稀有度现值与 R125 初校表；§10e 四类移交项现值；check_all.mjs 现清单（18 项）。

**工作项**：
1. **千局 1000 局全量**（现役策略池，零异常门槛）：零卡死/零 NaN/零单选/零 once 违规/保底正常。
2. **观察清单逐项入账本**：16 结局全现+death_young 现身率（R112 延伸验收）；心理线授予/走出率 vs 8–15%/≥50% 带；育儿参与率 vs 15–30% 带；创业参与/关门率 vs 3–8%/40–60% 带；年关触发与回家留城比；养老抉择覆盖率 vs 20–40% 带；性格授予率 vs 5–10% 带；终龄/资产/幸福 vs V6 基线漂移。
3. **band 清偿（用户已批，权重调整附前后 1000 局对照）**：离婚率 →5–12% 带（marriage_v5 危机线密度或权重微调）；上岸率 →5–15% 带（civ 链权重/资格微调）；fame 可达性 →4–10% 带复核（R110 消退线后的净值）。
4. **稀有度终校**：≥65 枚全表过一遍，只改 rarity 标签，实测表为据。
5. **§10e 工程项逐项闭环**：round29 两条陈旧断言修复/readLegacy 字段校验补齐/civ_line addTags 死分支移除/历史重复标题一组消解/late_widow_social_rebuild 聚合触发率如实复核；late_widow_first_year priority 按 §6.73⑤ 四档实测取中位档裁决（理由入账本）。
6. **check_all 分档**：拆 quick（三件套+css_diff+对比度）/full（全项）两档入口，默认 full 不变——只加快捷入口不改任何断言。
7. **交付文档**：SPEC 增补 §10f《V7 交付总览》（15 轮能力×章节对照表+千局 V7 终校准摘要）；README V7 重写（池/成就/结局/测试新计数+V7 玩法清单+脚本清单增补；存储键仍 6 键核对）；WORK_STATE 关账 current_round=126/completed。

**验收清单**：
- A1 1000 局零卡死/零 NaN/零单选/零 once/保底正常。
- A2 观察清单逐项数据入账本（带内/带外如实标注）。
- A3 band 清偿前后对照表（离婚/上岸/fame 三项，改动+对照数据）。
- A4 稀有度全表校准记录（改了哪些、依据哪个实测数）。
- A5 工程项逐项闭环记录（5 条+widow priority 裁决=6 项，逐项「改了什么/证据」）。
- A6 check_all quick/full 双档实测（两档退出码 0，时长各入账）。
- A7 SPEC §10f+README 一致性抽查+18 局基线重录逐局归因表（若动数值）+WORK_STATE 关账五字段一致。

**验证命令**：`npx tsx scripts/round39_balance_sim.ts`（1000 局×前后）、三件套、`node scripts/check_all.mjs`（full+quick）。

**砍量预案**：允许跨两次触发完成（本任务书唯一跨触发轮）：第一段千局+观察+清偿，第二段文档+总闸+关账；账本写明两段进度。

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
