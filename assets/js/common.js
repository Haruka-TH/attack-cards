/* ==========================================================
   common.js — 共用工具：讀取資料、產生卡牌 HTML
   新增卡牌不需要修改這個檔案
   ========================================================== */

const ACK = (() => {
  const ID_PATTERN = /^(T\d{4}(\.\d{3})?|M\d{4})$/;

  const STAT_LABELS = {
    attack: { danger: "危險度", stealth: "隱匿度", prevalence: "常見度" },
    defense: { effectiveness: "防禦效果", cost: "導入成本", difficulty: "導入難度" },
  };

  const cache = new Map();

  async function loadJSON(path) {
    if (cache.has(path)) return cache.get(path);
    const p = fetch(path).then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${path}`);
      return res.json();
    });
    cache.set(path, p);
    return p;
  }

  function typeOf(id) {
    return id.startsWith("M") ? "defense" : "attack";
  }

  function cardPath(id) {
    return `data/${typeOf(id)}/${id}.json`;
  }

  function officialUrl(id) {
    if (id.startsWith("M")) return `https://attack.mitre.org/mitigations/${id}/`;
    return `https://attack.mitre.org/techniques/${id.replace(".", "/")}/`;
  }

  async function loadTactics() {
    const data = await loadJSON("data/tactics.json");
    const list = [...data.tactics].sort((a, b) => a.order - b.order);
    const map = Object.fromEntries(list.map((t) => [t.id, t]));
    return { list, map };
  }

  async function loadRegistry() {
    return loadJSON("data/registry.json");
  }

  async function loadCard(id) {
    return loadJSON(cardPath(id));
  }

  async function loadAllCards() {
    const reg = await loadRegistry();
    const ids = [...reg.attack, ...reg.defense];
    const cards = await Promise.all(ids.map((id) => loadCard(id)));
    return {
      attack: cards.filter((c) => c.type === "attack"),
      defense: cards.filter((c) => c.type === "defense"),
    };
  }

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** 5 格數值條：實心格代表分數 */
  function statBar(n) {
    const v = Math.max(0, Math.min(5, Number(n) || 0));
    return Array.from({ length: 5 }, (_, i) => `<i class="pip${i < v ? " on" : ""}"></i>`).join("");
  }

  function attrTags(card, tacticsMap) {
    if (card.type === "attack") {
      return card.tactics
        .map((t) => `<span class="tag">${esc(tacticsMap[t]?.name_zh ?? t)}</span>`)
        .join("");
    }
    return `<span class="tag">${esc(card.category)}</span>`;
  }

  /** 一般卡 / 大卡 */
  function renderCard(card, tacticsMap, { full = false, link = true } = {}) {
    const tag = link ? "a" : "div";
    const href = link ? ` href="card.html?id=${encodeURIComponent(card.id)}"` : "";
    const labels = STAT_LABELS[card.type];
    const stats = Object.entries(labels)
      .map(
        ([k, label]) =>
          `<div><dt>${label}</dt><dd aria-label="${card.stats[k]} / 5">${statBar(card.stats[k])}</dd></div>`
      )
      .join("");
    return `
      <${tag} class="card card--${card.type}${full ? " card--full" : ""}"${href}>
        <div class="card__bar">
          <span>${esc(card.id)}</span>
          <span>${card.type === "attack" ? "ATTACK" : "DEFENSE"}</span>
        </div>
        <div class="card__art" aria-hidden="true">${esc(card.icon)}</div>
        <div class="card__name">
          <strong>${esc(card.name_zh)}</strong>
          <small>${esc(card.name_en)}</small>
        </div>
        <div class="card__attr">${attrTags(card, tacticsMap)}</div>
        <dl class="card__stats">${stats}</dl>
        <p class="card__flavor">${esc(card.flavor)}</p>
      </${tag}>`;
  }

  /** 小卡：矩陣與剋制關係使用 */
  function renderMini(card) {
    return `
      <a class="card card--mini card--${card.type}" href="card.html?id=${encodeURIComponent(card.id)}">
        <div class="card__bar"><span>${esc(card.id)}</span></div>
        <div class="card__mini-body">
          <span class="card__mini-icon" aria-hidden="true">${esc(card.icon)}</span>
          <span>${esc(card.name_zh)}</span>
        </div>
      </a>`;
  }

  /** 未收錄的卡：連到 ATT&CK 官方頁面 */
  function renderGhost(ref) {
    return `
      <a class="ghost" href="${officialUrl(ref.id)}" target="_blank" rel="noopener">
        <b>[ LOCKED ] ${esc(ref.id)}</b>${esc(ref.name_en)} ↗
      </a>`;
  }

  return {
    ID_PATTERN,
    STAT_LABELS,
    loadJSON,
    loadTactics,
    loadRegistry,
    loadCard,
    loadAllCards,
    officialUrl,
    esc,
    statBar,
    renderCard,
    renderMini,
    renderGhost,
  };
})();
