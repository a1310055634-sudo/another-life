import { ALL_EVENTS } from '../src/data/events/index'

for (const e of ALL_EVENTS) {
  const r = e.requires ? JSON.stringify(e.requires) : '-'
  const del = e.choices
    .flatMap((c, i) =>
      (c.delayed ?? []).map((d) => {
        const what =
          d.summary ??
          (d.attr ? `${d.attr}${d.delta! > 0 ? '+' : ''}${d.delta}` : undefined) ??
          (d.money !== undefined ? `money${d.money}` : undefined) ??
          (d.education ?? undefined) ??
          (d.addTags ? 'tag:' + d.addTags.join('/') : undefined) ??
          (d.relation ? 'rel' : undefined) ??
          (d.addSkills ? 'skill' : undefined)
        return `opt${i}:${what}@+${d.years}${d.repeat ? 'x' + d.repeat : ''}`
      }),
    )
    .join(' | ')
  const tagAdds = e.choices
    .map((c, i) => ((c.addTags ?? []).length ? `opt${i}+${JSON.stringify(c.addTags)}` : ''))
    .filter(Boolean)
    .join(' | ')
  const optConds = e.choices
    .map((c, i) => (c.requires ? `opt${i}:${JSON.stringify(c.requires)}` : ''))
    .filter(Boolean)
    .join(' | ')
  console.log(
    [e.id, e.category, `${e.minAge}-${e.maxAge}`, `w${e.weight ?? 10}`, `p${e.priority ?? 0}`, e.once ? 'once' : e.cooldown ? `cd${e.cooldown}` : '-', r, del || '-', tagAdds || '-', optConds || '-'].join(
      ' ## ',
    ),
  )
}
console.log('TOTAL', ALL_EVENTS.length)
