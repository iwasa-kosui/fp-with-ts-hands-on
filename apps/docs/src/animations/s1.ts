import type { Animation } from "../components/animated-explanation/types";

const scene = `
<span class="ax-token" data-el="tok">入力</span>
<div class="ax-rail">
  <div class="ax-cell" data-el="s1">入力を検査する</div>
  <div class="ax-cell ax-fail" data-el="f1">キャンセル理由が空</div>
  <div class="ax-cell" data-el="s2">対象を取得する</div>
  <div class="ax-cell ax-fail" data-el="f2">実行者または予約が見つからない</div>
  <div class="ax-cell" data-el="s3">権限と状態を確認する</div>
  <div class="ax-cell ax-fail" data-el="f3">権限なし、または診察開始前ではない</div>
  <div class="ax-cell" data-el="s4">結果を作る</div>
  <div class="ax-cell ax-fail" data-el="f4">この工程から失敗へは切り替わらない</div>
  <div class="ax-cell" data-el="out-ok">Output<small>成功レールの終点</small></div>
  <div class="ax-cell ax-fail" data-el="out-bad">Output<small>失敗レールの終点</small></div>
</div>`;

const carry = (from: string, passed: string, next: string) => ({
  hi: next,
  place: { tok: next },
  mark: { [from]: "bad", [passed]: "pass" },
});

export const cancelRailway: Animation = {
  id: "s1-cancel-railway",
  title: "キャンセルの依頼が2本のレールを進む様子",
  lead: "場面を選んで再生します。失敗しても処理は途中で抜けません。失敗の値は下のレールを終点まで進みます。",
  note: "工程名と失敗の理由は、この節の表と同じです。",
  scene,
  scenarios: [
    {
      id: "success",
      label: "成功",
      steps: [
        {
          text: "キャンセルの依頼に理由が入っています。入力の検査は成功し、値は上のレールを進みます。",
          hi: "s1",
          place: { tok: "s1" },
        },
        { text: "実行者と予約が見つかります。取得した値を次の工程へ渡します。", hi: "s2", place: { tok: "s2" }, mark: { s1: "ok" } },
        {
          text: "担当者に権限があり、予約は診察開始前の <code>Scheduled</code> です。確認は成功します。",
          hi: "s3",
          place: { tok: "s3" },
          mark: { s2: "ok" },
        },
        {
          text: "<code>kind</code> が <code>Canceled</code> の予約とイベント <code>AppointmentCanceled</code> を作ります。",
          hi: "s4",
          place: { tok: "s4" },
          mark: { s3: "ok" },
          set: { tok: "AppointmentCanceled" },
        },
        {
          text: "値は上のレールの終点に届きます。呼び出し側は Output で結果を受け取ります。",
          hi: "out-ok",
          place: { tok: "out-ok" },
          mark: { s4: "ok", "out-ok": "ok", tok: "ok" },
        },
      ],
    },
    {
      id: "empty-reason",
      label: "理由が空",
      steps: [
        { text: "キャンセルの依頼に理由が入っていません。入力の検査は失敗します。", hi: "s1", place: { tok: "s1" } },
        {
          text: "値は下の失敗レールへ切り替わります。失敗の理由も値として一緒に運びます。",
          hi: "f1",
          place: { tok: "f1" },
          mark: { s1: "bad", f1: "bad", tok: "bad" },
          set: { tok: "失敗: 理由が空" },
        },
        {
          text: "失敗の値は下のレールを進みます。上の「対象を取得する」は実行しません。",
          ...carry("f1", "s2", "f2"),
        },
        { text: "失敗の値はそのまま次へ進みます。上の「権限と状態を確認する」も実行しません。", ...carry("f2", "s3", "f3") },
        { text: "上の「結果を作る」も実行しません。失敗の値は変わらずに進みます。", ...carry("f3", "s4", "f4") },
        {
          text: "失敗の値は下のレールの終点に届きます。呼び出し側は Output で失敗の理由を受け取ります。",
          hi: "out-bad",
          place: { tok: "out-bad" },
          mark: { f4: "bad", "out-bad": "bad" },
        },
      ],
    },
    {
      id: "paid",
      label: "Paid の予約",
      steps: [
        { text: "理由が入ったキャンセルの依頼が届きます。入力の検査は成功します。", hi: "s1", place: { tok: "s1" } },
        { text: "実行者と予約が見つかります。この予約の <code>kind</code> は <code>Paid</code> です。", hi: "s2", place: { tok: "s2" }, mark: { s1: "ok" }, set: { tok: "Paid" } },
        {
          text: "「権限と状態を確認する」は失敗します。<code>Paid</code> は診察開始前ではないからです。値は下のレールへ切り替わります。",
          hi: "s3 f3",
          place: { tok: "f3" },
          mark: { s2: "ok", s3: "bad", f3: "bad", tok: "bad" },
          set: { tok: "失敗: 診察開始前ではない" },
        },
        { text: "失敗の値は下のレールを進みます。上の「結果を作る」は実行しないので、<code>Canceled</code> は作られません。", ...carry("f3", "s4", "f4") },
        {
          text: "失敗の値は下のレールの終点に届きます。成功の結果が無いので、記録も残りません。",
          hi: "out-bad",
          place: { tok: "out-bad" },
          mark: { f4: "bad", "out-bad": "bad" },
        },
      ],
    },
  ],
};
