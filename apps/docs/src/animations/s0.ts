import type { Animation } from "../components/animated-explanation/types";

export const doubleBilling: Animation = {
  id: "s0-double-billing",
  title: "会計済みの予約が診察中へ戻り、二重請求になるまで",
  lead: "現在の予約内容と変更履歴がどう食い違うかを、1操作ずつ確かめます。",
  scene: `
<span class="ax-token" data-el="tok">同じ予約 ID</span>
<div class="ax-split">
  <div class="ax-stack">
    <div class="ax-cell" data-el="current">
      <p class="ax-label">現在の予約内容</p>
      <span class="ax-big" data-el="status">診察を終えた予約</span>
    </div>
    <div class="ax-cell" data-el="bills">
      <p class="ax-label">Mugi の飼い主への請求</p>
      <span class="ax-chip" data-el="bill1" data-reveal>1回目 4,800円</span>
      <span class="ax-chip" data-el="bill2" data-reveal>2回目 4,800円</span>
    </div>
  </div>
  <div class="ax-stack">
    <div class="ax-cell" data-el="history">
      <p class="ax-label">変更履歴</p>
      <div class="ax-stack" style="gap:.375rem">
        <span class="ax-chip" data-el="log1" data-reveal>「会計済み」にした操作</span>
        <span class="ax-chip" data-el="log2" data-reveal>「診察開始」の操作</span>
      </div>
    </div>
    <div class="ax-verdict" data-el="actor">操作した人: なし</div>
  </div>
</div>`,
  scenarios: [
    {
      id: "main",
      label: "二重請求",
      steps: [
        {
          text: "会計担当は Mugi の飼い主から4,800円を受け取り、予約を会計済みにします。変更履歴には会計済みにした操作が残ります。",
          show: "bill1 log1",
          hi: "current",
          set: { status: "会計済み", actor: "操作した人: 会計担当" },
        },
        {
          text: "獣医師が同じ予約で「診察開始」を押します。システムは操作を止めません。",
          hi: "actor",
          set: { actor: "操作した人: 獣医師" },
        },
        {
          text: "システムは現在の予約内容を診察中へ戻します。変更履歴の会計済みの操作は消えません。",
          show: "log2",
          hi: "current log2",
          mark: { status: "bad" },
          set: { status: "診察中" },
        },
        {
          text: "受付は画面の「診察中」を見て、会計前の来院だと判断します。受付は飼い主へ同じ金額をもう一度請求します。",
          show: "bill2",
          hi: "bills",
          mark: { bill2: "bad" },
          set: { actor: "操作した人: 受付" },
        },
        {
          text: "SQLite には、会計済みにした変更履歴と、診察中の現在の予約内容が、同じ予約 ID に残ります。2つを見比べると食い違いが見つかります。",
          hi: "current history",
          place: { tok: "history" },
          set: { actor: "現在の予約内容と変更履歴が食い違っています" },
          mark: { actor: "bad" },
        },
      ],
    },
  ],
};
