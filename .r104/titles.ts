import { ALL_EVENTS } from '../src/data/events'
const ids = ['ins_buy_young', 'ins_buy_mid', 'hlt_major_surgery', 'div_sign_papers',
  'ab_study', 'youth_study_abroad', 'fame_viral', 'fame_cash', 'fame_hate', 'fame_update', 'fame_start']
for (const id of ids) {
  const e = ALL_EVENTS.find((x) => x.id === id)
  console.log(id.padEnd(20), e ? `title= ${JSON.stringify(e.title)}` : 'NOT FOUND')
}