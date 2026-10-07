// 《另一种人生》核心类型定义
// 规则与界面分离：本文件及 engine/ 下代码不依赖 DOM

/** 五维属性键 */
export type AttrKey = 'health' | 'happiness' | 'smarts' | 'social' | 'stress'

export type Attributes = Record<AttrKey, number>

export type EducationLevel =
  | 'junior'      // 初中（18 岁未升学）
  | 'highschool'  // 高中/中职
  | 'college'     // 大专
  | 'bachelor'    // 本科
  | 'master'      // 硕士
  | 'phd'         // 博士

/** 学生在读阶段（第 8 轮起由教育系统真正使用） */
export type StudentStage = 'highschool' | 'college' | 'bachelor' | 'master' | 'phd'

/** 技能：学业功底（应试/理论）与职业技能（实操/手艺），0～100 */
export type SkillKey = 'academics' | 'vocational'

export type CareerKind = 'student' | 'employed' | 'unemployed' | 'retired' | 'none'

export interface StudentState {
  kind: 'student'
  stage: StudentStage
  yearsLeft: number
}

export interface EmployedState {
  kind: 'employed'
  jobId: string
  jobTitle: string
  level: number          // 职级，从 1 开始
  salary: number         // 年收入（元；第 22 轮起由公式化年薪推导落账）
  yearsAtJob: number
  /**
   * 存量调薪倍率（第 22 轮，可选，默认 1）：降薪/加薪事件的持久乘数，
   * 参与公式化年薪推导（夹 0.5～2）。缺省视为 1。
   */
  salaryMul?: number
}

export interface UnemployedState {
  kind: 'unemployed'
  weeks: number          // 失业周数累计
}

export interface RetiredState {
  kind: 'retired'
  pension: number        // 年退休金（元）
}

export type CareerState =
  | StudentState
  | EmployedState
  | UnemployedState
  | RetiredState
  | { kind: 'none' }

/**
 * 房贷（第 23 轮）：等额本息贷款的真实余额模型。
 * 仅在"确实贷款购房"的选择上建立；全款购房、出资翻修老屋不建立。
 * 存在即意味着 balance > 0，还清即从状态中移除（字段缺省 = 无贷款）。
 */
export interface MortgageState {
  /** 贷款本金总额（元） */
  principal: number
  /** 剩余本金余额（元，> 0） */
  balance: number
  /** 固定年供（元/年，等额本息，可预期） */
  annualPayment: number
  /** 剩余还款年限 */
  yearsLeft: number
}

/**
 * 商业保险保单（第 85 轮）：投保事件建立，商保理赔（确诊给付）时终结。
 * 简化语义——生效至出险、续期不模拟（annualPremium 留档位供文案/平衡参照）。
 */
export interface InsurancePolicy {
  /** 年缴档位（元/年，投保事件按年龄分档收取首年） */
  annualPremium: number
  /** 保额（元）：理赔一次性划入 */
  benefit: number
  /** 投保时玩家年龄（盖章） */
  purchasedAtAge: number
}

/**
 * 房产（第 86 轮）：购房事件建立，卖出事件注销。
 * basis=购入总价（成本基础），value=现值（年度结算按 HOME_APPRECIATION 复利，
 * 纯确定性不消耗 rng），purchasedAtAge=购入时玩家年龄（盖章）。
 * 只动 value 不动现金——资产曲线/报告的现金口径不变。
 */
export interface HomeProperty {
  /** 购入总价（元，成本基础） */
  basis: number
  /** 现值（元，年结复利） */
  value: number
  /** 购入时玩家年龄（盖章） */
  purchasedAtAge: number
}

/**
 * 基金定投持仓（第 87 轮）：定投事件建立，赎回事件（止盈/割肉）注销。
 * units=当前市值（年结先划扣定投再乘牛熊收益）；market 不进存档——
 * 牛熊序列由 seed 派生独立支流确定性重放（engine/fund.ts marketAt）。
 */
export interface FundHoldings {
  /** 年定投档位（元/年；钱不够的年份断供，份额照吃收益） */
  annualContribution: number
  /** 当前市值（元，年结随牛熊波动） */
  units: number
}

/** 城市层级（第 90 轮）：hometown 老家（缺省）/province 省城/metro 一线 */
export type CityTier = 'hometown' | 'province' | 'metro'

export type RelationKind =
  | 'parent' | 'friend' | 'partner' | 'spouse' | 'child' | 'pet' | 'grandchild' | 'sibling'
  | 'colleague' | 'neighbor'

export interface Relation {
  id: string
  kind: RelationKind
  name: string
  closeness: number      // 0～100
  alive: boolean
  /** 关系破裂标记（疏远/断绝）；与去世一样 alive=false，但可被"重新建立"类效果复活 */
  estranged?: boolean
  /**
   * 孩子出生时玩家的年龄（第 26 轮，可选）：孩子当前年龄 = 玩家年龄 − birthAge。
   * 由引擎在"孩子出生"延迟效果落地当年盖章；缺省（旧档/手改档）视为出生年龄未知——
   * 里程碑事件不触发，养育开支按旧口径 10,000 计。
   */
  birthAge?: number
  /**
   * 挚友标记（第 66 轮，可选）：年度结算时 friend 亲密度 ≥60 盖章、<40 摘除；
   * 挚友衰减 −1（普通朋友维持 −2）。旧档无此字段即普通朋友，天然兼容。
   */
  bestFriend?: boolean
  /**
   * 该孩子已走过的生命阶段里程碑（第 26 轮，可选）：如 ms_junior（小升初）。
   * 每个里程碑对每个孩子至多一次——资格判定按孩子记标记，互不干扰。
   */
  milestones?: string[]
  /**
   * 去世标记（第 41 轮，可选）：与疏远严格区分——去世者 alive=false 且**无**
   * estranged 标记。「重新建立」类效果（revive）只认 estranged，天然不会复活
   * 去世者；所有「在册」判定（relationKinds/minCloseness 等只查 alive）对去世者
   * 自动失效。缺省（旧档）= 该关系从未走过去世结算，无感知。
   */
  deceased?: boolean
  /** 去世时的父母近似年龄（第 41 轮，可选；仅 deceased 者携带，供履历与统计） */
  deathAge?: number
}

/** 一条履历记录（结局时间线与履历页共用） */
export interface HistoryEntry {
  age: number
  eventId: string        // 事件 ID；年度结算产生的用 "settle"，成就解锁用 "ach"
  title: string          // 事件标题或"平凡的一年"
  choice: string         // 所选选项文本；无选择则 ""
  summary: string        // 一句话结果，展示用
  /** 关键经历（第 13 轮）：毕业/晋升/疏远/成就达成等人生转折，供结局总结引用 */
  key?: boolean
}

/** 延迟效果实例：挂起 N 年后生效 */
export interface PendingEffect {
  id: string
  dueAge: number
  attr?: AttrKey
  delta?: number
  money?: number
  addTags?: string[]
  /** 到期后获得的学历（只升不降） */
  education?: EducationLevel
  /** 到期后的技能成长 */
  addSkills?: Array<{ id: SkillKey; delta: number }>
  /** 到期后的关系变化（第 11 轮：延迟确定关系/关系回温/孩子出生） */
  relation?: RelationEffect
  /**
   * 周期性效果（第 12 轮）：生效后还剩几次按年重复（每次间隔 1 年）。
   * 用于"健身习惯 +3/年""康复费 -3,000/年"这类持续 N 年的累积效果；
   * 每次生效时 summary 都会写入当年年志，让长期积累可见。
   */
  repeat?: number
  summary?: string       // 生效时的提示文字
}

/**
 * 关系变化效果（即时效果与延迟效果共用，第 11 轮）：
 * - add：没有存活同类关系时新增一条（closeness 可指定初始亲密度，默认 50）
 * - remove：移除第一条存活同类关系（分手/永别）
 * - deltaCloseness：调整第一条存活同类关系的亲密度（clamp 到 0～100）
 * - convertFrom：把第一条存活的 convertFrom 关系转为 kind（恋爱→结婚）
 * - revive：复活第一条已疏远（estranged）的同类关系（破裂后重新建立）
 */
export interface RelationEffect {
  kind: RelationKind
  deltaCloseness?: number
  add?: boolean
  remove?: boolean
  /**
   * 建立时的名字（第 11 轮）。第 44 轮起：缺省时引擎按取名池 seed 确定具名
   * （child/grandchild/partner 各有乳名/伴侣名池，见 data/names.ts），
   * 事件数据保留 name 即维持静态具名（叙事耦合的名字如「书友小杜」）。
   */
  name?: string
  closeness?: number
  convertFrom?: RelationKind
  revive?: boolean
  /**
   * 作用于 childStage 条件解析出的那个孩子（第 26 轮，子女里程碑事件专用）：
   * 多孩家庭里 deltaCloseness 默认命中第一条存活同类关系（最年长者），
   * 里程碑办在谁身上，亲密度效果就该落在谁身上。仅支持 deltaCloseness。
   */
  milestoneTarget?: boolean
  /**
   * 追加式新增（第 28 轮，二胎语义）：即使已有存活的同类关系也新增一条。
   * 只允许用于"确实要添第二个孩子"类选择；普通 add 保持 V1 的
   * "无存活同类关系时生效"语义（防止旧事件在已育家庭凭空造人）。
   */
  addAnother?: boolean
}

/** 玩家选择产生的效果（事件引擎与生命周期共用） */
export interface Effect {
  attr?: AttrKey
  delta?: number
  money?: number
  addTags?: string[]
  removeTags?: string[]
  /** 技能成长（学业/职业技能） */
  addSkill?: { id: SkillKey; delta: number }
  /** 立刻获得某学历（精确设置；升学流程通常走 startEducation/毕业） */
  setEducation?: EducationLevel
  /** 入学：成为学生（年限缺省用 STAGE_INFO 标准学制） */
  startEducation?: { stage: StudentStage; years?: number }
  /** 退学/休学：离开学生身份 */
  quitEducation?: boolean
  /** 关系变化 */
  relation?: RelationEffect
  /** 入职/转行/再就业：应聘指定岗位（引擎校验门槛，不满足则此效果不生效） */
  startJob?: { jobId: string }
  /** 被裁员/公司倒闭：离开岗位进入待业 */
  loseJob?: boolean
  /** 主动辞职：离开岗位进入待业 */
  quitJob?: boolean
  /** 事件驱动的晋升（校验职级上限，不校验技能门槛；年度晋升走 lifecycle） */
  promote?: boolean
  /** 年薪倍率调整（降薪/加薪，夹在 0.5～2） */
  salaryMul?: number
  /** 办理退休：在职 → retired，mul 为退休金折算倍率（缺省用标准倍率，第 16 轮） */
  retire?: { mul?: number }
  /**
   * 贷款购房（第 23 轮）：建立房贷余额（本金 principal、期限 years 年，等额本息）。
   * 只允许出现在"确实贷款购房"的选项上——全款购房、翻修老屋不得使用。
   */
  takeMortgage?: { principal: number; years: number }
  /**
   * 提前还房贷本金（第 23 轮）：立刻划扣 min(金额, 余额)，余额清零即销账。
   * 视同大额即时支出（负债时被大额消费门槛隐藏）。
   */
  payMortgage?: number
  /**
   * 子女里程碑（第 26 轮）：给事件条件 childStage 解析出的那个孩子记标记——
   * 里程碑本身必然发生，选项差别在于怎么操办。须与条件的 milestonePending
   * 一致（validateEvents 锁定），否则会破坏"每孩至多一次"的资格判定。
   */
  childMilestone?: string
  /**
   * 投保（第 85 轮）：建立商业保单（年缴档位+保额）；已有保单时安全 no-op
   * （投保事件以 insuranceMissing 条件防重，此处兜底绝不重复建单）。
   */
  ensureInsurance?: { annualPremium: number; benefit: number }
  /**
   * 商保理赔（第 85 轮）：重疾确诊给付——保单在册时一次性划入 benefit 并终结保单；
   * 无保单时安全 no-op（不会凭空给钱）。
   */
  claimInsurance?: boolean
  /**
   * 购房盖章（第 86 轮）：建立房册（basis=value=总价）；已有房时安全 no-op
   * （购房事件一次性语义防重）。扣款（全款或首付）由事件 money 效果单独表达，
   * 贷款走既有 takeMortgage——三效果可同选项组合。
   */
  buyHome?: { total: number }
  /**
   * 卖房变现（第 86 轮）：净额=现值−房贷余额（可为负），卖房即清贷、房册注销；
   * 无房时安全 no-op（不会凭空给钱）。
   */
  sellHome?: boolean
  /**
   * 基金赎回（第 87 轮）：全额赎回市值入袋并销户；未开户时安全 no-op
   * （不会凭空给钱）。止盈/割肉共用本效果，差别在触发条件（牛/熊）与文案。
   */
  redeemFund?: boolean
  /**
   * 基金开户（第 87 轮）：建立定投持仓（units 从 0 起，年结自动划扣+牛熊结算）；
   * 已开户时安全 no-op（事件 once 语义防重，此处兜底）。
   */
  ensureFund?: { annualContribution: number }
  /**
   * 考公笔试面试（第 88 轮）：录取判定=seed 派生独立支流散列+academics 门槛
   * （civilservice.ts civilExamAdmitted）。录取→入职公务员（employPatch 校验学历
   * 门槛）+授予 civil_servant 标记；落榜→移除备考标记（可再战，事件 cooldown 2）。
   * 未备考（无 civil_exam_prep 标记）时安全 no-op（事件条件已挡，此处兜底）。
   */
  civilExam?: boolean
  /**
   * 迁居（第 90 轮）：变更所在城市层级（迁移事件专用；同层级 setCity 安全 no-op）。
   */
  setCity?: CityTier
  /**
   * 离婚（第 91 轮，R67 最小语义恢复）：在册配偶移出（child 关系全部保留）、
   * 现金 50% 分割（负资产同担=直接减半）、移除 married 与 marriage_crisis、
   * 授予 divorced。无在册配偶时安全 no-op。
   */
  divorce?: boolean
  /**
   * 事件直接致死（第 112 轮）：该选项结算后健康归零并授予 lethal_struck 标记，
   * 下一次年结的结束检查（checkLifeEnd）按年龄分流 death_young/death_ill。
   * 必须带标记：仅归零健康会被年轻年的自然健康漂移（<30 岁 +1/年）从 0 复苏，
   * 标记在册即判死——这是「致死必须走引擎能力」的结构性根因（yk_sudden 的
   * 延迟 −100 在 18–29 岁落地同样会被漂移救活）。校验器强制 lethal 只出现在
   * once + 支流散列门控（suddenRisk/accidentRisk/illnessRisk/fameChance）的
   * 窄门事件上，且全池至多 2 枚。
   */
  lethal?: true
}

/** 技能成长的延迟写法与即时写法共用 */
export type SkillGain = { id: SkillKey; delta: number }

/** 事件作者声明的延迟效果：years = 几年后生效（引擎换算为绝对 dueAge） */
export type DelayedEffect = Omit<PendingEffect, 'id' | 'dueAge'> & { years: number }

export interface EventChoice {
  text: string
  tooltip?: string
  effects: Effect[]
  delayed?: DelayedEffect[]
  addTags?: string[]
  removeTags?: string[]
  /** 选项级条件（不满足则隐藏该选项） */
  requires?: EventCondition
  /** 选择后产生的履历摘要模板，可用 {name} {money} 等占位 */
  summary?: string
}

export type EventCategory =
  | 'education' | 'career' | 'money' | 'relationship' | 'health' | 'life'

/**
 * 子女生命阶段条件（第 26 轮）：对"某个孩子"的整体量化——年龄窗与里程碑资格
 * 必须同时落在同一个孩子身上（分开两个字段会各自 quantify 出不同的孩子）。
 */
export interface ChildStageCondition {
  /** 孩子年龄下限（含） */
  atLeast: number
  /** 孩子年龄上限（不含）；缺省不设上限 */
  below?: number
  /** 该孩子尚未完成的里程碑（"每孩至多一次"的资格判定） */
  milestonePending?: string
  /** 该孩子已完成的前置里程碑（如孙辈须先成家） */
  milestoneDone?: string
  /**
   * 关系种类（第 44 轮，缺省 'child'）：'grandchild' 时条件解析孙辈——
   * 孙辈带 birthAge（孙辈出生盖章）与 milestones，"每孙辈至多一次"复用同套判定。
   */
  kind?: RelationKind
}

/** 事件/选项触发条件（全部为可选，同时满足才触发） */
export interface EventCondition {
  minAge?: number
  maxAge?: number
  minAttr?: Partial<Attributes>
  maxAttr?: Partial<Attributes>
  education?: EducationLevel[]
  careerKinds?: CareerKind[]
  /** 学生在读阶段（career.kind === 'student' 时按 stage 匹配） */
  studentStages?: StudentStage[]
  jobLevels?: number[]
  /** 要求在职且未到该岗位职级上限（promote 满级时静默无效，晋升选项须用它隐藏） */
  promotionAvailable?: boolean
  /** 技能门槛 */
  minSkills?: Partial<Record<SkillKey, number>>
  maxSkills?: Partial<Record<SkillKey, number>>
  /** 需要全部拥有的标记 */
  tagsAll?: string[]
  /** 拥有任一标记即可 */
  tagsAny?: string[]
  /** 拥有任一标记则不可触发 */
  tagsNone?: string[]
  moneyAtLeast?: number
  moneyBelow?: number
  /** 名下房贷余额下限（第 23 轮）：月供/对账类事件的触发资格 = 余额 > 0（传 1 即可） */
  mortgageBalanceAtLeast?: number
  /** 生活方式风险值下限（第 24 轮）：分级体检/慢性病类事件的触发资格读累积风险值 */
  healthRiskAtLeast?: number
  /** 生活方式风险值上限（第 24 轮）：轻度异常事件用它把自己限制在对应档位（≥ 此值不触发） */
  healthRiskBelow?: number
  /** 无商业保单（第 85 轮）：投保类事件的资格 = state.insurance 不在册 */
  insuranceMissing?: boolean
  /** 名下有房（第 86 轮）：持有/变卖类事件的资格 = state.home 在册 */
  homeOwned?: boolean
  /** 基金已开户（第 87 轮）：止盈/割肉类事件的资格 = state.fund 在册 */
  fundOwned?: boolean
  /** 基金市场态匹配（第 87 轮）：'bull' 止盈向 / 'bear' 割肉向；态由 seed 派生序列确定性重放 */
  fundMarket?: 'bull' | 'bear'
  /** 学业功底下限（第 88 轮）：考公类事件的资格 = skills.academics ≥ 本值 */
  minAcademics?: number
  /** 职业技能下限（第 92 轮）：技术工种类事件的资格 = skills.vocational ≥ 本值 */
  minVocational?: number
  /** 自媒体支流窗口（第 93 轮）：'viral' 走红向 / 'hate' 网暴向——态由 seed 派生序列确定性重放 */
  fameChance?: 'viral' | 'hate'
  /** 意外风险年（第 95 轮）：death_young 补现窄门的年检散列门 */
  suddenRisk?: boolean
  /** 意外窄门年（第 112 轮）：lethal 事件专用年检散列门（独立低频盐，见 suddendeath.ts） */
  accidentRisk?: boolean
  /** 急病窄门年（第 112 轮）：lethal 事件专用年检散列门（独立低频盐，见 suddendeath.ts） */
  illnessRisk?: boolean
  /** 创业进账年（第 116 轮）：第一笔进账事件的支流散列门（盐见 venture.ts，率 0.5） */
  ventureProfit?: boolean
  /** 创业风险年（第 116 轮）：关门抉择事件的支流散列门（盐见 venture.ts，率 0.4） */
  ventureClose?: boolean
  /** 所在城市层级（第 90 轮）：迁移/城市类事件按当前层级放行（OR 语义） */
  cityIn?: CityTier[]
  /** 离异身份（第 91 轮）：单身岁月/再婚窗口事件的资格 = divorced 标记在册 */
  divorced?: boolean
  relationKinds?: RelationKind[]       // 存在某种（存活的）关系
  /** 不存在列出的任何（存活）关系（单身路线事件的门槛） */
  relationKindsNone?: RelationKind[]
  minCloseness?: Partial<Record<RelationKind, number>> // 某关系亲密度下限
  maxCloseness?: Partial<Record<RelationKind, number>> // 某关系亲密度上限（冷却期/危机事件用）
  /**
   * 子女生命阶段资格（第 26 轮）：存在一个存活、出生年龄已知的孩子，同时满足
   * 年龄窗 [atLeast, below)、未完成 milestonePending、已完成 milestoneDone。
   * 多孩同年达标时解析到最年长的待办孩子（见 engine/children.ts）。
   */
  childStage?: ChildStageCondition
  /**
   * 父母身后事资格（第 42 轮）：N 年内送别过父母——存在去世档案（deceased +
   * deathAge）的父母，且去世发生不早于「玩家当前年龄 − N」（去世年由
   * deathAge − PARENT_AGE_OFFSET 反推，与第 41 轮近似口径一致）。
   */
  parentDiedWithin?: number
  /**
   * 双亲皆逝（第 42 轮）：有送别记录的父母存在，且再无在册（alive）父母——
   * 「最后一位走之后」的独当一面叙事。被疏远的父母不算在册也不算送别档案。
   */
  parentsAllDeceased?: boolean
  /**
   * 手足身后事资格（第 65 轮）：N 年内送别过手足——存在去世档案（deceased +
   * deathAge）的手足，且去世发生不早于「玩家当前年龄 − N」。手足 deathAge 记
   * 真实手足年龄（第 64 轮），无需近似偏移反推。
   */
  siblingDiedWithin?: number
}

export interface GameEvent {
  id: string
  category: EventCategory
  title: string
  text: string
  minAge: number
  maxAge: number
  weight?: number             // 默认 10
  priority?: number           // 默认 0；高者先被考虑
  cooldown?: number           // 触发后 N 年冷却，默认 0
  once?: boolean              // 默认 false
  requires?: EventCondition
  choices: EventChoice[]      // 2～4 个
  /**
   * 强制剧情单选例外（第 19 轮）：普通事件在状态过滤后须仍有 ≥2 个可结算选项
   * 才能进入事件卡；确属"必须有叙事出口"的强制剧情事件可标记本字段豁免。
   * 白名单受测试锁定（逐项附理由），禁止无标记的偶然单选。
   */
  singleChoiceOk?: boolean
}

/** 初始背景 */
export interface Background {
  id: string
  name: string
  desc: string
  /** 优点（创建页展示） */
  pros: string
  /** 代价（创建页展示） */
  cons: string
  /** 可能影响的方向（创建页展示） */
  influence: string
  attrs: Partial<Attributes>
  /** 初始技能加成（在基准值上叠加） */
  skills?: Partial<Record<SkillKey, number>>
  money: number
  education: EducationLevel
  tags: string[]
}

/** 特质 */
export interface Trait {
  id: string
  name: string
  desc: string
  /** 优点（创建页展示） */
  pros: string
  /** 代价（创建页展示） */
  cons: string
  /** 可能影响的方向（创建页展示） */
  influence: string
  attrs: Partial<Attributes>
  /** 初始技能加成（在基准值上叠加） */
  skills?: Partial<Record<SkillKey, number>>
  /** 命中某类别事件时的权重倍率 */
  categoryWeight?: Partial<Record<EventCategory, number>>
  /** 创建角色时并入初始标记，可供事件条件引用 */
  tags?: string[]
}

/** 结局定义 */
export interface Ending {
  id: string
  name: string
  desc: string
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
  /** 全部满足才选此结局（按数组顺序第一个命中的生效） */
  condition: EventCondition & { minAge?: number; tagsAll?: string[]; tagsAny?: string[] }
}

export type GamePhase = 'creation' | 'playing' | 'ended'

/**
 * 年度快照（第 21 轮）：每年年度结算定型后取下的人生切面，
 * 为资产曲线、属性雷达、人生报告等可视化提供原料。
 * 结构保持小而稳定：只有展示需要的字段，不含事件/履历等大对象。
 */
export interface YearlySnapshot {
  age: number
  money: number
  /** 五维属性（结算后的值） */
  attrs: Attributes
  /** 职业状态摘要：在职/学生/待业/退休/无；在职时附职级 */
  career: {
    kind: CareerKind
    /** 仅 career.kind === 'employed' 时存在 */
    level?: number
  }
}

/** 游戏全局状态（唯一权威数据，可 JSON 序列化存档） */
export interface GameState {
  version: number             // 存档版本
  seed: number
  rngState: number            // RNG 可序列化状态
  name: string
  age: number
  backgroundId: string
  traitId: string
  attrs: Attributes
  money: number
  education: EducationLevel
  /** 技能水平（学业/职业技能，0～100） */
  skills: Record<SkillKey, number>
  career: CareerState
  /**
   * 累计正式工龄 = 社保缴费年限（第 22 轮，可选，缺省 0）：
   * 在职年度结算 +1，晋升/转岗不清零，离职再就业继续累计；
   * 驱动公式化年薪的工龄系数与退休金的缴费年限折算。v2 旧档缺省视为 0。
   */
  workYears?: number
  /**
   * 房贷余额（第 23 轮，可选，缺省无贷款）：仅贷款购房时建立，年度结算自动划扣；
   * 月供/对账类事件的触发资格 = 本字段存在且余额 > 0。旧档缺省视为无贷款。
   */
  mortgage?: MortgageState
  /**
   * 商业保险保单（第 85 轮，可选，缺省无保单）：投保事件建立，理赔（确诊给付）时
   * 一次性划入 benefit 并终结保单。简化语义：保单生效至出险，续期不模拟
   * （annualPremium 记录年缴档位供文案与平衡参照）。旧档缺省视为无保单。
   */
  insurance?: InsurancePolicy
  /**
   * 房产（第 86 轮，可选，缺省无房）：购房事件建立、卖出事件注销；
   * 现值年度复利只在 value 上，不动现金。旧档缺省视为无房。
   */
  home?: HomeProperty
  /**
   * 基金定投持仓（第 87 轮，可选，缺省未开户）：定投事件建立、赎回事件注销；
   * 年结自动划扣定投并按独立支流牛熊序列结算市值。旧档缺省视为未开户。
   */
  fund?: FundHoldings
  /**
   * 所在城市层级（第 90 轮，可选，缺省 hometown）：迁移事件变更；
   * 薪资/生活成本/房产增值三处系数按层级生效，缺省=老家全系数 1（旧行为逐位不变）。
   */
  city?: CityTier
  /**
   * 生活方式健康风险值（第 24 轮，可选，缺省 0，范围 0～100）：
   * 年度结算按「生活方式标记 × 年龄系数」累积，只累积不直接改属性；
   * 分级体检与老年慢性病事件的触发资格读本值（engine/lifestyle.ts）。
   * 停止坏习惯后增速放缓/归零，但历史累积保留（不清零）。旧档缺省视为 0。
   */
  healthRisk?: number
  relations: Relation[]
  tags: string[]
  seenEvents: string[]
  cooldowns: Record<string, number>   // eventId -> 冷却解除的年龄
  pending: PendingEffect[]
  history: HistoryEntry[]
  achievements: string[]
  /**
   * 年度快照（第 21 轮）：下标 0 为 18 岁开局切面，此后每年年度结算追加一条；
   * 终局年也有（结算先于结束检查）。v1 旧档迁移后为空数组，从当前年继续积累。
   */
  snapshots: YearlySnapshot[]
  phase: GamePhase
  endingId?: string
  /** 本年度结算日志（进入下一年时刷新） */
  yearLog: string[]
}
