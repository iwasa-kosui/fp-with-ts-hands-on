# Session 05 Result Error Boundary Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SESSION 05で、Resultに含める失敗と例外として中断する異常を、顧客や現場が選べる操作と後続処理の前提から判断できるようにします。

**Architecture:** ページが所有する説明を `05-workflow-errors.astro` 内で完結させます。説明の整合性はページ内の関連文面を同じ判断基準へ揃え、既存テストと静的ビルドで構造上の退行がないことを確認します。人向け文章の完全一致を固定するテストは追加しません。ドメインコード、演習コード、CSSは変更しません。

**Tech Stack:** Astro 4、TypeScript 5、Vitest 2、pnpm

**Spec:** 独立した設計書はありません。本計画の Global Constraints に、対話で合意した説明要件を記録します。

**References:** [Scott Wlaschinによるエラー分類](https://fsharpforfunandprofit.com/posts/against-railway-oriented-programming/)、[DMMF公式サンプルの失敗を継続する判断](https://github.com/swlaschin/DomainModelingMadeFunctional/blob/master/src/OrderTaking/PlaceOrder.Implementation.fs#L88-L112)

## Global Constraints

- 冒頭で `Result<T, E>` を成功を表す `Ok` と失敗を表す `Err` のどちらかを返す型として定義してから、Resultに含める失敗の判断基準を示します。
- `Result<T, E>` の `E` は発生しうるエラーの一覧ではなく、顧客や現場が失敗理由に応じて操作を選ぶ必要がある失敗だけを表します。
- エラーが業務処理とインフラのどちらで発生したかだけでは、Resultと例外を分類しません。
- 予約なしでは予約を探し直し、受付前では受付を先に行うという、失敗ごとに異なる操作を示します。
- 呼び出し側に理由別の対応がなく、要求された処理を完了できない異常はシステムエラーとし、Resultへ変換せず例外として外側へ伝えます。
- 副作用の具体例には「データベースへの保存が完了したか確認できないままキューへのイベント追加や外部サービスへの通知を送る」を使います。
- 失敗理由に応じて呼び出し側が次の対応を選べる失敗を業務エラー、呼び出し側に理由別の対応がなく要求を完了できない異常をシステムエラーと定義します。
- システムエラーは外側の例外境界でログへ記録し、必要なロールバックや接続の解放を行ってエラー応答へ変換すると明記します。
- DMMFの分類に合わせ、インフラ障害を一律に例外と断定しません。業務上の対応が定義されている場合はResultに含め得ます。
- 教材の実装変更は `apps/docs/src/pages/sessions/05-workflow-errors.astro` だけです。本計画ファイルは作業記録として同じコミットへ含めます。
- CSS、コンポーネント構成、演習スナップショット、`examples/session-*` は変更しません。

---

### Task 1: Resultと例外の判断基準をSESSION 05へ固定する

**Files:**

- Modify: `apps/docs/src/pages/sessions/05-workflow-errors.astro:49-80`
- Modify: `apps/docs/src/pages/sessions/05-workflow-errors.astro:160-393`
- Modify: `apps/docs/src/pages/sessions/05-workflow-errors.astro:523-535`

**Interfaces:**

- Produces: Resultの概念を説明したうえで、Resultで返す業務エラーと例外として外側へ伝えるシステムエラーを具体例で区別する教材文

- [ ] **Step 1: 冒頭でResultを定義してから業務上の操作による判断基準を示す**

`apps/docs/src/pages/sessions/05-workflow-errors.astro` の `result-or-exception` articleを、次の内容へ置き換えます。

```astro
<article class="teaching-topic" aria-labelledby="result-or-exception">
  <h3 id="result-or-exception">Result は成功と失敗を値で表す</h3>
  <p>
    <code>Result&lt;T, E&gt;</code> は、成功を表す <code>Ok</code> と失敗を表す <code>Err</code> のどちらかを返す型です。
    <code>T</code> は成功値、<code>E</code> は失敗理由を表します。失敗を例外として投げず <code>Err</code> で返すと、呼び出し側は戻り値の型から成功時の値と失敗理由の両方を確認できます。
  </p>
  <p>
    Result に含める失敗は、先に呼び出し側の対応から選びます。失敗理由に応じて呼び出し側が次の操作を選べる業務エラーを <code>E</code> として返します。
  </p>
  <p>
    たとえば、予約が見つからなければ予約を探し直し、まだ受付されていなければ受付を先に行います。呼び出し側が理由ごとに異なる対応を選ぶ必要があるため、これらは <code>Err</code> で返します。
  </p>
  <p>
    一方、呼び出し側に理由別の対応がなく、要求された処理を完了できない異常はシステムエラーとして扱います。このような異常はResultに変換せず、例外として外側へ伝えます。
  </p>
  <p>
    たとえば、データベースへの保存中に接続が切れ、保存が完了したか確認できない場合です。データベースへの保存が完了したか確認できないままキューへのイベント追加や外部サービスへの通知を行うと、データベースには保存されていないのに、イベントや通知だけが送られる可能性があります。そのため、イベント追加や通知は実行せず、保存時の例外をそのまま外側へ伝えます。
  </p>
  <p>
    外側の例外境界では、例外をログへ記録し、必要なロールバックや接続の解放を行ったうえで、500などのエラー応答へ変換します。
  </p>
</article>
```

- [ ] **Step 2: ページ内の関連説明を同じ判断基準へ揃える**

`session.delegationPrompt.decisions` の1件目と4件目を、予期できるかどうかではなく、業務上の操作と後続処理の前提を問う文へ変更します。

```ts
decisions: [
  "どの失敗に対して顧客や現場が別の操作を選ぶか",
  "呼び出し側が分岐に使う安定した情報は何か",
  "失敗後に実行してはいけない処理は何か",
  "要求された処理を完了できず、Resultへ変換せず外側へ伝えるシステムエラーは何か",
],
```

`session.decisions` の最初の不変条件を、予期できるかどうかではなく、理由別の操作が必要かどうかへ変更します。

```ts
{
  invariant: "顧客や現場が失敗理由に応じて操作を選ぶ必要がある失敗は、戻り値に現れる。",
},
```

最初のteaching topicの `why` は、Resultへ含めると呼び出し側に分岐を要求する点まで説明します。

```ts
why: "例外では、関数の型から失敗理由を読み取れません。Result の E に業務エラーを置くと、呼び出し側は実行前から起こりうる失敗を把握し、表示や次の操作を選べます。err は例外を投げず、失敗理由を値として返します。ただし、Result の E は発生しうるエラーの一覧ではありません。顧客や現場が失敗理由に応じて操作を選ぶ必要のない異常まで含めると、呼び出し側へ意味のない分岐を要求します。",
```

`andThen` topicの `why` の末尾は、保存障害を例外として伝播させる理由へ揃えます。

```ts
why: "before は実行時には例外で処理が止まりますが、どの行が何をthrowするかは型に現れません。after は成功時に InExamination のどの情報が得られるかと、予約なし・状態不正のどちらで失敗するかを定義から確認できます。Err になった時点で後続の andThen と map は呼ばれません。resolver と store は外部境界として deps から受け取りますが、状態遷移はドメイン知識なので直接呼びます。store.save が投げる保存障害は、呼び出し側が理由別の対応を選ぶ業務エラーではなく、要求された保存処理を完了できないシステムエラーとして例外を伝播させます。",
```

`match` topicの `why` の末尾は、「技術的な例外」という原因分類を削除します。

```ts
why: "before では InvalidAppointmentState が追加されても catch に型エラーが出ないため、受付前の予約だけ500になりました。after は match の失敗側で union 全体を受け取り、default 節から never 専用の assertNever を呼びます。エラーの種類を追加して case を足し忘れると新しい型が default 節に残り、コンパイルエラーになります。Result に含めていないシステムエラーは、この switch では捕捉せず外側の例外境界へ伝えます。",
```

`narrative.limitation` も同じ語彙へ揃えます。

```ts
limitation: "どの失敗を業務エラーとして画面のnoticeへ変換するかは、人の判断とレビューが必要になる。呼び出し側に理由別の対応がなく、要求された処理を完了できないシステムエラーはResultへ変換せず、外側の例外境界へ伝える。",
```

- [ ] **Step 3: 既存のSESSIONページテストが通ることを確認する**

Run:

```bash
pnpm --filter @fp-with-ts/docs test -- src/session-pages.test.ts
```

Expected: PASS。`session-pages.test.ts` の全テストが成功します。

- [ ] **Step 4: ページ全体のテストと静的ビルドを実行する**

Run:

```bash
pnpm --filter @fp-with-ts/docs test
pnpm --filter @fp-with-ts/docs build
```

Expected: Vitestの全テストとAstro check、静的ビルド、内部リンク検査がすべて成功します。

- [ ] **Step 5: 必須文面、文体、変更範囲、旧説明の残存を確認する**

Run:

```bash
grep -nE "(上界|表化|織り込|達成目標|設計の天井|に倒れる|として乗る|硬化|の鍵|羅針盤|銀の弾丸|（[A-Za-z][^）]*）)" apps/docs/src/pages/sessions/05-workflow-errors.astro
grep -nE "(である|であった|だった|ではない|だ)。" apps/docs/src/pages/sessions/05-workflow-errors.astro
rg -n "Result は成功と失敗を値で表す|成功を表す.*Ok.*失敗を表す.*Err|先に呼び出し側の対応から選びます|システムエラーとして扱います|データベースへの保存中に接続が切れ|イベント追加や通知は実行せず|500などのエラー応答" apps/docs/src/pages/sessions/05-workflow-errors.astro
rg -n "成功経路|技術的な異常は例外|呼び出し側で業務上の対応を選べない異常" apps/docs/src/pages/sessions/05-workflow-errors.astro
git diff --check
git diff --stat
git status --short
```

Expected: 必須文面の検索はすべて該当し、文体検査と旧説明の検索は該当なし、`git diff --check` は成功します。変更は教材ページと本計画ファイルだけです。

- [ ] **Step 6: 変更をコミットする**

```bash
git add apps/docs/src/pages/sessions/05-workflow-errors.astro docs/superpowers/plans/2026-09-01-session-05-result-error-boundary-copy.md
git commit -m "docs(session-05): Resultの定義を判断基準より先に説明"
```
