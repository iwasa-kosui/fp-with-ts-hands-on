import type { Animation } from "../components/animated-explanation/types";

const scene = `
<span class="ax-token" data-el="tok">Ok(Appointment)</span>
<div class="ax-rail">
  <div class="ax-cell" data-el="s1"><code>ensureAppointmentFound</code></div>
  <div class="ax-cell ax-fail" data-el="f1"><code>AppointmentNotFound</code></div>
  <div class="ax-cell" data-el="s2"><code>.andThen(ensureCheckedIn)</code></div>
  <div class="ax-cell ax-fail" data-el="f2"><code>InvalidAppointmentState</code></div>
  <div class="ax-cell" data-el="s3"><code>.map(...)</code><small>transitionToInExamination</small></div>
  <div class="ax-cell ax-fail" data-el="f3"><small>切り替え線なし。Err を運ぶ</small></div>
  <div class="ax-cell" data-el="s4"><code>.map(...)</code><small>deps.store.save</small></div>
  <div class="ax-cell ax-fail" data-el="f4"><small>切り替え線なし。Err を運ぶ</small></div>
  <div class="ax-cell" data-el="ok-out"><code>context.redirect("/", 303)</code></div>
  <div class="ax-cell ax-fail" data-el="err-out"><code data-el="notice">/?notice=</code></div>
</div>
<pre class="ax-code"><span class="ax-line" data-el="c1">ensureAppointmentFound(</span><span class="ax-line" data-el="c1b">  deps.resolver.resolveById(input.appointmentId),</span><span class="ax-line" data-el="c1c">  input.appointmentId,</span><span class="ax-line" data-el="c1d">)</span><span class="ax-line" data-el="c2">  .andThen(ensureCheckedIn)</span><span class="ax-line" data-el="c3">  .map((appointment) =&gt; transitionToInExamination(...))</span><span class="ax-line" data-el="c4">  .map((appointment) =&gt; { deps.store.save(appointment); return appointment; });</span></pre>
<div class="ax-verdict" data-el="verdict">Result の中身: まだ始まっていません</div>`;

const allFirst = "c1 c1b c1c c1d";

export const andThenMap: Animation = {
  id: "s5-and-then-map",
  title: "andThen と map が Result を運ぶ様子",
  lead: "コードの行と図の工程を同時に追います。<code>Err</code> になった後も、値はチェーンの最後まで運ばれます。どのコールバックが呼ばれないかを確かめます。",
  note: "コードは本文の書き直し例を基に、図に収めるため <code>.map</code> の引数を1行に縮めたものです。",
  scene,
  scenarios: [
    {
      id: "ok",
      label: "受付済みの予約",
      steps: [
        { text: "予約が見つかります。<code>ensureAppointmentFound</code> は <code>Ok</code> を返します。", hi: `${allFirst} s1`, place: { tok: "s1" }, set: { verdict: "Result の中身: Ok(Appointment)" } },
        { text: "<code>andThen</code> は <code>Result</code> を返す関数へ値を渡します。<code>ensureCheckedIn</code> は <code>Ok</code> を返します。これが切り替え線のある工程です。", hi: "c2 s2", place: { tok: "s2" }, mark: { s1: "ok" }, set: { tok: "Ok(CheckedIn)", verdict: "Result の中身: Ok(CheckedIn)" } },
        { text: "<code>map</code> は素の値を返す関数へ値を渡し、戻り値を <code>Ok</code> で包みます。これが切り替え線のない工程です。", hi: "c3 s3", place: { tok: "s3" }, mark: { s2: "ok" }, set: { tok: "Ok(InExamination)", verdict: "Result の中身: Ok(InExamination)" } },
        { text: "次の <code>map</code> で予約を保存します。保存した値をそのまま返します。", hi: "c4 s4", place: { tok: "s4" }, mark: { s3: "ok" } },
        { text: "Web 側の <code>match</code> は成功の関数を呼び、<code>context.redirect(\"/\", 303)</code> を返します。", hi: "ok-out", place: { tok: "ok-out" }, mark: { s4: "ok", "ok-out": "ok", tok: "ok" } },
      ],
    },
    {
      id: "not-found",
      label: "予約が見つからない",
      steps: [
        {
          text: "<code>resolveById</code> は <code>undefined</code> を返します。<code>ensureAppointmentFound</code> は <code>err</code> を返します。",
          hi: `${allFirst} s1 f1`,
          place: { tok: "f1" },
          mark: { s1: "bad", f1: "bad", tok: "bad" },
          set: { tok: "Err(AppointmentNotFound)", verdict: 'Result の中身: Err({ kind: "AppointmentNotFound", appointmentId })' },
        },
        {
          text: "<code>.andThen</code> は呼ばれますが、<code>Err</code> なのでコールバックの <code>ensureCheckedIn</code> を呼びません。同じ <code>Err</code> を次へ返します。",
          hi: "c2 f2",
          place: { tok: "f2" },
          mark: { s2: "pass", c2: "pass" },
        },
        {
          text: "<code>.map</code> も同じです。遷移のコールバックを呼ばず、同じ <code>Err</code> を次へ返します。",
          hi: "c3 f3",
          place: { tok: "f3" },
          mark: { s3: "pass", c3: "pass" },
        },
        {
          text: "最後の <code>.map</code> も保存のコールバックを呼びません。チェーンの結果は最初の <code>Err</code> のままです。",
          hi: "c4 f4",
          place: { tok: "f4" },
          mark: { s4: "pass", c4: "pass" },
        },
        {
          text: "Web 側の <code>match</code> は失敗の関数を呼びます。<code>toNoticeCode</code> は <code>not-found</code> を返します。",
          hi: "err-out",
          place: { tok: "err-out" },
          mark: { "err-out": "bad" },
          set: { notice: "/?notice=not-found" },
        },
      ],
    },
    {
      id: "invalid",
      label: "受付前の予約",
      steps: [
        { text: "予約は見つかります。<code>ensureAppointmentFound</code> は <code>Ok</code> を返します。", hi: `${allFirst} s1`, place: { tok: "s1" }, set: { verdict: "Result の中身: Ok(Appointment)" } },
        {
          text: "<code>kind</code> が <code>CheckedIn</code> ではないので、<code>ensureCheckedIn</code> は <code>err</code> を返します。値は失敗レールへ切り替わります。",
          hi: "c2 s2 f2",
          place: { tok: "f2" },
          mark: { s1: "ok", s2: "bad", f2: "bad", tok: "bad" },
          set: { tok: "Err(InvalidAppointmentState)", verdict: 'Result の中身: Err({ kind: "InvalidAppointmentState", actual })' },
        },
        {
          text: "<code>.map</code> は呼ばれますが、<code>Err</code> なので遷移のコールバックを呼びません。同じ <code>Err</code> を次へ返します。",
          hi: "c3 f3",
          place: { tok: "f3" },
          mark: { s3: "pass", c3: "pass" },
        },
        {
          text: "最後の <code>.map</code> も保存のコールバックを呼びません。予約は保存されません。",
          hi: "c4 f4",
          place: { tok: "f4" },
          mark: { s4: "pass", c4: "pass" },
        },
        {
          text: "<code>toNoticeCode</code> は <code>invalid-state</code> を返します。受付前の予約で500になることはありません。",
          hi: "err-out",
          place: { tok: "err-out" },
          mark: { "err-out": "bad" },
          set: { notice: "/?notice=invalid-state" },
        },
      ],
    },
  ],
};
