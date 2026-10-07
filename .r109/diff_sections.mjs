// .r109/diff_sections.mjs —— 逐节正文比对：证明除声明的三处外，每一节的正文逐行未改
import fs from 'node:fs';

const ROOT = 'D:\\vibe coding\\another-life';
const parse = (p) => {
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  const secs = new Map();
  const order = [];
  let cur = null;
  lines.forEach((l) => {
    if (/^#{2,3} /.test(l)) {
      const m = /^(#{2,3}) (\d+)([a-z]?)(?:\.(\d+))?/.exec(l);
      const key = m ? m[2] + m[3] + (m[4] === undefined ? '' : '.' + m[4]) : 'TEXT:' + l;
      cur = { key, heading: l, body: [] };
      secs.set(key, cur);
      order.push(key);
    } else if (cur) cur.body.push(l);
    else { /* preamble */ }
  });
  for (const s of secs.values()) { while (s.body.length && s.body[s.body.length - 1].trim() === '') s.body.pop(); }
  return { secs, order };
};

const B = parse(ROOT + '\\.r109\\SPEC.before.md');
const A = parse(ROOT + '\\SPEC.md');

const out = [];
out.push('SECTIONS_BEFORE=' + B.secs.size + ' AFTER=' + A.secs.size);
const allKeys = [...new Set([...B.secs.keys(), ...A.secs.keys()])];
const headOnly = [], bodyChanged = [], same = [], onlyBefore = [], onlyAfter = [];
for (const k of allKeys) {
  const b = B.secs.get(k), a = A.secs.get(k);
  if (!b) { onlyAfter.push(k); continue; }
  if (!a) { onlyBefore.push(k); continue; }
  const headSame = b.heading === a.heading;
  const bodySame = JSON.stringify(b.body) === JSON.stringify(a.body);
  if (headSame && bodySame) same.push(k);
  else if (!headSame && bodySame) headOnly.push(k + ' [' + b.heading.slice(0, 16) + ' -> ' + a.heading.slice(0, 16) + ']');
  else bodyChanged.push(k + ' [headSame=' + headSame + ' beforeBody=' + b.body.length + ' afterBody=' + a.body.length + ']');
}
out.push('IDENTICAL_SECTIONS=' + same.length);
out.push('HEADING_ONLY_CHANGED=' + headOnly.length + ' :: ' + headOnly.join(' | '));
out.push('BODY_CHANGED=' + bodyChanged.length + ' :: ' + bodyChanged.join(' | '));
out.push('ONLY_IN_BEFORE=' + JSON.stringify(onlyBefore));
out.push('ONLY_IN_AFTER=' + JSON.stringify(onlyAfter));

// §6.61 正文差：只允许少那一行重复段落
const b661 = B.secs.get('6.61'), a661 = A.secs.get('6.61');
const bset = new Map(); b661.body.forEach((l) => bset.set(l, (bset.get(l) || 0) + 1));
const aset = new Map(); a661.body.forEach((l) => aset.set(l, (aset.get(l) || 0) + 1));
const lost = [], gained = [];
for (const [k, v] of bset) { const w = aset.get(k) || 0; if (w < v) lost.push((v - w) + 'x len=' + k.length); }
for (const [k, v] of aset) { const w = bset.get(k) || 0; if (w < v) gained.push((v - w) + 'x len=' + k.length); }
out.push('SEC6_61_LOST=' + JSON.stringify(lost) + ' GAINED=' + JSON.stringify(gained));
out.push('SEC6_61_DUP_STILL_PRESENT_ONCE=' + (aset.get(b661.body.find((l) => l.length === 642)) === 1));

// §9 正文确实是重写（旧正文 1 行已不存在）
const old9 = '- 全部未实现：工程脚手架、状态模型、事件引擎、事件内容、结局、成就、存档、界面打磨';
const afterRaw = fs.readFileSync(ROOT + '\\SPEC.md', 'utf8');
out.push('OLD_SEC9_BULLET_GONE=' + !afterRaw.includes(old9));
out.push('NEW_SEC9_D1_PRESENT=' + afterRaw.includes('D1 | `README.md` 仍是 **V4 快照**'));
out.push('NEW_SEC9_SECTIONS=' + ['### 9.1 ', '### 9.2 ', '### 9.3 '].map((s) => afterRaw.includes(s)).join(','));

fs.writeFileSync(ROOT + '\\.r109\\diff_sections.txt', out.join('\n') + '\n', 'utf8');
console.log(out.join('\n'));
