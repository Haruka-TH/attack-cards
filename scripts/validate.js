#!/usr/bin/env node
/* ==========================================================
   validate.js — 檢查卡牌資料是否符合 CLAUDE.md 的規則
   用法：node scripts/validate.js
   只使用 Node.js 內建模組，不需要安裝任何套件
   ========================================================== */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`✗ ${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`! ${file}: ${msg}`);

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    err(path.relative(ROOT, file), `JSON 格式錯誤：${e.message}`);
    return null;
  }
}

const PATTERNS = {
  attack: /^T\d{4}(\.\d{3})?$/,
  defense: /^M\d{4}$/,
  tactic: /^TA\d{4}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
};
const DEFENSE_CATEGORIES = ["人員", "流程", "技術", "偵測"];
const STAT_KEYS = {
  attack: ["danger", "stealth", "prevalence"],
  defense: ["effectiveness", "cost", "difficulty"],
};
const REQUIRED = {
  common: ["id", "type", "name_en", "name_zh", "icon", "stats", "flavor", "summary", "analogy", "how_it_works", "references", "updated"],
  attack: ["tactics", "parent", "examples", "detection", "mitigations"],
  defense: ["category", "practices", "limitations", "counters"],
};
// 粗略偵測「可執行的攻擊內容」，命中時發出警告，請人工確認（CLAUDE.md 第 1 節）
const SUSPICIOUS = [
  /```/, /<script/i, /powershell\s+-/i, /cmd(\.exe)?\s+\/c/i, /\bsudo\s/, /rm\s+-rf/,
  /Invoke-[A-Z]/, /\bnc\s+-[a-z]*e\b/, /mimikatz\s+"/i, /base64\s+-d/i, /curl\s+.*\|\s*(ba)?sh/i,
];

function officialUrl(id) {
  if (id.startsWith("M")) return `https://attack.mitre.org/mitigations/${id}/`;
  return `https://attack.mitre.org/techniques/${id.replace(".", "/")}/`;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function checkStringArray(file, card, key, min, max) {
  const v = card[key];
  if (!Array.isArray(v)) return err(file, `${key} 必須是陣列`);
  if (v.length < min || v.length > max) err(file, `${key} 應有 ${min}～${max} 項，目前 ${v.length} 項`);
  v.forEach((s, i) => { if (!isNonEmptyString(s)) err(file, `${key}[${i}] 必須是非空字串`); });
}

function checkRefList(file, list, key, pattern) {
  if (!Array.isArray(list) || list.length === 0) return err(file, `${key} 必須是非空陣列`);
  const seen = new Set();
  list.forEach((r, i) => {
    if (!r || !pattern.test(r.id)) err(file, `${key}[${i}].id 格式錯誤：${r && r.id}`);
    if (!r || !isNonEmptyString(r.name_en)) err(file, `${key}[${i}].name_en 不可空白`);
    if (r && seen.has(r.id)) err(file, `${key} 有重複的 ${r.id}`);
    if (r) seen.add(r.id);
  });
}

/* ---------- 1. 讀取固定資料 ---------- */
const tacticsData = readJSON(path.join(DATA, "tactics.json"));
const tacticIds = new Set((tacticsData?.tactics || []).map((t) => t.id));
if (tacticIds.size !== 15) err("data/tactics.json", `應有 15 個戰術，目前 ${tacticIds.size} 個`);

const registry = readJSON(path.join(DATA, "registry.json")) || { attack: [], defense: [] };

/* ---------- 2. 檢查 registry ---------- */
const cards = new Map();
for (const type of ["attack", "defense"]) {
  const list = registry[type];
  const rf = "data/registry.json";
  if (!Array.isArray(list)) { err(rf, `缺少 ${type} 陣列`); continue; }

  const sorted = [...list].sort();
  if (list.join() !== sorted.join()) err(rf, `${type} 未依 ID 排序，應為 ${JSON.stringify(sorted)}`);
  if (new Set(list).size !== list.length) err(rf, `${type} 有重複的 ID`);

  const dir = path.join(DATA, type);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
  const fileIds = files.map((f) => f.replace(/\.json$/, ""));

  for (const id of list) {
    if (!PATTERNS[type].test(id)) err(rf, `${type} 中的 ${id} 格式錯誤`);
    if (!fileIds.includes(id)) err(rf, `${id} 列在 registry 但找不到 data/${type}/${id}.json`);
  }
  for (const id of fileIds) {
    if (!list.includes(id)) err(`data/${type}/${id}.json`, `檔案存在但沒有列在 registry.json`);
    const card = readJSON(path.join(dir, `${id}.json`));
    if (card) cards.set(id, { card, type, file: `data/${type}/${id}.json`, fileId: id });
  }
}

/* ---------- 3. 檢查每張卡 ---------- */
for (const { card, type, file, fileId } of cards.values()) {
  for (const k of [...REQUIRED.common, ...REQUIRED[type]]) {
    if (!(k in card)) err(file, `缺少必填欄位 ${k}`);
  }
  if (card.id !== fileId) err(file, `id（${card.id}）與檔名不一致`);
  if (card.type !== type) err(file, `type 應為 "${type}"，目前是 "${card.type}"`);

  for (const k of ["name_en", "name_zh", "icon", "flavor", "summary", "analogy"]) {
    if (k in card && !isNonEmptyString(card[k])) err(file, `${k} 不可空白`);
  }
  if (isNonEmptyString(card.summary) && [...card.summary].length > 40) {
    err(file, `summary 超過 40 字（${[...card.summary].length} 字）`);
  }
  if (card.updated && !PATTERNS.date.test(card.updated)) err(file, `updated 格式應為 YYYY-MM-DD`);

  // 數值
  const stats = card.stats || {};
  for (const k of STAT_KEYS[type]) {
    const v = stats[k];
    if (!Number.isInteger(v) || v < 1 || v > 5) err(file, `stats.${k} 必須是 1～5 的整數`);
  }
  for (const k of Object.keys(stats)) {
    if (!STAT_KEYS[type].includes(k)) err(file, `stats 有不認得的欄位 ${k}`);
  }

  checkStringArray(file, card, "how_it_works", 3, 5);

  // 參考資料
  if (!Array.isArray(card.references) || card.references.length === 0) {
    err(file, "references 至少要有一筆");
  } else {
    if (card.references[0].url !== officialUrl(card.id)) {
      err(file, `references 第一筆必須是 ATT&CK 官方頁面：${officialUrl(card.id)}`);
    }
    card.references.forEach((r, i) => {
      if (!isNonEmptyString(r.title)) err(file, `references[${i}].title 不可空白`);
      if (!/^https:\/\//.test(r.url || "")) err(file, `references[${i}].url 必須是 https 網址`);
    });
  }

  if (type === "attack") {
    if (!Array.isArray(card.tactics) || card.tactics.length === 0) err(file, "tactics 至少要有一個");
    else card.tactics.forEach((t) => { if (!tacticIds.has(t)) err(file, `tactics 中的 ${t} 不在 tactics.json`); });

    if (card.parent !== null) {
      if (!PATTERNS.attack.test(card.parent || "")) err(file, "parent 必須是 null 或技術 ID");
      else if (!card.id.startsWith(card.parent + ".")) err(file, `parent（${card.parent}）與子技術 ID 不符`);
    } else if (card.id.includes(".")) {
      err(file, "子技術的 parent 不可為 null");
    }

    if (!Array.isArray(card.examples) || card.examples.length < 1 || card.examples.length > 3) {
      err(file, "examples 應有 1～3 個");
    } else {
      card.examples.forEach((ex, i) => {
        if (!isNonEmptyString(ex.title) || !isNonEmptyString(ex.description)) err(file, `examples[${i}] 缺少 title 或 description`);
        if (!/^https:\/\//.test(ex.url || "")) err(file, `examples[${i}].url 必須是 https 網址`);
      });
    }
    checkStringArray(file, card, "detection", 2, 6);
    checkRefList(file, card.mitigations, "mitigations", PATTERNS.defense);
  } else {
    if (!DEFENSE_CATEGORIES.includes(card.category)) err(file, `category 只能是 ${DEFENSE_CATEGORIES.join("、")}`);
    checkStringArray(file, card, "practices", 2, 6);
    checkStringArray(file, card, "limitations", 1, 5);
    checkRefList(file, card.counters, "counters", PATTERNS.attack);
  }

  // 內容定位檢查
  const text = JSON.stringify(card);
  for (const re of SUSPICIOUS) {
    if (re.test(text)) warn(file, `出現疑似指令或程式碼的內容（${re}），請確認符合「只做認識與防禦」的規則`);
  }
}

/* ---------- 4. 雙向連結 ---------- */
for (const { card, type, file } of cards.values()) {
  const refs = type === "attack" ? card.mitigations : card.counters;
  if (!Array.isArray(refs)) continue;
  for (const ref of refs) {
    const other = cards.get(ref.id);
    if (!other) continue; // 未收錄的卡不需檢查
    const back = other.type === "attack" ? other.card.mitigations : other.card.counters;
    if (!Array.isArray(back) || !back.some((r) => r.id === card.id)) {
      const field = other.type === "attack" ? "mitigations" : "counters";
      err(file, `連到 ${ref.id}，但 ${other.file} 的 ${field} 沒有連回 ${card.id}（雙向連結未同步）`);
    }
    if (ref.name_en !== other.card.name_en) {
      err(file, `${ref.id} 的 name_en（${ref.name_en}）與該卡（${other.card.name_en}）不一致`);
    }
  }
}

/* ---------- 5. 結果 ---------- */
const nAttack = [...cards.values()].filter((c) => c.type === "attack").length;
const nDefense = cards.size - nAttack;
console.log(`\n[validate] 攻擊卡 ${nAttack} 張、防禦卡 ${nDefense} 張\n`);
warnings.forEach((w) => console.log(w));
errors.forEach((e) => console.log(e));

if (errors.length) {
  console.log(`\nFAILED：${errors.length} 個錯誤、${warnings.length} 個警告\n`);
  process.exit(1);
}
console.log(`PASSED：0 個錯誤、${warnings.length} 個警告\n`);
