// .r109/diff_evidence.mjs —— 重排前后非空行差分（逐条可审，证明只动了「物理位置 + 声明的改动」）
import fs from 'node:fs';

const ROOT = 'D:\\vibe coding\\another-life';
const before = fs.readFileSync(ROOT + '\\.r109\\SPEC.before.md', 'utf8').split('\n').filter((l) => l.trim() !== '');
const after = fs.readFileSync(ROOT + '\\SPEC.md', 'utf8').split('\n').filter((l) => l.trim() !== '');

const ms = (a) => { const m = new Map(); for (const l of a) m.set(l, (m.get(l) || 0) + 1); return m; };
const mb = ms(before), ma = ms(after);
const removed = [], added = [];
for (const [k, v] of mb) { const w = ma.get(k) || 0; if (w < v) for (let i = 0; i < v - w; i++) removed.push(k); }
for (const [k, v] of ma) { const w = mb.get(k) || 0; if (w > v) for (let i = 0; i < w - v; i++) added.push(k); }
removed.sort(); added.sort();

const out = [];
out.push('BEFORE_NONBLANK=' + before.length + ' AFTER_NONBLANK=' + after.length);
out.push('REMOVED_COUNT=' + removed.length);
removed.forEach((l, i) => out.push('  R' + (i + 1) + ' len=' + l.length + ' :: ' + l.slice(0, 80)));
out.push('ADDED_COUNT=' + added.length);
added.forEach((l, i) => out.push('  A' + (i + 1) + ' len=' + l.length + ' :: ' + l.slice(0, 80)));

// 分类：标题行改动 / §9 重写 / 重复段落
const isHead = (l) => /^#{2,3} /.test(l);
out.push('REMOVED_HEADINGS=' + removed.filter(isHead).length + ' ADDED_HEADINGS=' + added.filter(isHead).length);
out.push('REMOVED_HEADINGS_LIST=' + removed.filter(isHead).map((l) => l.slice(0, 40)).join(' | '));
out.push('ADDED_HEADINGS_LIST=' + added.filter(isHead).map((l) => l.slice(0, 40)).join(' | '));
out.push('ADDED_NONHEADINGS=' + added.filter((l) => !isHead(l)).length);
out.push('REMOVED_NONHEADINGS=' + removed.filter((l) => !isHead(l)).length);

// §6 小节内容一致性：把 before 中 §6.35..§6.60 区的每一行与 after 逐条比对（多重集）
const secOf = (arr, startRe, endRe) => {
  const s = arr.findIndex((l) => startRe.test(l));
  const e = arr.findIndex((l, i) => i > s && endRe.test(l));
  return arr.slice(s, e < 0 ? arr.length : e);
};
const b635 = secOf(before, /^## 6\.35 /, /^## 6\.37 /);
const a635 = secOf(after, /^## 6\.35 /, /^## 6\.37 /);
out.push('SEC6_35_BEFORE_LINES=' + b635.length + ' AFTER_LINES=' + a635.length +
  ' IDENTICAL=' + (JSON.stringify(b635) === JSON.stringify(a635)));
const b660 = secOf(before, /^## 6\.60 /, /^## 6\.62 /);
const a660 = secOf(after, /^## 6\.60 /, /^## 6\.62 /);
out.push('SEC6_60_61_BEFORE_LINES=' + b660.length + ' AFTER_LINES=' + a660.length);
out.push('SEC6_60_61_BEFORE_' + JSON.stringify(b660.map((l) => l.slice(0, 24))));
out.push('SEC6_60_61_AFTER_' + JSON.stringify(a660.map((l) => l.slice(0, 24))));
const b636 = secOf(before, /^## 6\.36 /, /^## 6\.52 /);
const a636 = secOf(after, /^## 6\.36 /, /^## 6\.37 /);
out.push('SEC6_36_BEFORE_LINES=' + b636.length + ' AFTER_LINES=' + a636.length +
  ' IDENTICAL=' + (JSON.stringify(b636) === JSON.stringify(a636)));

fs.writeFileSync(ROOT + '\\.r109\\diff_evidence.txt', out.join('\n') + '\n', 'utf8');
console.log(out.slice(0, 6).join('\n'));
console.log('... see .r109/diff_evidence.txt');
