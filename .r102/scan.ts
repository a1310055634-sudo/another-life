// 第 102 轮前置盘点：撞题扫描 + 文件级规格快照
// 运行：npx tsx .r102/scan.ts
import { ALL_EVENTS } from '../src/data/events'

import { MARRIAGE_EVENTS } from '../src/data/events/marriage'
import { FRIEND_EVENTS } from '../src/data/events/friends'
import { PET_EVENTS } from '../src/data/events/pets'
import { PARENT_EVENTS } from '../src/data/events/parents'

console.log('=== 四个最薄文件的既有事件规格（撞题底稿）===')

const groups: Array<[string, typeof MARRIAGE_EVENTS]> = [
  ['marriage', MARRIAGE_EVENTS],
  ['friends', FRIEND_EVENTS],
  ['pets', PET_EVENTS],
  ['parents', PARENT_EVENTS],
]
for (const [name, arr] of groups) {
  console.log(`\n--- ${name}.ts (${arr.length} 枚) ---`)
  for (const e of arr) {
    console.log(
      [
        e.id.padEnd(26),
        `win[${e.minAge},${e.maxAge}]`.padEnd(14),
        `cat=${e.category}`.padEnd(16),
        `w=${e.weight ?? '-'}`.padEnd(8),
        `cd=${e.cooldown ?? '-'}`.padEnd(8),
        e.once ? 'once ' : '',
        e.title,
        '| REQ:',
        JSON.stringify(e.requires ?? {}),
      ].join(' '),
    )
  }
}

console.log('\n\n=== 撞题扫描：候选主题关键词在全池的命中 ===')
const SCAN: Record<string, string[]> = {
  婚后财务: ['财务', '共同账户', '家用', '各管各', 'AA', '钱谁管', '开支', '预算'],
  过年去谁家: ['过年', '春节', '年夜饭', '去谁家', '老家', '婆家', '娘家', '团聚'],
  中年书信: ['写信', '一封信', '笔信', '信纸', '寄信', '书信'],
  老友创业: ['创业', '合伙人', '合伙', '开店', '入股', '邀约', '拉我入伙'],
  代际友情: ['子女的朋友', '孩子的朋友', '忘年交', '孩子带回家', '下一代'],
  宠物大病: ['宠物生病', '猫生病', '狗生病', '手术', '住院', ' veterinary', '兽医'],
  宠物遗照: ['遗照', '宠物去世', '送走', '葬', '骨灰', '毛孩子'],
  父母再婚: ['父母再婚', '再婚', '二婚', '爸妈的婚事', '父亲的老伴', '母亲的老伴'],
  临终关怀: ['临终', '临终关怀', '放弃治疗', '抢救', 'ICU', '弥留'],
  中年重估: ['意义', '重来', '中年', '四十', '五十', '半百'],
  职业倦怠后期: ['停下来', '歇一歇', '慢下来', '间隙', '空窗'],
  老友渐远: ['渐行渐远', '走散', '失联', '很久没联系'],
  体检指标: ['体检', '指标', '报告', '复查', '异常项'],
  旧物整理: ['旧物', '收纳', '断舍离', '整理', '箱子', '储藏'],
  邻里往来: ['邻居', '小区', '楼下', '物业', '居委会'],
  同学聚会: ['同学会', '聚会', '老同学', '同窗'],
  通勤与路: ['通勤', '路上', '地铁', '堵车', '班车'],
  数字生活: ['手机', '短视频', '朋友圈', '直播', '算法'],
  兴趣与爱好: ['爱好', '兴趣', '钓鱼', '养花', '唱歌', '书法'],
  身体与衰老: ['膝盖', '腰', '眼睛', '老花', '听力', '爬楼'],
}

for (const [theme, words] of Object.entries(SCAN)) {
  const hits: string[] = []
  for (const e of ALL_EVENTS) {
    const hay = `${e.title}|${e.text}|${e.choices.map((c) => `${c.text}${c.summary ?? ''}${c.tooltip ?? ''}`).join('|')}`
    const matched = words.filter((w) => hay.includes(w))
    if (matched.length) hits.push(`${e.id}[${matched.join(',')}]`)
  }
  console.log(`\n【${theme}】命中 ${hits.length}：${hits.slice(0, 14).join('  ')}`)
}

console.log('\n\n=== 全池标题一览（人工核重用）===')
for (const e of ALL_EVENTS) console.log(`${e.id}\t[${e.minAge},${e.maxAge}]\t${e.title}`)
