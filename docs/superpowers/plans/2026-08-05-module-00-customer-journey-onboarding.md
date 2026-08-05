# Module 00 顧客体験オンボーディング実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Module 00を、利用者と現場の来院の流れからプロダクト価値、状態、実装へ進む開発メンバー向けオンボーディングに再構成する。

**Architecture:** 既存の任意`introBlocks`と`overview`を再利用し、機能・届ける相手・価値だけを`value-map`という新しい構造化ブロックで表す。`introBlocks`はすでにヒーロー直後かつ共通の目次生成前に描画されるため、ページの描画経路やSPAルートは変更しない。

**Tech Stack:** TypeScript、Vite、Vitest、Happy DOM、DOM API

## Global Constraints

- 正規ルート`/modules/00-break-the-app/`と既存SPAルーティングを変更しない。
- `introBlocks`は任意のままとし、Module 01–05のコンテンツ契約と表示順を変えない。
- ユーザーが読むオンボーディング本文は日本語で書き、コード上の型名・状態だけは実装との対応のため英字を維持する。
- 利用者と現場の来院の流れを状態より前に示す。
- 通常の再診手順は今回の演習では扱いません。
- DOMは`document.createElement`と`textContent`で構築し、`innerHTML`を使わない。
- 新しい視覚装飾は追加せず、既存のコンテンツセクションと表の表示規則を使う。

---

### Task 1: 機能・相手・価値を表す`value-map`ブロックを追加する

**Files:**
- Modify: `apps/docs/src/content/module-content.ts:16-29`
- Modify: `apps/docs/src/components/content-block.ts:1-130`
- Modify: `apps/docs/src/components/content-block.test.ts:1-132`

**Interfaces:**
- Produces: `ContentBlock` variant `{ kind: "value-map"; heading: string; introduction: string; rows: readonly { function: string; audiences: string; value: string }[] }`.
- Produces: `renderContentBlock(block: ContentBlock): HTMLElement` support for a semantic value table.

- [ ] **Step 1: 失敗するレンダラーテストを書く**

`content-block.test.ts`の既存ブロックfixtureに、次の`value-map`を追加する。

```ts
{
  kind: "value-map",
  heading: "機能が届ける価値",
  introduction: "各機能が、誰にどんな価値を届けるかを確認します。",
  rows: [
    {
      function: "予約・受付",
      audiences: "受付スタッフ、飼い主",
      value: "来院を迷わず正しく受け入れられる。",
    },
  ],
}
```

同ファイルに次のテストを追加する。

```ts
it("value-map を見出し、説明、列見出し、全行を持つ意味論的な table で描画する", () => {
  const element = renderContentBlock({
    kind: "value-map",
    heading: "機能が届ける価値",
    introduction: "各機能が、誰にどんな価値を届けるかを確認します。",
    rows: [
      {
        function: "予約・受付",
        audiences: "受付スタッフ、飼い主",
        value: "来院を迷わず正しく受け入れられる。",
      },
      {
        function: "診察・カルテ",
        audiences: "獣医師、病院スタッフ",
        value: "診療の記録を一貫して扱える。",
      },
      {
        function: "会計",
        audiences: "会計担当、飼い主",
        value: "確定した来院記録と会計を誤って壊さない。",
      },
      {
        function: "フォロー連絡、連絡先の管理、申し送り",
        audiences: "病院スタッフ、飼い主",
        value: "必要な連絡を安全に引き継げる。",
      },
    ],
  });

  expect(element.tagName).toBe("SECTION");
  expect(element.querySelector("h2")?.textContent).toBe("機能が届ける価値");
  expect(element.querySelector("p")?.textContent).toBe(
    "各機能が、誰にどんな価値を届けるかを確認します。",
  );
  expect([...element.querySelectorAll("th")].map(({ textContent, scope }) => [textContent, scope]))
    .toEqual([["機能", "col"], ["届ける相手", "col"], ["価値", "col"]]);
  expect([...element.querySelectorAll("tbody tr")].map(({ textContent }) => textContent))
    .toEqual([
      "予約・受付受付スタッフ、飼い主来院を迷わず正しく受け入れられる。",
      "診察・カルテ獣医師、病院スタッフ診療の記録を一貫して扱える。",
      "会計会計担当、飼い主確定した来院記録と会計を誤って壊さない。",
      "フォロー連絡、連絡先の管理、申し送り病院スタッフ、飼い主必要な連絡を安全に引き継げる。",
    ]);
});
```

- [ ] **Step 2: テストが期待どおり失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/components/content-block.test.ts`

Expected: `value-map`が`ContentBlock`へ代入できないか、`renderContentBlock`の網羅switchで扱われないためFAILする。

- [ ] **Step 3: 型とセマンティックなレンダラーを実装する**

`module-content.ts`の`overview` variant直後に、次の`value-map` variantを追加する。

```ts
| Readonly<{
    kind: "value-map";
    heading: string;
    introduction: string;
    rows: readonly Readonly<{
      function: string;
      audiences: string;
      value: string;
    }>[];
  }>
```

`content-block.ts`に`renderValueMap`を追加する。`section.content-block.value-map-block`の中へ`h2`、説明用`p`、`table`を順にappendする。`thead > tr`へ`機能`、`届ける相手`、`価値`の`th`を追加し、各`th.scope`を`"col"`に設定する。`tbody`では各`row`について`function`、`audiences`、`value`の順に`td`を追加する。すべての文字列に`textContent`を使う。

`renderContentBlock`のswitchに次を追加する。

```ts
case "value-map":
  return renderValueMap(block);
```

- [ ] **Step 4: レンダラーテストが通ることを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/components/content-block.test.ts`

Expected: PASS。

- [ ] **Step 5: コミットする**

```bash
git add apps/docs/src/content/module-content.ts apps/docs/src/components/content-block.ts apps/docs/src/components/content-block.test.ts
git commit -m "feat(docs): add product value map block"
```

### Task 2: Module 00を顧客体験から実装へ進む順序に置き換える

**Files:**
- Modify: `apps/docs/src/content/modules/00-break-the-app.ts:61-132`
- Modify: `apps/docs/src/content/modules/00-introduction.test.ts:14-82`
- Modify: `apps/docs/src/pages/module-page.test.ts:166-220`

**Interfaces:**
- Consumes: Task 1の`ContentBlock` `value-map` variant。
- Produces: Module 00の`introBlocks`が「開発者の役割 → 来院の体験 → 機能と価値 → 状態対応 → 開発者の作業」の順になる。

- [ ] **Step 1: 失敗するModule 00コンテンツと表示順のテストを書く**

`00-introduction.test.ts`に、`breakTheAppModule.introBlocks?.map(({ heading }) => heading)`が次と完全一致するテストを追加する。

```ts
[
  "この開発に参加するあなたへ",
  "1回の来院で起きること",
  "機能が届ける価値",
  "アプリは業務をどう表すか",
  "開発者として今日行うこと",
]
```

同テストで以下を検証する。

```ts
const valueMap = breakTheAppModule.introBlocks?.find(
  (block) => block.kind === "value-map",
);
expect(valueMap).toMatchObject({
  rows: [
    { function: "予約・受付", audiences: "受付スタッフ、飼い主", value: "来院を迷わず正しく受け入れられる。" },
    { function: "診察・カルテ", audiences: "獣医師、病院スタッフ", value: "診療の記録を一貫して扱える。" },
    { function: "会計", audiences: "会計担当、飼い主", value: "確定した来院記録と会計を誤って壊さない。" },
    { function: "フォロー連絡、連絡先の管理、申し送り", audiences: "病院スタッフ、飼い主", value: "必要な連絡を安全に引き継げる。" },
  ],
});
```

来院の流れを示すblockを抽出してJSON化し、`予約`、`受付`、`診察と記録`、`会計と完了`、`再診`を含み、`scheduled`、`checked-in`、`in-examination`、`paid`を含まないことを検証する。状態対応blockでは4つの状態と、`paid`から診察中へ戻さないルールを検証する。開発者blockでは`src/legacy`、`exercises`、`test`、`src/clinic`を検証する。既存の事故シナリオと業務影響を検証するテストは維持する。

`module-page.test.ts`のModule 00表示テストで、最初の6つの`main > section:not(.module-hero) h2`が次に一致することを検証する。

```ts
[
  "この開発に参加するあなたへ",
  "1回の来院で起きること",
  "機能が届ける価値",
  "アプリは業務をどう表すか",
  "開発者として今日行うこと",
  "事故",
]
```

さらに、目次が最初の5見出しを順に含み、`content-value-map-機能が届ける価値`が`trigger`より前にあることを検証する。

- [ ] **Step 2: テストが期待どおり失敗することを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/content/modules/00-introduction.test.ts src/pages/module-page.test.ts`

Expected: 現行の3つの導入見出しには利用者の来院の流れ・価値の対応表・状態対応の5区画がないためFAILする。

- [ ] **Step 3: Module 00の導入データを置き換える**

`00-break-the-app.ts`の`introBlocks`を、次の順と内容で置き換える。

1. `overview`「この開発に参加するあなたへ」: 完成形を一度に作らず、システム障害を防ぐためのルールを見つけ、小さな改善と確認を繰り返すこと。`あなたの役割`としてTypeScript開発者が誰のどんな困りごとを守るかを確かめること。
2. `overview`「1回の来院で起きること」: `予約`、`受付`、`診察と記録`、`会計と完了`、`再診`の5項目を置く。`再診`の文言は「通常の再診手順は今回の演習では扱いません。」とする。状態は含めない。
3. `value-map`「機能が届ける価値」: Step 1の4行をそのまま置く。
4. `overview`「アプリは業務をどう表すか」: `予約済み: scheduled`、`受付済み: checked-in`、`診察中: in-examination`、`会計済み・来院完了: paid`を対応させる。`今回守ること`として、`paid`の来院を診察中へ戻さず、「通常の再診手順は今回の演習では扱いません。」と書く。
5. `overview`「開発者として今日行うこと」: `packages/clinic-example`、`src/legacy`、`exercises`、`test`、`src/clinic`の役割を示し、事故報告、状態遷移を型で表す、境界とID、Result、エージェントレビューを現場で守ることとのつながりで予告する。

`blocks`の事故シナリオ、業務影響、観察ポイント、次セッションへの導線は変更しない。`module-page.ts`の`introBlocks`描画と目次生成は既に必要な順序・ID・リンクを提供するため変更しない。

- [ ] **Step 4: コンテンツと表示順のテストが通ることを確認する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/content/modules/00-introduction.test.ts src/pages/module-page.test.ts`

Expected: PASS。

- [ ] **Step 5: コミットする**

```bash
git add apps/docs/src/content/modules/00-break-the-app.ts apps/docs/src/content/modules/00-introduction.test.ts apps/docs/src/pages/module-page.test.ts
git commit -m "feat(docs): explain module 00 from customer journey"
```

### Task 3: docsアプリ全体で顧客体験オンボーディングを検証する

**Files:**
- Verify: `apps/docs/src/components/content-block.test.ts`
- Verify: `apps/docs/src/content/modules/00-introduction.test.ts`
- Verify: `apps/docs/src/pages/module-page.test.ts`
- Verify: `apps/docs/src/routes.test.ts`
- Modify: `docs/superpowers/plans/2026-08-05-module-00-customer-journey-onboarding.md`

**Interfaces:**
- Verifies: 新しい価値の対応表、Module 00の利用者優先順、正規ルート、Module 01–05の後方互換。

- [ ] **Step 1: 4つの回帰テストをまとめて実行する**

Run: `pnpm --filter @fp-with-ts/docs test -- src/components/content-block.test.ts src/content/modules/00-introduction.test.ts src/pages/module-page.test.ts src/routes.test.ts`

Expected: PASS。

- [ ] **Step 2: docsアプリの全テストを実行する**

Run: `pnpm --filter @fp-with-ts/docs test`

Expected: PASS。

- [ ] **Step 3: docsアプリの型検査を実行する**

Run: `pnpm --filter @fp-with-ts/docs typecheck`

Expected: exit code 0。

- [ ] **Step 4: docsアプリをビルドする**

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: exit code 0。

- [ ] **Step 5: 計画書をコミットする**

```bash
git add docs/superpowers/plans/2026-08-05-module-00-customer-journey-onboarding.md
git commit -m "docs: plan customer journey onboarding"
```
