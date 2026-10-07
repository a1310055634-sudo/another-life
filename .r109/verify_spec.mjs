// .r109/verify_spec.mjs —— 第 109 轮 SPEC 治理验收（A1–A5 机器判据）
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:\\vibe coding\\another-life';
const SPEC = ROOT + '\\SPEC.md';
const raw = fs.readFileSync(SPEC, 'utf8');
const lines = raw.split('\n');

const out = [];
const say = (s) => { out.push(s); };
let fails = 0;
const check = (name, ok, detail) => { say((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : '')); if (!ok) fails++; };

// ---------- 全量标题表
const heads = [];
lines.forEach((l, i) => { if (/^#{2,3} /.test(l)) heads.push({ n: i + 1, text: l }); });
say('TOTAL_H2H3_HEADINGS=' + heads.length);

// ---------- A1: §6 小节标题编号严格递增且 = 物理顺序
const tok = (text) => {
  const m = /^(#{2,3}) (\d+)([a-z]?)(?:\.(\d+))?/.exec(text);
  if (!m) return null;
  return { lvl: m[1].length, major: +m[2], suf: m[3] || '', minor: m[4] === undefined ? 0 : +m[4], raw: m[2] + m[3] + (m[4] === undefined ? '' : '.' + m[4]) };
};
const h6 = heads.filter((h) => /^#{2,3} 6\./.test(h.text)).map((h) => ({ ...h, t: tok(h.text) }));
const key6 = (t) => t.major * 100000 + t.minor * 10 + (t.suf === '' ? 0 : t.suf.charCodeAt(0) - 96);
let mono6 = true, bad6 = [];
for (let i = 1; i < h6.length; i++) {
  if (key6(h6[i].t) <= key6(h6[i - 1].t)) { mono6 = false; bad6.push(h6[i - 1].t.raw + ' -> ' + h6[i].t.raw); }
}
check('A1 编号严格递增且与物理顺序一致', mono6, 'count=' + h6.length + ' inversions=' + JSON.stringify(bad6));
say('A1_SEQ=' + h6.map((h) => h.t.raw).join(','));
say('A1_LINES=' + h6.map((h) => h.n + ':' + h.t.raw).join(' '));

// ---------- A2: ^### 6. 零命中
const a2 = heads.filter((h) => /^### 6\./.test(h.text));
check('A2 §6 小节无 ### 层级', a2.length === 0, 'hits=' + JSON.stringify(a2.map((h) => h.n + ':' + h.text)));

// ---------- A3: 标题缺空格（正确正则：节号可含后缀字母与多段小数，且不可回溯吃掉分隔空格）
const A3_RE = /^#+ [0-9]+[a-z]?(\.[0-9]+)*[^\s0-9a-z.]/;
const a3 = heads.filter((h) => A3_RE.test(h.text));
check('A3 无缺空格的节号（^#+ [0-9]+[a-z]?(\\.[0-9]+)*[^\\s0-9a-z.]）', a3.length === 0, 'hits=' + JSON.stringify(a3.map((h) => h.n + ':' + h.text)));
// 任务书原正则（存在回溯假阳性）——如实并列报告
const a3tb = heads.filter((h) => /^#+ [0-9]+\.[0-9]+[^ ]/.test(h.text));
say('A3_TASKBOOK_REGEX_HITS=' + a3tb.length + ' (原正则 ^#+ [0-9]+\\.[0-9]+[^ ] 会因 [0-9]+ 回溯把 "## 6.10 " 判成缺空格)');
say('A3_TASKBOOK_FALSE_POSITIVE_SAMPLE=' + a3tb.slice(0, 3).map((h) => h.n + ':' + h.text).join(' | '));

// ---------- A4: 全文 ^## 物理顺序 = 编号顺序
const h2 = heads.filter((h) => /^## /.test(h.text)).map((h) => ({ ...h, t: tok(h.text) }));
const keyAll = (t) => t.major * 1000000 + t.minor * 100 + (t.suf === '' ? 0 : t.suf.charCodeAt(0) - 96);
// §1..§5 的 minor 槽与 §6.x 不同量纲，只对 major 分段校验：major 必须非减；同 major 内 minor 递增；同 minor 内后缀递增
let monoAll = true, badAll = [];
for (let i = 1; i < h2.length; i++) {
  const p = h2[i - 1].t, c = h2[i].t;
  if (c.major < p.major) { monoAll = false; badAll.push(p.raw + ' -> ' + c.raw); continue; }
  if (c.major === p.major && c.minor < p.minor) { monoAll = false; badAll.push(p.raw + ' -> ' + c.raw); continue; }
  if (c.major === p.major && c.minor === p.minor && (c.suf || '') < (p.suf || '')) { monoAll = false; badAll.push(p.raw + ' -> ' + c.raw); }
}
check('A4 全文 ## 物理顺序 = 编号顺序', monoAll, 'count=' + h2.length + ' inversions=' + JSON.stringify(badAll));
say('A4_SEQ=' + h2.map((h) => h.t.raw).join(','));
say('A4_LINES=' + h2.map((h) => h.n + ':' + h.t.raw).join(' '));

// ---------- A5: 节号引用零破坏（§6.x 必须全部命中；裸 §N 单列供人工复核）
const specTokens = new Set(heads.map((h) => tok(h.text)).filter(Boolean).map((t) => t.raw));
const walk = (dir, acc) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/^(node_modules|dist|\.git|\.r\d+)$/.test(e.name)) walk(full, acc); continue; }
    if (!/\.(ts|tsx|mjs|js|md)$/.test(e.name)) continue;
    if (/^(SPEC\.md|PROGRESS\.md)$/.test(e.name)) continue;
    acc.push(full);
  }
  return acc;
};
const files = walk(ROOT, []);
const ref6 = new Map();
const refBare = new Map();
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  const rel = f.slice(ROOT.length + 1);
  for (const m of txt.matchAll(/§(\d+)([a-z]?)(?:\.(\d+))?/g)) {
    const t = m[1] + (m[2] || '') + (m[3] === undefined || m[3] === null ? '' : '.' + m[3]);
    const bucket = m[3] === undefined ? refBare : ref6;
    if (!bucket.has(t)) bucket.set(t, []);
    bucket.get(t).push(rel);
  }
}
const miss6 = [...ref6.keys()].filter((t) => !specTokens.has(t));
check('A5 §6.x 引用全部仍指向存在的章节', miss6.length === 0, 'refs=' + [...ref6.keys()].sort().join(',') + ' missing=' + JSON.stringify(miss6));
say('A5_REF6=' + [...ref6.entries()].sort().map(([t, fs_]) => t + '(' + fs_.length + ')').join(' '));
say('A5_REF_BARE=' + [...refBare.entries()].sort().map(([t, fs_]) => '§' + t + '(' + fs_.length + ': ' + [...new Set(fs_)].join(',') + ')').join(' | '));
say('A5_BARE_MISSING_IN_SPEC=' + JSON.stringify([...refBare.keys()].filter((t) => !specTokens.has(t))));

// ---------- 重复段落复查（结构自洽）
const nb = lines.filter((l) => l.trim() !== '');
const seen = new Map();
for (const l of nb) if (l.length > 200) seen.set(l, (seen.get(l) || 0) + 1);
const dupLong = [...seen.entries()].filter(([, v]) => v > 1);
say('LONG_DUPLICATE_LINES=' + dupLong.length + (dupLong.length ? ' :: ' + dupLong.map(([l, v]) => v + 'x:' + l.slice(0, 30)).join(' | ') : ''));

say('BYTES=' + Buffer.byteLength(raw, 'utf8') + ' CHARS_UTF16=' + raw.length + ' LINES=' + (lines.length - 1));
say(fails === 0 ? 'RESULT_ALL_PASS' : 'RESULT_FAILS=' + fails);
fs.writeFileSync(ROOT + '\\.r109\\verify_spec_out.txt', out.join('\n') + '\n', 'utf8');
console.log(out.join('\n'));
process.exit(fails === 0 ? 0 : 1);
