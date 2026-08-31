# Session 05 Result Error Boundary Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SESSION 05で、Resultに含める失敗と例外として中断する異常を、顧客や現場が選べる操作と後続処理の前提から判断できるようにします。

**Architecture:** ページが所有する説明を `05-workflow-errors.astro` 内で完結させます。説明の整合性はページ内の関連文面を同じ判断基準へ揃え、既存テストと静的ビルドで構造上の退行がないことを確認します。人向け文章の完全一致を固定するテストは追加しません。ドメインコード、演習コード、CSSは変更しません。

**Tech Stack:** Astro 4、TypeScript 5、Vitest 2、pnpm

**Spec:** 独立した設計書はありません。本計画の Global Constraints に、対話で合意した説明要件を記録します。

**References:** [Scott Wlaschinによるエラー分類](https://fsharpforfunandprofit.com/posts/against-railway-oriented-programming/)、[DMMF公式サンプルの失敗を継続する判断](https://github.com/swlaschin/DomainModelingMadeFunctional/blob/master/src/OrderTaking/PlaceOrder.Implementation.fs#L88-L112)

## Global Constraints

- `Result<T, E>` の `E` は発生しうるエラーの一覧ではなく、顧客や現場が失敗理由に応じて操作を選ぶ必要がある失敗だけを表します。
- エラーが業務処理とインフラのどちらで発生したかだけでは、Resultと例外を分類しません。
- 予約なしでは予約を探し直し、受付前では受付を先に行うという、失敗ごとに異なる操作を示します。
- 顧客や現場が選べる操作がなく、後続処理が失敗した処理の出力や完了を前提とする場合は、Resultへ変換せず例外として成功経路を中断します。
- 副作用の具体例には「データベースへの保存が完了したか確認できないままキューへのイベント追加や外部サービスへの通知を送る」を使います。
- `Err` と例外はどちらも成功経路を止めます。`Err` は呼び出し側へ戻して業務上の分岐に使い、例外は外側の例外境界で捕捉するという違いを明記します。
- ログ記録、ロールバック、接続の解放は成功経路ではなく失敗時の処理なので、例外発生後にも実行できることを明記します。
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

- Produces: Resultへ含める失敗、例外として中断する異常、成功経路を止める理由をページ単体で説明する教材文

- [ ] **Step 1: 冒頭の判断基準を原因分類から業務上の操作へ置き換える**

`apps/docs/src/pages/sessions/05-workflow-errors.astro` の `result-or-exception` articleを、次の内容へ置き換えます。

```astro
<article class="teaching-topic" aria-labelledby="result-or-exception">
  <h3 id="result-or-exception">Result にする失敗を先に選ぶ</h3>
  <p>
    <code>Result&lt;T, E&gt;</code> の <code>E</code> は、発生しうるエラーの一覧ではありません。顧客や現場が失敗理由に応じて次の操作を選ぶ必要がある失敗だけを置きます。
  </p>
  <p>
    判断するときは、失敗の発生場所ではなく、その失敗に固有の業務上の対応を一つ具体的に言えるかを確認します。
  </p>
  <ul class="decision-list">
    <li>
      <strong>失敗に固有の操作があるなら Result:</strong> 予約が存在しなければ予約を探し直し、受付済みでなければ先に受付するか画面を更新します。このような失敗は <code>Err</code> で返します。
    </li>
    <li>
      <strong>選べる操作がなく、成功経路を続けてはいけないなら例外:</strong> 後続処理が、失敗した処理の出力や完了を前提としている場合は、その前提が成立しないまま処理を続けてはいけません。
    </li>
  </ul>
  <p>
    たとえば、データベースへの保存が完了したか確認できないままキューへのイベント追加や外部サービスへの通知を送ると、保存されていない変更についてイベントや通知だけが届く可能性があります。そのため、保存処理で異常が起きた時点で成功経路を中断し、外側の例外境界で記録してエラー応答へ変換します。
  </p>
  <p>
    <code>Err</code> も例外も成功経路を止めます。<code>Err</code> は呼び出し側へ戻して業務上の分岐に使い、例外は外側の例外境界で捕捉します。ログ記録、ロールバック、接続の解放は失敗時の処理なので実行します。
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
  "後続処理の前提を満たせず、Resultへ変換せず外側へ伝える異常は何か",
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
why: "before は実行時には例外で処理が止まりますが、どの行が何をthrowするかは型に現れません。after は成功時に InExamination のどの情報が得られるかと、予約なし・状態不正のどちらで失敗するかを定義から確認できます。Err になった時点で後続の andThen と map は呼ばれません。resolver と store は外部境界として deps から受け取りますが、状態遷移はドメイン知識なので直接呼びます。store.save が投げる保存障害は、顧客や現場が理由別の操作を選ぶ業務結果ではないため、その時点で成功経路を中断して例外として伝播させます。",
```

`match` topicの `why` の末尾は、「技術的な例外」という原因分類を削除します。

```ts
why: "before では InvalidAppointmentState が追加されても catch に型エラーが出ないため、受付前の予約だけ500になりました。after は match の失敗側で union 全体を受け取り、default 節から never 専用の assertNever を呼びます。エラーの種類を追加して case を足し忘れると新しい型が default 節に残り、コンパイルエラーになります。Result に含めていない例外は、この switch では捕捉せず外側の例外境界へ伝えます。",
```

`narrative.limitation` も同じ語彙へ揃えます。

```ts
limitation: "どの失敗に固有の業務上の対応があるか、画面でどのnoticeへ変換するかは、人の判断とレビューが必要になる。顧客や現場が理由別の操作を選ばず、後続処理が前の処理の完了を前提とする異常はResultへ変換せず、外側の例外境界へ伝える。",
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
rg -n "発生しうるエラーの一覧ではありません|失敗理由に応じて次の操作を選ぶ|データベースへの保存が完了したか確認できないまま|キューへのイベント追加や外部サービスへの通知|Err</code> も例外も成功経路を止めます|ログ記録、ロールバック、接続の解放" apps/docs/src/pages/sessions/05-workflow-errors.astro
rg -n "技術的な異常は例外|呼び出し側で業務上の対応を選べない異常" apps/docs/src/pages/sessions/05-workflow-errors.astro
git diff --check
git diff --stat
git status --short
```

Expected: 必須文面の検索はすべて該当し、文体検査と旧説明の検索は該当なし、`git diff --check` は成功します。変更は教材ページと本計画ファイルだけです。

- [ ] **Step 6: 変更をコミットする**

```bash
git add apps/docs/src/pages/sessions/05-workflow-errors.astro docs/superpowers/plans/2026-09-01-session-05-result-error-boundary-copy.md
git commit -m "docs(session-05): Resultに含める失敗の判断基準を具体化"
```
