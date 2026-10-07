import { ACHIEVEMENTS } from '../src/engine/achievements'
const ids = ['ach_fallen_and_risen', 'ach_reunion', 'ach_grandparent', 'ach_dream_trilogy',
  'ach_phd', 'ach_old_friend', 'ach_sibling_bond', 'ach_soul_buddy', 'ach_rebuilt_after_divorce']
for (const id of ids) {
  const a = ACHIEVEMENTS.find((x) => x.id === id)!
  console.log(`\n── ${id}  [现值 ${a.rarity}]`)
  console.log(`   name: ${a.name}`)
  console.log(`   check: ${a.check.toString().replace(/\s+/g, ' ')}`)
}