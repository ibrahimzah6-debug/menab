// Menab's stored translations (src/lib/i18n/locales/*.json).
//   node scripts/i18n.mjs export <file> writes the English texts as a numbered list (i18n-en.txt)
//   node scripts/i18n.mjs build <code> <file>   turns a numbered list "N<TAB>text" into <code>.json
//   node scripts/i18n.mjs check         lists how many texts each language still lacks
// Numbers follow the order of the English dictionary. Placeholders like {n} must stay as they are.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const en = JSON.parse(execSync(`npx tsx -e 'import { dictionaries } from "./src/lib/i18n/dictionaries"; process.stdout.write(JSON.stringify(dictionaries.en))'`, { encoding: "utf8", maxBuffer: 1 << 26 }));
const list = [];
const walk = (x, p) => {
  if (typeof x === "string") list.push([p, x]);
  else if (Array.isArray(x)) x.forEach((v, i) => walk(v, [...p, i]));
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) walk(v, [...p, k]);
};
walk(en, []);
const get = (o, p) => p.reduce((a, k) => (a == null ? undefined : a[k]), o);
const holes = (s) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(",");
const [cmd, code, file] = process.argv.slice(2);

if (cmd === "export") {
  writeFileSync(code ?? "i18n-en.txt", list.map(([, v], i) => `${i}\t${v}`).join("\n") + "\n");
  console.log(`${list.length} texts`);
} else if (cmd === "build") {
  const lines = readFileSync(file, "utf8").split("\n").filter((l) => /^\d+\t/.test(l));
  const map = new Map(lines.map((l) => { const i = l.indexOf("\t"); return [Number(l.slice(0, i)), l.slice(i + 1)]; }));
  const outPath = `src/lib/i18n/locales/${code}.json`;
  const out = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : {};
  let bad = 0, n = 0;
  list.forEach(([p, v], i) => {
    if (!map.has(i)) return;
    const t = map.get(i);
    if (holes(t) !== holes(v)) { bad++; console.log(`placeholder mismatch ${i}: ${v} => ${t}`); return; }
    let o = out;
    p.forEach((k, j) => {
      if (j === p.length - 1) o[k] = t;
      else { if (o[k] == null) o[k] = typeof p[j + 1] === "number" ? [] : {}; o = o[k]; }
    });
    n++;
  });
  writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n");
  console.log(`${code}: ${n} written, ${bad} skipped`);
} else if (cmd === "check") {
  for (const c of ["am", "ur", "hi", "id", "tr", "fr", "es", "de", "pt", "ru", "zh"]) {
    const p = `src/lib/i18n/locales/${c}.json`;
    const tr = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
    const missing = list.filter(([path]) => { const t = get(tr, path); return typeof t !== "string" || !t.trim(); });
    console.log(`${c}: ${missing.length} missing${missing.length ? ` (first: ${missing.slice(0, 3).map(([path]) => path.join(".")).join(", ")})` : ""}`);
  }
}
