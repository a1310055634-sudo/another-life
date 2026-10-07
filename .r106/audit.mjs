import { execSync } from 'node:child_process'
const out = execSync('npx tsx scripts/dump-events.ts', { encoding: 'utf8', maxBuffer: 64*1024*1024 })
console.log(out.slice(0, 400))
