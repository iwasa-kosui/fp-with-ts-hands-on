import type { Animation } from "../components/animated-explanation/types";

const scene = `
<span class="ax-token" data-el="tok">診察開始</span>
<div class="ax-rail">
  <div class="ax-cell" data-el="b1">入力境界<small><code>appointmentRoutes.ts</code></small></div>
  <div class="ax-cell ax-empty" data-el="x1">-</div>
  <div class="ax-cell" data-el="b2">業務上の失敗<small><code>startExaminationUseCase.ts</code></small></div>
  <div class="ax-cell ax-fail" data-el="x2">型付きの <code>Err</code><small>予約なし・状態不正・予約競合</small></div>
  <div class="ax-cell" data-el="b3">出力イベント<small><code>appointment.ts</code></small></div>
  <div class="ax-cell ax-fail" data-el="x3"><small>Err を運ぶ</small></div>
  <div class="ax-cell" data-el="b4">副作用<small><code>appointmentEventStore.ts</code></small></div>
  <div class="ax-cell ax-fail" data-el="x4"><small>Err を運ぶ</small></div>
  <div class="ax-cell" data-el="done">成功の応答</div>
  <div class="ax-cell ax-fail" data-el="x5">失敗の応答<small>呼び出し側が理由ごとに案内する</small></div>
</div>
<div class="ax-cell" data-el="b5">例外境界（レールの外）<small><code>app.ts</code>／詳細を含まない500応答</small></div>
<div class="ax-verdict" data-el="verdict">確かめる場所: 入力境界から順に追います</div>`;

export const fiveBoundaries: Animation = {
  id: "final-five-boundaries",
  title: "診察開始の依頼が5つの境界を通る様子",
  lead: "同じ入口から始まる3つの経路で、事故がそれぞれどの場所で止まるかを確かめます。",
  note: "ファイル名は本文の5項目と同じです。完全なパスは本文にあります。",
  scene,
  scenarios: [
    {
      id: "success",
      label: "成功",
      steps: [
        { text: "入力境界で HTTP 入力を検証し、ユースケース入力へ変換します。", hi: "b1", place: { tok: "b1" } },
        { text: "業務の検証に成功します。業務検証に成功した経路だけがイベント生成へ進みます。", hi: "b2", place: { tok: "b2" }, mark: { b1: "ok" } },
        { text: "<code>startExamination</code> が <code>ExaminationStarted</code> を作ります。", hi: "b3", place: { tok: "b3" }, mark: { b2: "ok" }, set: { tok: "ExaminationStarted" } },
        { text: "予約状態と監査用イベントを同じ保存境界へ渡します。", hi: "b4", place: { tok: "b4" }, mark: { b3: "ok" } },
        { text: "保存が成功し、応答を返します。この経路は例外境界を通りません。", hi: "done", place: { tok: "done" }, mark: { b4: "ok", done: "ok", tok: "ok" } },
      ],
    },
    {
      id: "business",
      label: "業務上の失敗",
      steps: [
        { text: "入力境界で検証が成功します。", hi: "b1", place: { tok: "b1" } },
        {
          text: "予約なし・状態不正・予約競合は、型付きの <code>Err</code> になります。値は失敗レールへ切り替わります。",
          hi: "b2 x2",
          place: { tok: "x2" },
          mark: { b1: "ok", b2: "bad", x2: "bad", tok: "bad" },
          set: { tok: "Err" },
        },
        { text: "<code>Err</code> はレールを進みます。上のイベント生成は実行しません。", hi: "x3", place: { tok: "x3" }, mark: { b3: "pass" } },
        { text: "上の保存も実行しません。<code>Err</code> は変わらずに進みます。", hi: "x4", place: { tok: "x4" }, mark: { b4: "pass" } },
        { text: "<code>Err</code> はレールの終点に届きます。呼び出し側は失敗の理由を受け取り、次の案内を選びます。", hi: "x5", place: { tok: "x5" }, mark: { x5: "bad" } },
      ],
    },
    {
      id: "system",
      label: "SQLite 障害",
      steps: [
        { text: "入力境界と業務の検証は成功し、<code>ExaminationStarted</code> ができます。", hi: "b3", place: { tok: "b3" }, mark: { b1: "ok", b2: "ok" }, set: { tok: "ExaminationStarted" } },
        { text: "保存の途中で SQLite 障害が起きます。", hi: "b4", place: { tok: "b4" }, mark: { b3: "ok", b4: "bad", tok: "bad" } },
        {
          text: "障害は業務 <code>Result</code> に入りません。値はどちらのレールにも乗らず、<code>app.ts</code> の共通境界で安全に記録され、詳細を含まない500応答になります。",
          hi: "b5",
          place: { tok: "b5" },
          mark: { b5: "bad" },
          set: { tok: "例外", verdict: "業務上の失敗はレールの上を進み、システムの障害はレールの外へ出ます" },
        },
      ],
    },
  ],
};
