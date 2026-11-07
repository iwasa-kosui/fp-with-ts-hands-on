import type { Animation } from "../components/animated-explanation/types";

const scene = `
<div class="ax-split">
  <div class="ax-stack">
    <pre class="ax-code" data-el="before" data-reveal="collapse"><span class="ax-line" data-el="b1">await deps.stateStore.save(event.aggregateState);</span><span class="ax-line" data-el="b2">await deps.eventLog.append(event);</span></pre>
    <pre class="ax-code" data-el="after" data-reveal="collapse"><span class="ax-line" data-el="a0">database.transaction((transaction) =&gt; {</span><span class="ax-line" data-el="a1">  const current = findInTransaction(...);</span><span class="ax-line" data-el="a2">  if (current?.kind !== "CheckedIn") return err(...);</span><span class="ax-line" data-el="a3">  saveState(transaction, ...);</span><span class="ax-line" data-el="a4">  appendAudit(transaction, committedEvent);</span><span class="ax-line" data-el="a5">  return ok(undefined);</span><span class="ax-line" data-el="a6">});</span></pre>
    <div class="ax-verdict" data-el="verdict">結果: まだ保存していません</div>
  </div>
  <div class="ax-stack">
    <div class="ax-cell" data-el="state">
      <p class="ax-label">予約の状態</p>
      <span class="ax-big" data-el="state-value">CheckedIn</span>
    </div>
    <div class="ax-cell" data-el="audit">
      <p class="ax-label">監査記録</p>
      <span class="ax-big" data-el="audit-value">記録なし</span>
    </div>
  </div>
</div>`;

const afterShow = "after";

export const atomicStore: Animation = {
  id: "s6-atomic-store",
  title: "状態と監査記録が、同時に残るか、どちらも残らないか",
  lead: "保存の途中で失敗したとき、2つのデータに何が残るかを見比べます。点線は、まだ確定していない書き込みを表します。",
  note: "コードは本文の実装例を基に、図に収めるため条件を <code>current?.kind</code> の1行に縮めたものです。",
  scene,
  scenarios: [
    {
      id: "dual",
      label: "修正前: 2回の保存",
      steps: [
        { text: "修正前のコードは、状態の保存と監査記録の追加を別々に呼びます。", show: "before", hi: "b1 b2" },
        { text: "先に <code>stateStore.save</code> が成功します。予約は診察中になります。", hi: "b1 state", mark: { "state-value": "ok" }, set: { "state-value": "InExamination" } },
        { text: "次の <code>eventLog.append</code> が失敗します。", hi: "b2 audit", mark: { b2: "bad", "audit-value": "bad" } },
        {
          text: "予約は診察中なのに、誰がいつ診察を開始したかの記録は残りません。順番を入れ替えても、逆の不整合が起きます。",
          hi: "verdict",
          mark: { verdict: "bad" },
          set: { verdict: "結果: 状態だけが残る" },
        },
      ],
    },
    {
      id: "commit",
      label: "1回の保存: 成功",
      steps: [
        { text: "修正後は <code>ExaminationStarted</code> を <code>store</code> へ1回渡します。SQLite の実装は1つの transaction を始めます。", show: afterShow, hi: "a0" },
        { text: "同じ transaction の中で現在の予約を読み直します。<code>CheckedIn</code> なので先へ進みます。", hi: "a1 a2 state" },
        { text: "<code>saveState</code> が状態を書きます。transaction が終わるまで確定しません。", hi: "a3 state", mark: { state: "pending" }, set: { "state-value": "InExamination" } },
        { text: "<code>appendAudit</code> が監査記録を書きます。これも同じ transaction の中です。", hi: "a4 audit", mark: { audit: "pending" }, set: { "audit-value": "ExaminationStarted" } },
        {
          text: "transaction が確定します。2つのデータは同時に残ります。",
          hi: "a5 a6 verdict",
          mark: { state: "ok", audit: "ok", verdict: "ok" },
          set: { verdict: "結果: 状態と監査記録の両方が残る" },
        },
      ],
    },
    {
      id: "rollback",
      label: "1回の保存: 例外",
      steps: [
        { text: "同じ transaction を始め、現在の予約が <code>CheckedIn</code> であることを確かめます。", show: afterShow, hi: "a0 a1 a2" },
        { text: "<code>saveState</code> が状態を書きます。まだ確定していません。", hi: "a3 state", mark: { state: "pending" }, set: { "state-value": "InExamination" } },
        { text: "<code>appendAudit</code> が例外を投げます。", hi: "a4 audit", mark: { a4: "bad", audit: "bad" } },
        {
          text: "transaction が取り消され、状態の書き込みも消えます。どちらも残りません。",
          hi: "state verdict",
          mark: { state: "", audit: "", verdict: "ok" },
          set: { "state-value": "CheckedIn", verdict: "結果: どちらも残らない" },
        },
        {
          text: "保存障害は <code>Err</code> へ変換しません。reject のまま外側の例外境界へ伝わり、詳細を含まない HTTP 500 になります。",
          hi: "verdict",
          set: { verdict: "結果: どちらも残らない／HTTP 500" },
        },
      ],
    },
    {
      id: "conflict",
      label: "1回の保存: 競合",
      steps: [
        { text: "別の操作が先に予約を変えていました。同じ transaction の中で読み直します。", show: afterShow, hi: "a0 a1 state", set: { "state-value": "InExamination" } },
        { text: "現在の予約は <code>CheckedIn</code> ではありません。ここで <code>AppointmentConflict</code> を返します。", hi: "a2", mark: { a2: "bad", a3: "skip", a4: "skip", a5: "skip" } },
        {
          text: "何も書き込みません。競合は業務エラーなので <code>Err</code> で返り、呼び出し側は最新の予約を確認して操作をやり直せます。",
          hi: "verdict audit",
          mark: { verdict: "ok" },
          set: { verdict: "結果: Err(AppointmentConflict)／書き込みなし" },
        },
      ],
    },
  ],
};
