# 🃏 ATT&CK 卡牌知識庫

以 [MITRE ATT&CK®](https://attack.mitre.org/) 為架構的**個人資安知識庫**。
每個攻擊技術是一張 🟥 **紅色攻擊卡**，每個緩解措施是一張 🟦 **藍色防禦卡**，兩種卡彼此連結，呈現「這招被哪張卡剋制」。

- 首頁的戰術矩陣顯示學習進度：已收錄的卡會亮起，未收錄的顯示 `[ LOCKED ]`
- 每張卡都有固定格式的中文講解：白話解釋、比喻、運作原理、真實案例、偵測跡象、防禦方式
- 風格：駭客終端機 × 卡牌遊戲

> 本站只做「認識與防禦」的教育內容，不提供任何可直接執行的攻擊指令或程式碼。

## 目前收錄

| 攻擊卡 | 防禦卡 |
|---|---|
| T1078 有效帳號濫用 | M1017 使用者訓練 |
| T1110 暴力破解 | M1032 多因素驗證 |
| T1486 勒索加密 | M1053 資料備份 |
| T1566 網路釣魚 | |



## 新增一張卡

這個專案是設計給 AI 協作者一起擴充的，規則都寫在 [`CLAUDE.md`](./CLAUDE.md)。最簡單的方式是對 AI 說：

> 請依照 CLAUDE.md 新增攻擊卡 T1059

手動新增的步驟：

1. 複製 `templates/attack.template.json`（或 `defense.template.json`）到 `data/attack/`（或 `data/defense/`），檔名為卡牌 ID
2. 依照 `CLAUDE.md` 第 6 節填寫內容
3. 在 `data/registry.json` 加入 ID
4. 同步雙向連結（攻擊卡的 `mitigations` ↔ 防禦卡的 `counters`）
5. 執行 `node scripts/validate.js` 檢查

## 專案結構

```
index.html        首頁（矩陣 + 牌庫）
card.html         卡牌詳解頁（card.html?id=T1566）
assets/           樣式與程式
data/             卡牌內容（JSON）
templates/        新卡範本
scripts/          資料檢查工具
CLAUDE.md         AI 協作規則
```

## 資料來源

MITRE ATT&CK® 為 The MITRE Corporation 的註冊商標。本站內容為個人學習整理，以自己的話重新講解，詳細資料請以 ATT&CK 官網為準。卡牌數值為本站自訂的學習用評估。
