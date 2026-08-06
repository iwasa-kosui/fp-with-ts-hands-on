# 来院の状態遷移を明確にする Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Module 00 の「来院をモデリングしよう」で、来院業務で起きる出来事、遷移前後の状態、状態に残る情報を対応付け、読者が状態遷移を自分でモデリングした感覚を持てるようにする。

**Architecture:** `00-break-the-app.astro` の既存 `#visit-modeling` 節を、状態名の列挙からアクセシブルな状態遷移表へ置き換える。通常の来院経路とキャンセル分岐を同じ表で示し、表の直後に終端状態と再診を新規予約として扱う範囲を明記する。内容の意図と表の構造は、同ページを静的レンダリングする既存テストで固定する。

**Tech Stack:** Astro 4、TypeScript、Vitest 2、happy-dom

## Global Constraints

- 変更範囲は `apps/docs/src/pages/modules/00-break-the-app.astro` の `#visit-modeling` と、その表示テストだけに限定し、`packages/clinic-example` のドメインモデル・演習テストは変更しない。
- 遷移は実装済みの業務モデルと一致させる: 予約で `scheduled`、受付で `checked-in`、診察開始で `in-examination`、会計の確定で `paid`、予約または受付済みからのキャンセルで `canceled`。
- `paid` と `canceled` は終端状態として扱い、`paid` から診察中へ戻る矢印を示さない。再診は既存の会計済み来院を戻す操作ではなく、新しい予約として扱い、今回の演習範囲外であることを明記する。
- 状態遷移表は HTML の `table`、列見出しの `th scope="col"`、行見出しの `th scope="row"` を使う。SVG、JavaScript、専用 CSS は追加しない。
- テストコマンドは pnpm 9.12.0 を使う。依存関係が未導入の worktree では、検証前にリポジトリ直下で `pnpm install` を実行する。

---

## File Structure

- Modify: `apps/docs/src/pages/modules/00-break-the-app.astro` — `#visit-modeling` を、業務イベントと遷移を対応付ける説明・表・終端状態の注記へ更新する。
- Modify: `apps/docs/src/test/pages/modules/module-00.test.ts` — 状態遷移表の見出し、列、5つの遷移、終端状態の注記を静的 HTML から検証する。

### Task 1: 状態遷移表のレンダリング契約を先に固定する

**Files:**
- Modify: `apps/docs/src/test/pages/modules/module-00.test.ts:13-34`

**Interfaces:**
- Consumes: `BreakTheAppPage` を `createAstroContainer()` で静的 HTML としてレンダリングする既存のテスト基盤、`parseStaticMarkup()`。
- Produces: `#visit-state-transitions` を持つ表と、業務イベント・遷移前後・保持情報の4列を要求する回帰テスト。

- [ ] **Step 1: 失敗する状態遷移表のテストを書く**

最初の `it("onboards participants before reproducing the incident", ...)` で `document` を作成した直後に、空白を正規化するヘルパーと以下の期待値を追加する。既存の `h2` 見出しの期待値は変更しない。

```ts
const compact = (text: string | null): string => text?.replaceAll(/\s+/g, " ").trim() ?? "";
const transitionTable = document.querySelector("#visit-state-transitions");

expect(transitionTable?.getAttribute("aria-label")).toBe("来院の状態遷移");
expect(
  [...(transitionTable?.querySelectorAll("thead th") ?? [])].map((cell) => compact(cell.textContent)),
).toEqual(["業務で起きること", "遷移前の状態", "遷移後の状態", "その状態に残る情報"]);
expect(
  [...(transitionTable?.querySelectorAll("tbody tr") ?? [])].map((row) =>
    [...row.querySelectorAll("th, td")].map((cell) => compact(cell.textContent)),
  ),
).toEqual([
  ["飼い主の予約を受け付ける", "来院記録なし", "予約済み（scheduled）", "予約日時"],
  ["受付スタッフが来院を確認する", "予約済み（scheduled）", "受付済み（checked-in）", "受付時刻"],
  ["獣医師が診察を開始する", "受付済み（checked-in）", "診察中（in-examination）", "担当獣医師、診察開始時刻"],
  ["会計担当が診療内容と請求を確定する", "診察中（in-examination）", "会計済み・来院完了（paid）", "診断、処置、請求金額、会計時刻"],
  ["飼い主または病院が予約を取り消す", "予約済み（scheduled）または受付済み（checked-in）", "キャンセル（canceled）", "キャンセル理由、キャンセル時刻、任意の再診希望日"],
]);
expect(html).toContain("Paid と Canceled は終端状態");
expect(html).toContain("再診は新しい予約として扱い、今回の演習では扱いません");
```

- [ ] **Step 2: テストが期待どおり失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/test/pages/modules/module-00.test.ts`

Expected: 現在のページには `#visit-state-transitions` も5行の遷移表もないため、`aria-label` の期待値から FAIL する。

- [ ] **Step 3: 回帰テストの意図を確認する**

テストが次の教育上の契約を一つずつ検証していることを確認する。

```text
業務イベント → 遷移前の状態 → 遷移後の状態 → 状態に残る情報

予約の受け付け → 来院記録なし → scheduled → 予約日時
受付 → scheduled → checked-in → 受付時刻
診察開始 → checked-in → in-examination → 担当獣医師、診察開始時刻
会計の確定 → in-examination → paid → 診断、処置、請求金額、会計時刻
キャンセル → scheduled または checked-in → canceled → 理由、時刻、任意の再診希望日
```

### Task 2: 「来院をモデリングしよう」を業務イベント起点の表へ置き換える

**Files:**
- Modify: `apps/docs/src/pages/modules/00-break-the-app.astro:106-116`
- Test: `apps/docs/src/test/pages/modules/module-00.test.ts:13-34`

**Interfaces:**
- Consumes: Task 1 の `#visit-state-transitions`、4列、5行の表示契約。
- Produces: 通常経路とキャンセル分岐を同じ画面で追え、終端状態から復帰させない理由を読める Module 00 の導入コンテンツ。

- [ ] **Step 1: 現在の状態名だけの順序リストを削除する**

`#visit-modeling` 内の次の断片を削除する。状態名だけを順に並べる表現を残さない。

```astro
<ol aria-label="来院状態の流れ">
  <li>予約済み（<code>scheduled</code>）</li>
  <li>受付済み（<code>checked-in</code>）</li>
  <li>診察中（<code>in-examination</code>）</li>
  <li>会計済み・来院完了（<code>paid</code>）</li>
</ol>
```

- [ ] **Step 2: 業務イベント・状態・保持情報を対応付ける表を実装する**

導入文を「アプリでは、業務で起きた出来事ごとに、来院記録を次の状態へ進めます。」へ置き換え、直後に次の表を置く。`<code>` 内の状態値は表のテキスト期待値を保つため、前後に日本語の丸括弧を置く。

```astro
<table id="visit-state-transitions" aria-label="来院の状態遷移">
  <thead>
    <tr>
      <th scope="col">業務で起きること</th>
      <th scope="col">遷移前の状態</th>
      <th scope="col">遷移後の状態</th>
      <th scope="col">その状態に残る情報</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">飼い主の予約を受け付ける</th>
      <td>来院記録なし</td>
      <td>予約済み（<code>scheduled</code>）</td>
      <td>予約日時</td>
    </tr>
    <tr>
      <th scope="row">受付スタッフが来院を確認する</th>
      <td>予約済み（<code>scheduled</code>）</td>
      <td>受付済み（<code>checked-in</code>）</td>
      <td>受付時刻</td>
    </tr>
    <tr>
      <th scope="row">獣医師が診察を開始する</th>
      <td>受付済み（<code>checked-in</code>）</td>
      <td>診察中（<code>in-examination</code>）</td>
      <td>担当獣医師、診察開始時刻</td>
    </tr>
    <tr>
      <th scope="row">会計担当が診療内容と請求を確定する</th>
      <td>診察中（<code>in-examination</code>）</td>
      <td>会計済み・来院完了（<code>paid</code>）</td>
      <td>診断、処置、請求金額、会計時刻</td>
    </tr>
    <tr>
      <th scope="row">飼い主または病院が予約を取り消す</th>
      <td>予約済み（<code>scheduled</code>）または受付済み（<code>checked-in</code>）</td>
      <td>キャンセル（<code>canceled</code>）</td>
      <td>キャンセル理由、キャンセル時刻、任意の再診希望日</td>
    </tr>
  </tbody>
</table>
```

- [ ] **Step 3: 終端状態と事故の意味を表の直後に明示する**

表の直後に次の2段落を置く。これにより、表にない `paid → in-examination` を「省略」ではなく「許可しない遷移」として読めるようにする。

```astro
<p>
  <strong>守るルール:</strong> Paid と Canceled は終端状態です。会計済みの来院を診察中へ戻す業務は存在しません。
</p>
<p>再診は新しい予約として扱い、今回の演習では扱いません。</p>
```

- [ ] **Step 4: 対象テストが通ることを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/test/pages/modules/module-00.test.ts`

Expected: PASS。表の5行が業務イベントから状態への遷移として順に読み取れ、`paid` と `canceled` の終端性および再診の範囲外が検証される。

- [ ] **Step 5: ドキュメントサイト全体の型・静的出力を確認する**

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: PASS。`astro check`、静的サイト生成、`verify-static-build.mjs` が成功し、表の追加によってルートや静的出力の契約を壊していない。

- [ ] **Step 6: コミットする**

```bash
git add apps/docs/src/pages/modules/00-break-the-app.astro apps/docs/src/test/pages/modules/module-00.test.ts
git commit -m "fix(docs): clarify visit state transitions"
```

## Verification Summary

- 対象テスト: `pnpm --filter @fp-with-ts/docs test -- src/test/pages/modules/module-00.test.ts`
- ドキュメント型検査・静的生成: `pnpm --filter @fp-with-ts/docs build`
- 手動確認: Module 00 で「予約を受け付ける」から「会計を確定する」までを表の上から下へ追い、キャンセルが `scheduled` と `checked-in` だけから起きること、`paid` と `canceled` から次の行がないことを確認する。
