// 第 20 轮离线交付后处理：把 dist/index.html 引用的 JS/CSS 内联进去，
// 产出自包含单文件 —— Chrome 对 file:// 页面的 module 脚本与 crossorigin 样式表
// 强制 CORS（CorsDisabledScheme），外部引用在双击打开时必然加载失败。
// 用法：vite build && node scripts/inline-dist.mjs（已接入 npm run build）
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const htmlPath = join(root, 'dist', 'index.html')
let html = readFileSync(htmlPath, 'utf8')

// 内联 module 脚本（防御性转义 </script，JS 字符串与正则中 \/ 等价于 /）
html = html.replace(
  /<script type="module"[^>]*src="\.?\/?(assets\/[^"]+)"[^>]*><\/script>/,
  (_, file) => {
    const js = readFileSync(join(root, 'dist', file), 'utf8').replace(/<\/script/gi, '<\\/script')
    return `<script type="module">\n${js}\n</script>`
  },
)

// 内联样式表
html = html.replace(
  /<link rel="stylesheet"[^>]*href="\.?\/?(assets\/[^"]+)"[^>]*>/,
  (_, file) => `<style>\n${readFileSync(join(root, 'dist', file), 'utf8')}\n</style>`,
)

if (html.includes('src="./assets/') || html.includes('href="./assets/')) {
  console.error('inline-dist: 仍有未内联的外部引用，中止')
  process.exit(1)
}
writeFileSync(htmlPath, html)
// 第 107 轮：同时打印两个口径。此前只打印 html.length/1024（UTF-16 码元），
// 而第 106 轮拿它与按 UTF-8 字节算出的数字直接对比，误判为「记账笔误 + 体积翻倍」，
// 并据此在 SPEC §10d 与账本里撤回了前几轮的正确记录。两个口径都是对的，只是量纲不同
//（中文与 emoji 在 UTF-8 占 3–4 字节、在 UTF-16 只占 1–2 码元），故此处并列打印。
const bytes = Buffer.byteLength(html, 'utf8')
console.log(
  `inline-dist: OK，index.html 自包含（${(html.length / 1024).toFixed(1)} kB 码元口径 / ` +
    `${(bytes / 1024).toFixed(1)} kB 字节口径，${bytes.toLocaleString('en-US')} 字节）`,
)
