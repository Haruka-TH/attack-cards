/* ==========================================================
   index.js — 首頁：收集進度、戰術矩陣、牌庫
   資料來源：data/tactics.json、data/registry.json、data/attack|defense/*.json
   ========================================================== */

(async () => {
  const $ = (sel) => document.querySelector(sel);

  let tactics, cards;
  try {
    [tactics, cards] = await Promise.all([ACK.loadTactics(), ACK.loadAllCards()]);
  } catch (err) {
    $("#stats").innerHTML = `<p class="notice">ERROR: 資料讀取失敗（${ACK.esc(err.message)}）。若是直接開啟檔案，請改用本機伺服器預覽，詳見 README。</p>`;
    console.error(err);
    return;
  }

  /* ---------- 收集進度 ---------- */
  const totalTech = tactics.list.reduce((sum, t) => sum + t.total, 0);
  const unlockedTactics = tactics.list.filter((t) =>
    cards.attack.some((c) => c.tactics.includes(t.id))
  ).length;
  // 一張卡屬於多個戰術時，會佔用多個格子（與矩陣欄首的進度一致）
  const unlockedCells = cards.attack.reduce((sum, c) => sum + c.tactics.length, 0);

  $("#stats").innerHTML = `
    <div class="stat-box stat-box--attack">
      <div class="stat-box__label">攻擊卡 / attack</div>
      <div class="stat-box__value">${cards.attack.length}</div>
    </div>
    <div class="stat-box stat-box--defense">
      <div class="stat-box__label">防禦卡 / defense</div>
      <div class="stat-box__value">${cards.defense.length}</div>
    </div>
    <div class="stat-box stat-box--term">
      <div class="stat-box__label">已解鎖戰術 / tactics</div>
      <div class="stat-box__value">${unlockedTactics}<small style="font-size:14px;color:var(--muted)"> / ${tactics.list.length}</small></div>
    </div>
    <div class="stat-box">
      <div class="stat-box__label">矩陣格子解鎖 / cells</div>
      <div class="stat-box__value" style="color:var(--warn)">${unlockedCells}<small style="font-size:14px;color:var(--muted)"> / ${totalTech}</small></div>
    </div>`;

  /* ---------- 戰術矩陣 ---------- */
  $("#matrix-grid").innerHTML = tactics.list
    .map((t) => {
      const inCol = cards.attack.filter((c) => c.tactics.includes(t.id));
      const body = inCol.length
        ? inCol.map((c) => ACK.renderMini(c)).join("")
        : `<span class="locked">[ LOCKED ]</span>`;
      return `
        <div class="matrix__col">
          <div class="matrix__head">
            <span class="matrix__head-zh">${ACK.esc(t.name_zh)}</span>
            <span class="matrix__head-en">${ACK.esc(t.name_en)}</span>
            <span class="matrix__head-id">${t.id}</span>
            <span class="matrix__progress">${inCol.length} / ${t.total}</span>
          </div>
          ${body}
        </div>`;
    })
    .join("");

  /* ---------- 牌庫 ---------- */
  const state = { type: "attack", filter: "all" };
  const DEFENSE_CATEGORIES = ["人員", "流程", "技術", "偵測"];

  function filterOptions() {
    if (state.type === "attack") {
      const used = tactics.list.filter((t) => cards.attack.some((c) => c.tactics.includes(t.id)));
      return used.map((t) => ({ value: t.id, label: t.name_zh }));
    }
    return DEFENSE_CATEGORIES.filter((cat) => cards.defense.some((c) => c.category === cat)).map(
      (cat) => ({ value: cat, label: cat })
    );
  }

  function renderFilters() {
    const opts = [{ value: "all", label: "全部" }, ...filterOptions()];
    $("#filters").innerHTML = opts
      .map(
        (o) =>
          `<button class="btn" data-filter="${ACK.esc(o.value)}" aria-pressed="${state.filter === o.value}">--${ACK.esc(o.label)}</button>`
      )
      .join("");
  }

  function renderDeck() {
    const list = cards[state.type].filter((c) => {
      if (state.filter === "all") return true;
      return state.type === "attack" ? c.tactics.includes(state.filter) : c.category === state.filter;
    });
    const filterText = state.filter === "all" ? "" : ` | grep ${state.filter}`;
    $("#deck-cmd").textContent = `ls ./deck/${state.type}${filterText}`;
    $("#deck-grid").innerHTML = list.length
      ? list.map((c) => ACK.renderCard(c, tactics.map)).join("")
      : `<p class="empty">（空的，這個分類還沒有卡牌）</p>`;
  }

  document.querySelectorAll("[data-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.type = btn.dataset.type;
      state.filter = "all";
      document
        .querySelectorAll("[data-type]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      renderFilters();
      renderDeck();
    });
  });

  $("#filters").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    state.filter = btn.dataset.filter;
    renderFilters();
    renderDeck();
  });

  renderFilters();
  renderDeck();
})();
