// .r109/reorder.mjs —— 第 109 轮 SPEC 物理重排（纯机械块搬移，不改任何技术描述文字）
// 三件事：①摘除 §6.61 块内那行重复段落（尾部带 §6.60 标题残片）；②按编号顺序重排块；③块间统一恰一空行。
// 不含任何 bash 参与，读写显式 utf8；重排前后做「非空行多重集」差分，证明只动了物理位置。
import fs from 'node:fs';

const ROOT = 'D:\\vibe coding\\another-life';
const SPEC = ROOT + '\\SPEC.md';
const OUT_DIR = ROOT + '\\.r109';
fs.mkdirSync(OUT_DIR, { recursive: true });

const raw = fs.readFileSync(SPEC, 'utf8');
if (raw.includes('\r')) throw new Error('unexpected CR in SPEC.md');
if (raw.charCodeAt(0) === 0xfeff) throw new Error('unexpected BOM');

let lines = raw.split('\n');
console.log('BEFORE lines=' + lines.length + ' chars=' + raw.length);

// ---------- step 1: 找重复段落（长行 + 空行 + 以它为前缀的更长行）
const cand = [];
for (let i = 0; i + 2 < lines.length; i++) {
  const cur = lines[i];
  if (cur.length < 300) continue;
  if (lines[i + 1] !== '') continue;
  const nxt = lines[i + 2];
  if (nxt.length < 300) continue;
  if (cur.startsWith(nxt) && cur.length > nxt.length) cand.push(i);
}
if (cand.length !== 1) throw new Error('dedup candidates != 1: ' + JSON.stringify(cand));
const dupIdx = cand[0];
const keptLine = lines[dupIdx + 2];
const frag = lines[dupIdx].slice(keptLine.length);
fs.writeFileSync(
  OUT_DIR + '\\dedup_evidence.txt',
  'dupLine(1-based)=' + (dupIdx + 1) + '\n' +
  'keptLine(1-based)=' + (dupIdx + 3) + '\n' +
  'dupLen=' + lines[dupIdx].length + '\n' +
  'keptLen=' + keptLine.length + '\n' +
  'dupStartsWithKept=' + lines[dupIdx].startsWith(keptLine) + '\n' +
  'orphanFragment=' + frag + '\n' +
  'orphanFragmentLen=' + frag.length + '\n',
  'utf8'
);
console.log('DEDUP dupLine=' + (dupIdx + 1) + ' keptLine=' + (dupIdx + 3) +
  ' dupLen=' + lines[dupIdx].length + ' keptLen=' + keptLine.length + ' fragLen=' + frag.length);
lines.splice(dupIdx, 1);
console.log('AFTER-DEDUP lines=' + lines.length);

// ---------- step 2: 定位块边界（全部 ASCII 锚点）
function idx1(re) {
  const hits = [];
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) hits.push(i);
  if (hits.length !== 1) throw new Error('anchor ' + re + ' hits=' + hits.length);
  return hits[0];
}
const i635 = idx1(/^#{2,3} 6\.35 /);
const i636 = idx1(/^#{2,3} 6\.36 /);
const i637 = idx1(/^#{2,3} 6\.37 /);
const i652 = idx1(/^#{2,3} 6\.52 /);
const i659 = idx1(/^#{2,3} 6\.59 /);
const i660 = idx1(/^#{2,3} 6\.60 /);
const i661 = idx1(/^#{2,3} 6\.61 /);
const i662 = idx1(/^#{2,3} 6\.62 /);
const i671 = idx1(/^#{2,3} 6\.71 /);
const i7 = idx1(/^#{2,3} 7\. /);
const i10 = idx1(/^#{2,3} 10\. /);
const i672 = idx1(/^#{2,3} 6\.72 /);
const i673 = idx1(/^#{2,3} 6\.73 /);
const i10b = idx1(/^#{2,3} 10b\. /);
const i8 = idx1(/^#{2,3} 8\. /);
const i9 = idx1(/^#{2,3} 9\. /);

const bounds = [...new Set([0, i635, i637, i636, i652, i659, i661, i660, i662, i671,
  i7, i10, i672, i673, i10b, i8, i9, lines.length])].sort((a, b) => a - b);
for (let k = 1; k < bounds.length; k++) {
  if (bounds[k] <= bounds[k - 1]) throw new Error('bounds not increasing at ' + k + ': ' + JSON.stringify(bounds));
}

const units = [];
for (let k = 0; k + 1 < bounds.length; k++) {
  units.push({ start: bounds[k], end: bounds[k + 1], lines: lines.slice(bounds[k], bounds[k + 1]) });
}

function keyOf(first) {
  const m = /^(#{2,3}) (\d+)([a-z]?)(?:\.(\d+))?/.exec(first);
  if (!m) return 'HEAD';
  return m[2] + m[3] + (m[4] !== undefined ? '.' + m[4] : '');
}

const keys = units.map((u) => keyOf(u.lines[0]));
const expectedKeys = ['HEAD', '6.35', '6.37', '6.36', '6.52', '6.59', '6.61',
  '6.60', '6.62', '6.71', '7', '10', '6.72', '6.73', '10b', '8', '9'];
if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
  throw new Error('unit keys drift:\n got=' + JSON.stringify(keys) + '\n exp=' + JSON.stringify(expectedKeys));
}

const desired = ['HEAD', '6.35', '6.36', '6.37', '6.52', '6.59', '6.60', '6.61',
  '6.62', '6.71', '6.72', '6.73', '7', '8', '9', '10', '10b'];
const used = new Set();
const perm = desired.map((k) => {
  const at = keys.indexOf(k);
  if (at < 0) throw new Error('desired key missing: ' + k);
  if (used.has(at)) throw new Error('duplicate unit in permutation: ' + k);
  used.add(at);
  return at;
});
if (used.size !== units.length) throw new Error('permutation does not cover all units');

const outUnits = perm.map((i) => {
  const ls = units[i].lines.slice();
  while (ls.length && ls[ls.length - 1].trim() === '') ls.pop();
  return ls.join('\n');
});
const out = outUnits.join('\n\n') + '\n';
if (out.includes('\r')) throw new Error('CR leaked into output');

// ---------- step 3: 非空行多重集差分（内容保全证明）
function multiset(arr) {
  const m = new Map();
  for (const l of arr) m.set(l, (m.get(l) || 0) + 1);
  return m;
}
const beforeNB = raw.split('\n').filter((l) => l.trim() !== '');
const afterNB = out.split('\n').filter((l) => l.trim() !== '');
const mb = multiset(beforeNB);
const ma = multiset(afterNB);
const added = [];
const removed = [];
for (const [k, v] of ma) { const w = mb.get(k) || 0; if (v > w) added.push([v - w, k]); }
for (const [k, v] of mb) { const w = ma.get(k) || 0; if (v > w) removed.push([v - w, k]); }

const hdrsBefore = raw.split('\n').filter((l) => /^#{2,3} /.test(l)).length;
const hdrsAfter = out.split('\n').filter((l) => /^#{2,3} /.test(l)).length;

const hdrList = [];
out.split('\n').forEach((l, i) => { if (/^#{2,3} /.test(l)) hdrList.push((i + 1) + ': ' + l); });
fs.writeFileSync(OUT_DIR + '\\headings_after.txt', hdrList.join('\n') + '\n', 'utf8');

const summary = {
  before: { lines: lines.length + 1, chars: raw.length, headings: hdrsBefore, nonBlank: beforeNB.length },
  after: { lines: out.split('\n').length, chars: out.length, headings: hdrsAfter, nonBlank: afterNB.length },
  dedup: { dupLine1Based: dupIdx + 1, keptLine1Based: dupIdx + 3, dupLen: keptLine.length + frag.length, keptLen: keptLine.length, fragLen: frag.length },
  multisetAdded: added.map((x) => x[0]),
  multisetRemoved: removed.map((x) => x[0]),
  multisetRemovedIsSingleDup: removed.length === 1 && removed[0][0] === 1 &&
    (removed[0][1].startsWith(keptLine)),
  permutation: perm,
  unitKeys: keys
};
fs.writeFileSync(OUT_DIR + '\\reorder_summary.json', JSON.stringify(summary, null, 2) + '\n', 'utf8');

console.log('HEADINGS before=' + hdrsBefore + ' after=' + hdrsAfter);
console.log('NONBLANK before=' + beforeNB.length + ' after=' + afterNB.length);
console.log('MULTISET added=' + JSON.stringify(added.map((x) => x[0])) + ' removed=' + JSON.stringify(removed.map((x) => x[0])));
console.log('MULTISET removedIsSingleDuplicateOfKept=' + summary.multisetRemovedIsSingleDup);
console.log('OUT lines=' + out.split('\n').length + ' chars=' + out.length);

if (added.length !== 0) throw new Error('content ADDED — refusing to write: ' + JSON.stringify(added.map((x) => x[1].slice(0, 40))));
if (removed.length !== 1 || removed[0][0] !== 1) throw new Error('unexpected removal set — refusing to write');
if (hdrsBefore !== hdrsAfter) throw new Error('heading count changed');

fs.writeFileSync(SPEC, out, 'utf8');
console.log('WROTE ' + SPEC);
