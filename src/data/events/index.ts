// 事件池总入口：所有事件文件在此合并，游戏与测试统一消费 ALL_EVENTS
import type { GameEvent } from '../../engine/types'
import { BASIC_EVENTS } from './basic'
import { EDUCATION_EVENTS } from './education'
import { CAREER_EVENTS } from './career'
import { FINANCE_EVENTS } from './finance'
import { RELATIONSHIP_EVENTS } from './relationship'
import { HEALTH_EVENTS } from './health'
import { YOUTH_EVENTS } from './youth'
import { MIDLIFE_EVENTS } from './midlife'
import { LATE_EVENTS } from './late'
import { PARENT_EVENTS } from './parents'
import { SIBLING_EVENTS } from './siblings'
import { FRIEND_EVENTS } from './friends'
import { MARRIAGE_EVENTS } from './marriage'
import { PET_EVENTS } from './pets'
import { INSURANCE_EVENTS } from './insurance'
import { HOME_EVENTS } from './home'
import { FUND_EVENTS } from './fund'
import { CIVILSERVICE_EVENTS } from './civilservice'
import { MIDCAREER_EVENTS } from './midcareer'
import { CITY_EVENTS } from './city'
import { MARRIAGE_V5_EVENTS } from './marriage_v5'
import { V5EDU_EVENTS } from './v5edu'
import { FAME_EVENTS } from './fame'
import { MENTAL_EVENTS } from './mental'
import { PARENTING_EVENTS } from './parenting'
import { WORKLIFE_EVENTS } from './worklife'
import { VENTURE_EVENTS } from './venture'
import { NEWYEAR_EVENTS } from './newyear'
import { PERSONA_EVENTS } from './persona'
import { ERA4_EVENTS } from './era4'
import { LINKUP_EVENTS } from './linkup'

export const ALL_EVENTS: GameEvent[] = [
  ...BASIC_EVENTS,
  ...EDUCATION_EVENTS,
  ...CAREER_EVENTS,
  ...FINANCE_EVENTS,
  ...RELATIONSHIP_EVENTS,
  ...HEALTH_EVENTS,
  ...YOUTH_EVENTS,
  ...MIDLIFE_EVENTS,
  ...LATE_EVENTS,
  ...PARENT_EVENTS,
  ...SIBLING_EVENTS,
  ...FRIEND_EVENTS,
  ...MARRIAGE_EVENTS,
  ...PET_EVENTS,
  ...INSURANCE_EVENTS,
  ...HOME_EVENTS,
  ...FUND_EVENTS,
  ...CIVILSERVICE_EVENTS,
  ...MIDCAREER_EVENTS,
  ...CITY_EVENTS,
  ...MARRIAGE_V5_EVENTS,
  ...V5EDU_EVENTS,
  ...FAME_EVENTS,
  ...MENTAL_EVENTS,
  ...PARENTING_EVENTS,
  ...WORKLIFE_EVENTS,
  ...VENTURE_EVENTS,
  ...NEWYEAR_EVENTS,
  ...PERSONA_EVENTS,
  ...ERA4_EVENTS,
  ...LINKUP_EVENTS,
]
