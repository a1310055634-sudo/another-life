// 第 27 轮《时代质感》盘点辅助：导出全部事件的 id/年龄窗/标题/正文/选项文本
// 用法：node scripts/era_audit.mjs [--keywords]
//   默认输出逐事件清单（供通读）；--keywords 只输出含时代词的行
import { ALL_EVENTS } from '../src/data/events/index.ts'

const args = process.argv.slice(2)
const kwMode = args.includes('--keywords')

// 时代锚点词表（青年/中年/晚年各自的时代细节，以及可能错位的词）
const KEYWORDS = [
  '手机', 'App', 'APP', 'app', '应用', '软件', '微信', '朋友圈', '群', '扫码', '二维码',
  '外卖', '快递', '网购', '淘宝', '直播', '短视频', '点赞', '弹幕', '网课', '在线',
  '租房软件', '租房 App', '比价', '共享单车', '地铁', '通勤', '打卡', '刷', '视频',
  '电脑', '笔记本', '键盘', '游戏', '电竞', '网络', 'WiFi', 'wifi', '流量', '充电',
  '智能', '电子', '数码', '导航', '打车', '滴滴', '健康码', '线上', '线下', '邮',
  '照片', '相册', '电视', '广播', '收音机', '报纸', '信', '电话',
  // 第 70 轮时代纵深 II 扩容 +10（与现读去重后新增）
  '取餐码', '公屏', '购物车', '网约车', '带货', '养生', '云相册', '快递柜', '视频通话', '手机支付',
  // 第 101 轮时代纵深 III 扩容 +8（与现读池去重后新增；「消费降级」现池已命中 1 条，
  // 追加为词表条目以覆盖该既有句，属词表登记而非重复造句）
  '考公上岸', '灵活就业', '直播带货', '副业刚需', '消费降级', '断舍离', '数字游民', '银发经济',
  // 第 123 轮时代纵深 IV 扩容 +8（与现读两表去重后新增；断舍离/银发经济已在上方 R101 行，剔除）
  '反向春运', '电子红包', '鸡娃', '内卷', '心理咨询', '数字遗产', '团购', '拼单',
]

if (kwMode) {
  for (const e of ALL_EVENTS) {
    const hit = (s) => KEYWORDS.some((k) => s.includes(k))
    const lines = []
    if (hit(e.text)) lines.push(`  text: ${e.text}`)
    for (const c of e.choices) {
      if (hit(c.text) || hit(c.summary ?? '')) lines.push(`  [${c.text}] => ${c.summary ?? ''}`)
    }
    if (lines.length) {
      console.log(`### ${e.id} [${e.minAge}-${e.maxAge}] ${e.title}`)
      console.log(lines.join('\n'))
    }
  }
} else {
  for (const e of ALL_EVENTS) {
    console.log(`### ${e.id} [${e.minAge}-${e.maxAge}] w${e.weight ?? 10} p${e.priority ?? 0} ${e.title}`)
    console.log(`  ${e.text}`)
    for (const c of e.choices) {
      console.log(`  * ${c.text} => ${c.summary ?? ''}`)
    }
  }
}
console.error(`\n[total events: ${ALL_EVENTS.length}]`)
