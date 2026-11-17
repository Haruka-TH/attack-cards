/* ==========================================================
   card.js — 卡牌詳解頁（card.html?id=T1566）
   段落順序與指令名稱對應 CLAUDE.md 第 5 節
   ========================================================== */

(async () => {
  const $ = (sel) => document.querySelector(sel);
  const esc = ACK.esc;
  const main = $("#detail");

  const id = (new URLSearchParams(location.search).get("id") || "").trim().toUpperCase();

  function notFound(msg) {
    $("#cmd-line").textContent = `cat ${id || "<empty>"}`;
    main.innerHTML = `
      <div class="detail" style="grid-template-columns:1fr">
        <div>
          <p class="notice">cat: ${esc(id || "（沒有指定 id）")}: ${esc(msg)}</p>
          <a class="back" href="index.html">← cd ~ 回到首頁</a>
        </div>
      </div>`;
  }

  if (!ACK.ID_PATTERN.test(id)) return notFound("ID 格式不正確，應為 T1234、T1234.001 或 M1234");

  let tactics, registry, card;
  try {
    [tactics, registry] = await Promise.all([ACK.loadTactics(), ACK.loadRegistry()]);
  } catch (err) {
    return notFound(`資料讀取失敗（${err.message}）`);
  }

  const collected = new Set([...registry.attack, ...registry.defense]);
  if (!collected.has(id)) {
    notFound("這張卡還沒有收錄（LOCKED）");
    main.querySelector(".notice").insertAdjacentHTML(
      "afterend",
      `<p style="margin-top:12px">可以先到 <a href="${ACK.officialUrl(id)}" target="_blank" rel="noopener">ATT&amp;CK 官方頁面 ↗</a> 看看。</p>`
    );
    return;
  }

  try {
    card = await ACK.loadCard(id);
  } catch (err) {
    return notFound(`找不到卡牌檔案（${err.message}）`);
  }

  const isAttack = card.type === "attack";
  document.title = `${card.id} ${card.name_zh} | ATT&CK 卡牌知識庫`;
  $("#win-path").textContent = `guest@attack-cards: ~/deck/${card.type}`;
  $("#cmd-line").textContent = `cat ./${card.type}/${card.id}.card`;
  $("#official-link").href = ACK.officialUrl(card.id);
  $("#official-link").textContent = `${card.id} @ mitre-attack ↗`;

  /* ---------- 各段落 ---------- */
  const block = (cmd, html) => `
    <section class="block">
      <h2 class="cmd">${esc(cmd)}</h2>
      ${html}
    </section>`;
  const list = (items, ordered = false) => {
    const tag = ordered ? "ol" : "ul";
    return `<${tag} class="out">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</${tag}>`;
  };

  // 剋制關係
  // 已收錄的卡排前面，其餘維持原順序
  const refs = [...(isAttack ? card.mitigations : card.counters)].sort(
    (a, b) => collected.has(b.id) - collected.has(a.id)
  );
  const counterCards = await Promise.all(
    refs.map(async (ref) => {
      if (!collected.has(ref.id)) return ACK.renderGhost(ref);
      try {
        return ACK.renderMini(await ACK.loadCard(ref.id));
      } catch {
        return ACK.renderGhost(ref);
      }
    })
  );
  const counterTitle = isAttack
    ? "可以用這些 <span style='color:var(--defense)'>藍卡</span> 防禦："
    : "這張卡可以剋制這些 <span style='color:var(--attack)'>紅卡</span>：";

  const sections = [
    block("cat summary.txt", `<p>${esc(card.summary)}</p>`),
    block("cat analogy.txt", `<p>${esc(card.analogy)}</p>`),
    block("./explain --how", list(card.how_it_works, true)),
  ];

  if (isAttack) {
    sections.push(
      block(
        'grep -r "incident" ./cases',
        card.examples
          .map(
            (ex) => `
          <article class="case" style="--c:var(--attack)">
            <h3>${esc(ex.title)}</h3>
            <p>${esc(ex.description)}</p>
            <a href="${esc(ex.url)}" target="_blank" rel="noopener">來源 ↗</a>
          </article>`
          )
          .join("")
      ),
      block("tail -f /var/log/detect", list(card.detection))
    );
  } else {
    sections.push(
      block("./deploy --checklist", list(card.practices)),
      block("cat known_issues.txt", list(card.limitations))
    );
  }

  sections.push(
    block(
      "./counter --list",
      `<p style="margin-bottom:12px">${counterTitle}</p>
       <div class="counter-grid">${counterCards.join("")}</div>
       <p class="section__hint" style="margin:10px 0 0">灰色虛線為尚未收錄的卡，點擊會開啟 ATT&amp;CK 官方頁面。</p>`
    ),
    block(
      "cat references.bib",
      `<ul class="out">${card.references
        .map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a></li>`)
        .join("")}</ul>`
    )
  );

  main.innerHTML = `
    <div class="detail">
      <aside class="detail__aside">
        ${ACK.renderCard(card, tactics.map, { full: true, link: false })}
        <div class="detail__meta">last-modified: ${esc(card.updated)}</div>
        <a class="back" href="index.html#deck">← cd ../ 回到牌庫</a>
      </aside>
      <div class="detail__main">${sections.join("")}</div>
    </div>`;
})();
