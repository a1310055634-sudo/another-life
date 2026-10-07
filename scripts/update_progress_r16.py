# -*- coding: utf-8 -*-
# 第 16 轮收尾：更新 PROGRESS.md（头部 + 轮次表第 16 行 + 执行记录追加）
import io

P = 'PROGRESS.md'
s = io.open(P, encoding='utf-8').read()

# 1) 头部「最后更新 / 上次验证」
old_head_start = s.find('最后更新：')
old_head_end = s.find('\n| 轮次 |')
assert old_head_start > 0 and old_head_end > old_head_start, 'header anchors not found'
new_head = (
    '最后更新：2026-09-27（第 16 轮完成：晚年内容扩充——16 个新事件（池 105→121，8 个读中年及以前标记）'
    '+ 6 个晚年成就（总 31 个）+ 退休机制补齐（Effect.retire 事件提前退休 / 到 65 岁年度结算自动退休 / '
    '退休金按最后年薪 40% 折算、12,000～60,000 保底封顶、提前退休 0.32）+ 顶栏「已退休（年退休金 X 万）」展示，'
    '测试 382→415，详见执行记录末条）\n'
    '上次验证：`npm test` 415/415 通过（新增 late.test.ts 33 个：16 事件 validateEvents 与 51+ 年龄边界/'
    '六类别主题/中年标记读取审计写死 8 事件名单/事件级门控 7 组含单身 relationKindsNone 与低收入 moneyBelow/'
    '选项级金额门槛 4 组/退休机制 5 项（retirePatch·折算边界·65 岁自动退休 key 履历·事件提前退休 0.32 折算）/'
    '效果落地 5 项按原始下标（手术根治·戒烟·回忆录·帮带孙辈·互助社领宠）/6 成就正反判定与解锁幂等/'
    '三线（富足在职·单身清贫零工·已退休）51 岁固定 seed 玩到终局：phase ended、validateState 干净、'
    '保底年份 ≤2 事件池无耗尽、once 零重复、三线晚年候选集互有分化且并集 ≥8）；'
    'health.test 池断言 105→121；`npm run build`（277.40 kB）与 `npx tsc --noEmit` 通过；'
    'UI 真实点击冒烟（复用 5204 dev server）：农家+野心家「陆晚晴」18→75 岁一整局玩到终局「一生走完」，'
    '52 岁「退休申请表」真实点击提前退休（顶栏变「已退休（年退休金 1.9 万）」，0.32 折算正确），'
    '晚年真实出现 8 个本轮新事件（退休申请表/胸片上的疑点/小店的下一步/欠了半辈子的体检/车间里的年轻人/'
    '柜子底的旧相册/退休金的算术题/浴室里的防滑垫），成就「桃李晚年」65 岁、「一本回忆录」67 岁自然解锁，'
    '终局时间线 70 件事无剧情矛盾，全程无 vite 错误遮罩\n'
)
s = s[:old_head_start] + new_head + s[old_head_end:]

# 2) 轮次表第 16 行
old_row = '| 16 | 晚年事件内容 | 未开始 | |\n'
assert old_row in s, 'round 16 row not found'
new_row = ('| 16 | 晚年事件内容 | 已完成 | late.ts 16 事件（池 105→121，8 个读中年及以前标记，'
           '覆盖单身/低收入/无固定职业晚年）+ 6 晚年成就（25→31）+ 退休机制（Effect.retire/65 岁自动退休/'
           '退休金折算）+ late.test.ts 33 测试；UI 18→75 岁一局到终局实测（详见执行记录末条） |\n')
s = s.replace(old_row, new_row)

# 3) 执行记录追加（文件末尾）
entry = (
    '\n- 2026-09-27（第 16 轮，第 1 次尝试，23:10～次日 00:40）：晚年内容扩充完成，测试 382→415。主要改动：\n'
    '  - **退休机制补齐（本轮开工时发现的引擎缺口）**：`retired` 职业状态此前只有类型定义与压力漂移分支，'
    '全项目没有任何机制能让角色真正退休。新增 career.ts：`RETIRE_AGE=65`/`RETIRE_PENSION_MUL=0.4`/'
    '`EARLY_PENSION_MUL=0.32`/`PENSION_MIN=12000`/`PENSION_MAX=60000`/`pensionFromSalary`/`retirePatch`；'
    'types.ts Effect 新增 `retire: { mul? }` 并在 events.ts applyChoice 接线；settleCareerYear 到 65 岁自动退休'
    '（先于涨薪/晋升判定，key 履历「退休」+ 年志提示）；CareerYearResult 新增 addTags/removeTags 并在 lifecycle '
    '落账（首轮测试抓出「自动退休后 retired/ex_ 标记未落账」缺陷，即此修复）；validateEvents 把 retire 纳入'
    '「仅在职生效」检查；GamePage 顶栏 retired 显示「已退休（年退休金 X 万）」。'
    '退休当年收入切为退休金（不拿当年年薪），压力自然回落 -4/年。\n'
    '  - `src/data/events/late.ts`：16 个晚年事件（retirement_paperwork/empty_nest/growing_old_together/'
    'single_golden/grandchild/overseas_call/mentor_visit/second_surgery/quit_smoking/health_debt/'
    'age_friendly_home/mentor_young/dream_legacy/shop_handover/memoir/tight_years），主题覆盖退休准备/'
    '关系/健康/传承/回顾+晚年生计六类别；8 个读中年及以前标记（mentor_young←cert_track·mentor_bond、'
    'second_surgery←chronic_pain、quit_smoking←light_smoker、health_debt←avoided_doctor、'
    'shop_handover←shop_dream、overseas_call←overseas_bond·studied_abroad·exchanged、'
    'mentor_visit←repaid_mentor·mentor_bond、dream_legacy←dream_full·side_creates·dream_bloom·artist_path）；'
    '边缘处境覆盖：单身晚年（single_golden 读 relationKindsNone）、低收入晚年（tight_years 读 moneyBelow 20000）、'
    '无固定职业晚年（tight_years 与零工收入模型）；并补第 15 轮遗留缺口——chronic_pain 未手术者晚年二次手术出口'
    '（late_second_surgery，根治走 health_comeback 同款语义）。\n'
    '  - achievements.ts 25→31：桃李晚年/掐灭最后一支烟/一个人的丰盈（60+ 无存活伴侣且幸福≥60）/'
    '隔代的疼爱/热爱有了传人/一本回忆录。\n'
    '  - 测试：late.test.ts 33 个；health.test.ts 池断言 105→121；npm test 415/415（16 文件）、'
    'npx tsc --noEmit 干净、npm run build 277.40 kB（263.85→277.40）。\n'
    '  - **三线到终局（固定 seed 20260916，51 岁起）**：A 富足在职线（12 万薪+有房有娃）74+ 岁自然走完、'
    '终局必 retired；B 单身清贫零工线（旧伤+体检债+小店梦，8 千存款）60+ 岁终局、late_tight_years 真实进候选；'
    'C 已退休线（退休金 2.4 万+老伴+小店交接）65+ 岁终局；三线 validateState 全程干净、保底年份 ≤2'
    '（晚年事件池无耗尽）、once 事件零重复登记、三线晚年候选集合互有分化（并集 ≥8）。'
    '机械策略改为「按年轮换候选」（cands[year % len]），避免固定选第一个把池尾晚年事件饿死。\n'
    '  - **UI 真实点击冒烟（复用 5204 dev server，未新建端口、未杀进程）**：农家+野心家「陆晚晴」创建开局，'
    '页面侧 MessageChannel 推进器（本轮新方法：宏任务不受 IAB 后台 setTimeout 深度节流影响，'
    '且规避 React 18 异步渲染导致的同步循环读旧 DOM 问题，单次 evaluate 瞬时推进一年）真实点击推满 '
    '18→75 岁一整局到「一生走完」终局页；52 岁「退休申请表」真实点击「提前办了」→顶栏变'
    '「已退休（年退休金 1.9 万）」（59k 薪 ×0.32 折算正确）；晚年履历实测出现 8 个本轮新事件'
    '（退休申请表 52/胸片上的疑点 55/小店的下一步 60/欠了半辈子的体检 63/车间里的年轻人 65/'
    '柜子底的旧相册 67/退休金的算术题 68/浴室里的防滑垫 73）+ 老年大学/越来越少的聚会/你陪他们变老等存量晚年事件；'
    '成就「桃李晚年」65 岁、「一本回忆录」67 岁自然解锁；终局时间线 70 件事无剧情矛盾；全程无 vite 错误遮罩。\n'
    '  - **环境备忘**：5203 dev server 已死；5204 为本项目在存活的 dev server 且 HMR 正常，本次全程复用；'
    '首页 getByRole 点击超时复现第 15 轮已知 React 竞态，统一改 evaluate 内 element.click()（推进器内部同理）。\n'
    '  - **留给第 17 轮（结局系统）**：≥10 种结局 + 判定优先级 + 结局总结引用真实经历 + 核查 20 成就可解锁'
    '（当前已 31 个）。可用的晚年维度：retired 标记与退休金、memoir/dream_legacy/quit_smoking/late_mentor 等新标记、'
    'deep debt 晚年（本轮 UI 局终局 -50 万深债）——结局表可覆盖「晚景凄凉/普通暮年/从容退休/桃李满门」等梯度；'
    '退休金 40% 折算与负债晚年的数值平衡建议在第 20 轮 500 局批量模拟统一调。\n'
)
s = s.rstrip() + '\n' + entry

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('PROGRESS.md updated, len =', len(s))
