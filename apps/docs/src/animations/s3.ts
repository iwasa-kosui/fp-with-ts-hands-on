import type { Animation } from "../components/animated-explanation/types";

const scene = `
<div class="ax-split">
  <pre class="ax-code"><span class="ax-line" data-el="l-switch">switch (appointment.kind) {</span><span class="ax-line" data-el="l-Scheduled">  case "Scheduled": ...</span><span class="ax-line" data-el="l-CheckedIn">  case "CheckedIn": ...</span><span class="ax-line" data-el="l-InExamination">  case "InExamination": ...</span><span class="ax-line" data-el="l-AwaitingPayment">  case "AwaitingPayment": ...</span><span class="ax-line" data-el="l-Paid">  case "Paid": ...</span><span class="ax-line" data-el="l-Canceled">  case "Canceled": ...</span><span class="ax-line" data-el="l-default">  default:</span><span class="ax-line" data-el="l-body">    return assertNever(appointment);</span><span class="ax-line">}</span></pre>
  <div class="ax-stack">
    <div class="ax-cell">
      <p class="ax-label">ここまでに残っている候補</p>
      <div class="ax-chips">
        <span class="ax-chip" data-el="c-Scheduled" data-reveal>Scheduled</span>
        <span class="ax-chip" data-el="c-CheckedIn" data-reveal>CheckedIn</span>
        <span class="ax-chip" data-el="c-InExamination" data-reveal>InExamination</span>
        <span class="ax-chip" data-el="c-AwaitingPayment" data-reveal>AwaitingPayment</span>
        <span class="ax-chip" data-el="c-Paid" data-reveal>Paid</span>
        <span class="ax-chip" data-el="c-Canceled" data-reveal>Canceled</span>
        <span class="ax-chip" data-el="c-NoShow" data-reveal>NoShow</span>
        <span class="ax-chip" data-el="c-never" data-reveal>never</span>
      </div>
    </div>
    <div class="ax-verdict" data-el="verdict">型検査の結果: まだ確かめていません</div>
  </div>
</div>`;

const six = "c-Scheduled c-CheckedIn c-InExamination c-AwaitingPayment c-Paid c-Canceled";
const middle = "c-CheckedIn c-InExamination c-AwaitingPayment c-Paid";

export const exhaustiveNever: Animation = {
  id: "s3-exhaustive-never",
  title: "case を通るたびに、型の候補が減っていく様子",
  lead: "<code>case</code> を1つ通るたびに、残りの候補が型から減ります。<code>default</code> に何が残るかを確かめます。",
  note: "全 case を並べ、処理の中身を「...」で省略した説明用のコードです。",
  scene,
  scenarios: [
    {
      id: "all",
      label: "全 case を書いた",
      steps: [
        { text: "<code>appointment.kind</code> の候補は6つです。", show: six, hi: "l-switch" },
        { text: "<code>case \"Scheduled\"</code> を通り過ぎると、残りの候補から <code>Scheduled</code> が消えます。", hide: "c-Scheduled", hi: "l-Scheduled" },
        { text: "<code>CheckedIn</code>、<code>InExamination</code>、<code>AwaitingPayment</code>、<code>Paid</code> の <code>case</code> も同じように候補を減らします。", hide: middle, hi: "l-CheckedIn l-InExamination l-AwaitingPayment l-Paid" },
        { text: "<code>case \"Canceled\"</code> を通ると、値の候補は1つも残りません。空の型が <code>never</code> です。", hide: "c-Canceled", show: "c-never", hi: "l-Canceled c-never" },
        {
          text: "<code>default</code> の <code>appointment</code> は <code>never</code> です。<code>assertNever</code> の引数は <code>never</code> なので、コンパイルは通ります。",
          hi: "l-default l-body verdict",
          mark: { verdict: "ok" },
          set: { verdict: "型検査の結果: 成功" },
        },
      ],
    },
    {
      id: "forgot",
      label: "NoShow の case を忘れた",
      steps: [
        { text: "後から <code>Appointment</code> に <code>NoShow</code> を足します。候補は7つになります。<code>case</code> は足し忘れています。", show: `${six} c-NoShow`, hi: "l-switch c-NoShow" },
        {
          text: "既存の6つの <code>case</code> を通ると、6つの候補は消えます。<code>NoShow</code> だけが残ります。",
          hide: six,
          hi: "l-Scheduled l-CheckedIn l-InExamination l-AwaitingPayment l-Paid l-Canceled c-NoShow",
        },
        {
          text: "<code>default</code> の <code>appointment</code> は <code>NoShow</code> と推論されます。<code>never</code> の引数へ渡せないので、コンパイルエラーになります。",
          hi: "l-default verdict",
          mark: { "l-body": "bad", verdict: "ok", "c-NoShow": "bad" },
          set: { verdict: "型検査の結果: エラー。型 'never' のパラメーターに割り当てることはできません" },
        },
        { text: "コンパイラが直し忘れた分岐を教えてくれます。<code>case \"NoShow\"</code> を足すと、候補は空になり、エラーは消えます。", hi: "verdict", show: "c-never", hide: "c-NoShow", set: { verdict: "型検査の結果: case を足すと成功" } },
      ],
    },
    {
      id: "fallback",
      label: "default で「不明」を返す",
      steps: [
        {
          text: "修正前は <code>kind</code> を <code>string</code> として受け取り、<code>default</code> で「不明」を返します。",
          show: "c-NoShow",
          hi: "l-default l-body",
          set: { "l-body": '    return "不明";' },
        },
        {
          text: "<code>NoShow</code> の <code>case</code> が無くても、<code>default</code> が受け止めます。型検査は成功します。",
          hi: "verdict",
          mark: { verdict: "bad" },
          set: { verdict: "型検査の結果: 成功（誤りに気づけない）" },
        },
        {
          text: "翌朝、受付画面の予約に「不明」と表示されます。型検査では、この誤りに気づけません。",
          hi: "verdict",
          mark: { "c-NoShow": "bad" },
          set: { verdict: "画面の表示: 不明" },
        },
      ],
    },
  ],
};
