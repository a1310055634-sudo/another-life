import { ALL_EVENTS } from '../src/data/events/index'
import { validateEvents } from '../src/engine/validateEvents'

const issues = validateEvents(ALL_EVENTS)
console.log('pool', ALL_EVENTS.length, 'issues', issues.length)
for (const i of issues) console.log(i.eventId, '|', i.problem)
