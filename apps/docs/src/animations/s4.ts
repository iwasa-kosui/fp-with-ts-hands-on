import type { Animation } from "../components/animated-explanation/types";

const scene = `
<span class="ax-token" data-el="tok">night-shift</span>
<div class="ax-rail">
  <div class="ax-cell" data-el="raw">HTTP の入力<small><code>unknown</code></small></div>
  <div class="ax-cell ax-empty" data-el="f-raw">-</div>
  <div class="ax-cell" data-el="schema">schema で UUID を検査<small><code>VeterinarianId.schema</code></small></div>
  <div class="ax-cell ax-fail" data-el="f-schema" data-reveal>入力を作らない<small><code>Err()</code></small></div>
  <div class="ax-cell" data-el="brand">型が付く<small><code>VeterinarianId</code></small></div>
  <div class="ax-cell ax-empty" data-el="f-brand">-</div>
  <div class="ax-cell" data-el="input"><code>StartExaminationInput</code></div>
  <div class="ax-cell ax-empty" data-el="f-input">-</div>
</div>
<pre class="ax-code"><span class="ax-line" data-el="c1">POST /appointments/11111111-1111-4111-8111-111111111111/start-examination</span><span class="ax-line" data-el="c2">{ "veterinarianId": "night-shift" }</span><span class="ax-line" data-el="c3">parse: (raw: any) =&gt; ok({ appointmentId: raw.appointmentId, veterinarianId: raw.veterinarianId })</span></pre>
<div class="ax-verdict" data-el="verdict">結果: まだ parse していません</div>`;

const fixedParse = "parse: schemaResult(schema)  // raw: unknown";

export const parseBoundary: Animation = {
  id: "s4-parse-boundary",
  title: "HTTP の入力が境界の parse を通る様子",
  lead: "同じ <code>night-shift</code> が、現在の parse と修正後の parse でどこまで進むかを見比べます。",
  note: "「UUID が届く」の場面で流れる値は説明用のラベルで、実在の ID ではありません。",
  scene,
  scenarios: [
    {
      id: "current",
      label: "現在の parse",
      steps: [
        { text: "夜勤の獣医師を選ぶと、勤務区分の <code>night-shift</code> が <code>veterinarianId</code> に入って届きます。", hi: "raw c1 c2", place: { tok: "raw" } },
        { text: "現在の parse は値を検査しません。<code>raw</code> の値をそのまま <code>ok</code> で包みます。", hi: "c3", mark: { schema: "skip", brand: "skip" }, place: { tok: "input" } },
        {
          text: "不正な値から <code>StartExaminationInput</code> ができます。誤りはユースケースの中へ入り込みます。",
          hi: "input verdict",
          mark: { input: "bad", tok: "bad", verdict: "bad" },
          set: { verdict: 'Ok({ appointmentId: "11111111-…", veterinarianId: "night-shift" })' },
        },
      ],
    },
    {
      id: "fixed",
      label: "修正後の parse",
      steps: [
        { text: "同じ入力が届きます。修正後の parse は <code>raw</code> を <code>unknown</code> として受け取ります。", hi: "raw c2 c3", place: { tok: "raw" }, set: { c3: fixedParse } },
        { text: "schema が UUID かどうかを検査します。<code>night-shift</code> は UUID ではありません。", hi: "schema", place: { tok: "schema" }, mark: { schema: "bad" } },
        {
          text: "parse は <code>Err()</code> を返します。<code>StartExaminationInput</code> は作られません。",
          show: "f-schema",
          hi: "f-schema verdict",
          place: { tok: "f-schema" },
          mark: { "f-schema": "bad", tok: "bad", brand: "skip", input: "skip", verdict: "ok" },
          set: { verdict: "Err()  ユースケースは呼ばれません" },
        },
      ],
    },
    {
      id: "uuid",
      label: "UUID が届く",
      steps: [
        { text: "獣医師の UUID が届きます。修正後の parse が検査します。", hi: "raw", place: { tok: "raw" }, set: { tok: "獣医師の UUID", c2: '{ "veterinarianId": "（獣医師の UUID）" }', c3: fixedParse } },
        { text: "schema の検査は成功します。", hi: "schema", place: { tok: "schema" }, mark: { schema: "ok" } },
        {
          text: "成功結果は <code>VeterinarianId</code> として推論されます。実行時の文字列に印は付きません。違いはコンパイル時の型だけにあります。",
          hi: "brand",
          place: { tok: "brand" },
          mark: { brand: "ok" },
        },
        {
          text: "検査を通った値だけで <code>StartExaminationInput</code> を作ります。",
          hi: "input verdict",
          place: { tok: "input" },
          mark: { input: "ok", tok: "ok", verdict: "ok" },
          set: { verdict: "Ok(StartExaminationInput)" },
        },
      ],
    },
  ],
};
