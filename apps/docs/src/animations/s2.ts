import type { Animation } from "../components/animated-explanation/types";

const stateRow = `
<span class="ax-token" data-el="tok">予約</span>
<div class="ax-flow">
  <span class="ax-cell" data-el="Scheduled"><code>Scheduled</code></span>
  <span class="ax-fn" data-el="fn-checkIn">checkIn →</span>
  <span class="ax-cell" data-el="CheckedIn"><code>CheckedIn</code></span>
  <span class="ax-fn" data-el="fn-start">startExamination →</span>
  <span class="ax-cell" data-el="InExamination"><code>InExamination</code></span>
  <span class="ax-fn" data-el="fn-complete">completeExamination →</span>
  <span class="ax-cell" data-el="AwaitingPayment"><code>AwaitingPayment</code></span>
  <span class="ax-fn" data-el="fn-pay">recordPayment →</span>
  <span class="ax-cell" data-el="Paid"><code>Paid</code></span>
</div>
<div class="ax-flow">
  <span class="ax-fn" data-el="fn-cancel">cancel（Scheduled か CheckedIn だけ）→</span>
  <span class="ax-cell" data-el="Canceled"><code>Canceled</code></span>
</div>
<pre class="ax-code"><span class="ax-line" data-el="sig">// 関数を選ぶと引数の型を表示します</span><span class="ax-line" data-el="call"> </span></pre>
<div class="ax-verdict" data-el="verdict">判定: まだ呼び出していません</div>`;

export const stateTransitions: Animation = {
  id: "s2-state-transitions",
  title: "引数の型が、許可された遷移だけを通す様子",
  lead: "同じ呼び出しが、引数の型によってコンパイルを通るかどうかを見比べます。",
  note: "「引数が Appointment」の場面は修正前の説明用コード、「引数が CheckedIn」の場面は修正後の説明用コードに対応します。",
  scene: stateRow,
  scenarios: [
    {
      id: "allowed",
      label: "正しい順序",
      steps: [
        { text: "予約は <code>Scheduled</code> から始まります。", hi: "Scheduled", place: { tok: "Scheduled" } },
        {
          text: "<code>checkIn</code> は <code>Scheduled</code> を受け取り、<code>CheckedIn</code> を返します。",
          hi: "fn-checkIn CheckedIn",
          place: { tok: "CheckedIn" },
          mark: { Scheduled: "ok" },
        },
        {
          text: "<code>startExamination</code> は <code>CheckedIn</code> だけを受け取り、<code>InExamination</code> を返します。",
          hi: "fn-start InExamination",
          place: { tok: "InExamination" },
          mark: { CheckedIn: "ok" },
          set: { sig: "startExamination(appointment: CheckedIn, ...): InExamination" },
        },
        {
          text: "<code>completeExamination</code> は <code>InExamination</code> を受け取り、<code>AwaitingPayment</code> を返します。",
          hi: "fn-complete AwaitingPayment",
          place: { tok: "AwaitingPayment" },
          mark: { InExamination: "ok" },
          set: { sig: "completeExamination(appointment: InExamination, ...): AwaitingPayment" },
        },
        {
          text: "<code>recordPayment</code> は <code>AwaitingPayment</code> を受け取り、<code>Paid</code> を返します。診察結果を記録するまで会計できません。",
          hi: "fn-pay Paid",
          place: { tok: "Paid" },
          mark: { AwaitingPayment: "ok", Paid: "ok" },
          set: { sig: "recordPayment(appointment: AwaitingPayment, ...): Paid" },
        },
      ],
    },
    {
      id: "wide",
      label: "引数が Appointment",
      steps: [
        {
          text: "会計済みの予約 <code>paidAppointment</code> があります。この値の型は <code>Paid</code> です。",
          hi: "Paid",
          place: { tok: "Paid" },
          set: { sig: "startExamination(appointment: Appointment, ...): Appointment", call: 'startExamination(paidAppointment, "vet-001", ...)' },
        },
        {
          text: "引数の型は <code>Appointment</code> 全体です。<code>Paid</code> も <code>Appointment</code> の一員なので、コンパイルは通ります。",
          hi: "fn-start sig call",
          set: { verdict: "コンパイル: 通る" },
          mark: { verdict: "bad" },
        },
        {
          text: "実行すると、<code>requireKind</code> が例外を投げます。動かすまで誤りに気づけません。",
          hi: "verdict",
          mark: { Paid: "bad", tok: "bad" },
          set: { verdict: "コンパイル: 通る／実行: requireKind が例外を投げる" },
        },
      ],
    },
    {
      id: "narrow",
      label: "引数が CheckedIn",
      steps: [
        {
          text: "同じ <code>paidAppointment</code> を渡します。今度の引数の型は <code>CheckedIn</code> です。",
          hi: "Paid",
          place: { tok: "Paid" },
          set: { sig: "startExamination(appointment: CheckedIn, ...): InExamination", call: 'startExamination(paidAppointment, "vet-001", ...)' },
        },
        {
          text: "<code>Paid</code> は <code>CheckedIn</code> ではありません。呼び出しの時点でコンパイルエラーになり、実行まで進みません。",
          hi: "sig call verdict",
          mark: { verdict: "ok", Paid: "bad", tok: "bad" },
          set: { verdict: "コンパイル: エラー／実行: 始まらない" },
        },
        {
          text: "<code>CheckedIn</code> の値を渡すと通ります。Discriminated Union が状態の候補を定義し、関数の引数型が許可された遷移を定義します。",
          hi: "CheckedIn fn-start InExamination",
          place: { tok: "InExamination" },
          mark: { CheckedIn: "ok", tok: "ok", Paid: "skip" },
          set: { call: 'startExamination(checkedInAppointment, "vet-001", ...)  // 変数名は説明用', verdict: "コンパイル: 通る" },
        },
      ],
    },
  ],
};
