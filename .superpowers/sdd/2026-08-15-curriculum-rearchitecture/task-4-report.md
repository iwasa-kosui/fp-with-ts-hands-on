# Task 4 report: catalog 契約・差分予算・共通ページ基盤

## 結果

- `sessions` を `00-onboarding`、S1〜S4、`final` の6件へ更新した。
- 設計 §6.3 の16不変条件を、catalog、実ファイル参照、差分予算の3テストへ分離して固定した。
- `StepSolution` と `PeerReviewPanel` を静的 Astro コンポーネントとして追加した。
- `SessionLayout` に kind 別の章定義を追加し、同じ定義から desktop/mobile のTOCを生成するようにした。
- 動的 route は技術的には描画できたが、現行 static page と共存した状態では catalog 由来の6 routeを生成できないため採用しなかった。P2 は手書き6 routeの薄いwrapperで進める。

## catalog と差分予算

差分予算テストは、starter と次 snapshot の同じモジュールをファイル名で対応させ、行単位のLCSで解答側の追加・変更行を数える。空行とコメントのみの行は除外する。削除だけのファイルは参加者が追加・変更するファイルとして数えない。

| Session | module | files | effective lines |
| --- | --- | ---: | ---: |
| S1 | `examples/session-01/src/domain/appointment` | 2 | 35 |
| S2 | `examples/session-02/src/boundary` | 2 | 24 |
| S3 | `examples/session-03/src/useCase` | 3 | 77 |
| S4 | `examples/session-04/src/useCase` | 3 | 35 |

4件とも上限5ファイル・80実効行以内であり、catalog の `fileBudget` / `lineBudget` には実測値そのものを記録した。S1/S3/S4 は4 steps、S2 は2 steps、全exerciseは3 decisions、`pickCount: 2`、7/7/8/8分の peer review、同じ正式文言の3問を持つ。`session-05` は `ExampleSnapshot` に残し、`sessions` 配列には含めていない。

Task 4 plan と設計 §6.3 のcatalog契約は `1 <= steps <= 4` である。設計 §4.2 のS2 4-step想定に対し、現starterの `pnpm exercise:02` はStep 1/2だけがRED、Step 3/4は開始時点からGREENだった。存在しない独立RED→GREENを表示しないため、S2 catalogは実在する2つの参加者変更単位へ縮約した。参照テストはexerciseをJSON reporterで実行し、top-level `success === false`、failed test 2件、各 `failureMessages` が非空かつ全て `AssertionError:` で始まることを検査する。さらにstable step idと、この2件の失敗test group/assertionを1対1で照合する。goal/target/solution/rangeは二重記述せず、catalog本体と汎用AST参照検査を正とする。

## solution/reference 契約

- `targets`、`solution.path`、`finalReferences` は repo-root relative に統一した。
- 各 `solution.path` は次 snapshot の `src/**` に限定した。TypeScript ASTで `solution.symbol` に対応するtop-level宣言を探し、1-based inclusive rangeが宣言全体を含むことを検査する。文字列が偶然range内に現れるだけでは通らない。
- reviewで判明した regression test / harness への3参照を実装宣言へ修正した。S2は実際にREDになるparse/maskingの2件だけを残し、S3の失敗後の停止とS4の保存失敗は、それぞれ次snapshotの `startExamination` パイプラインへ対応させた。S4の import-only `EventContext` 参照も `startExamination` 宣言へ修正した。
- `StepSolution` は実ファイルの指定行だけを `<details><pre><code>` に描画する。開始行0、逆順、範囲外、空sliceは明示エラーにする。
- `PeerReviewPanel` は「N分・1〜2名」、3問、約束事へのリンクを描画する。S1は `#peer-review-promises`、S2以降は `/sessions/01-state-modeling/#peer-review-promises` を渡せる。

## dynamic route spike

`[slug].astro`、`getStaticPaths(sessions)`、eager `import.meta.glob`、6 content componentを一時作成し、wrapperだけが持つ `data-route-origin="catalog-dynamic"` と各content markerで検査した。component render testでは6件すべてを描画でき、既存 static pageにはwrapper markerがないことも確認できた。

一方、実buildでは既存 static pageとslugが重なる `00`〜`03` は動的 routeから生成されず、`final` は後からstatic pageに上書きされた。markerがbuild outputに残ったのは新規slug `04-effects-and-events` だけだった。さらに現行 verifier はこのHTMLを unexpected fileとして拒否した。

したがって、Astro 4での技術経路自体は成立するが、Task 4単独では既存本文・literal tests・verifierを維持したままtruthfulな6 route生成を証明できない。spike の route、content、testは削除した。Task 5では本文移行と同時に、catalog slugに対応する手書き6 routeを薄いwrapperとして確定する。

## Task 5までの一時互換

既存ページと既存テストを壊さないため、次を最小互換として残した。

- `sessionBySlug` は旧 `04-agent-review` / `05-mini-integration` を `sessions` 配列外のaliasとして解決する。
- `SessionLayout` は旧ページが `toc` slotを渡す間だけ、その手書きTOC、旧route順の前後ナビゲーション、S0の旧表示時間を使う。新API利用時はcatalog kindの章定義を使う。
- Code Explorerには新slug `04-effects-and-events` のworkspace aliasを追加した。旧slugのworkspaceは既存ページ用に維持する。
- `site-contract.test.ts` はcatalogの新6件と、本文移行前の旧7 static page集合を別々に固定する。

Task 5で6ページを新slugの薄いwrapperへ移した後、上記の旧slug alias、手書きTOC互換、S0表示時間互換、旧workspace、旧route集合のassertionを削除する。正規planのTask 5、P3 fallback、P4 rehearsalは、literal 4 step/detailsではなくcatalogのtruthfulな `steps.length` / 1〜4 stepsへ直接同期した。P1の4 `describe` 契約や、4 exercises / 4 review roundsなど正しい4件要件は変更していない。

## TDD と検証

REDを確認した対象:

- 旧schemaに対するcatalog 16契約、参照契約、差分予算契約
- 未実装の `StepSolution` / `PeerReviewPanel` と、そのrendered HTML・エラー契約
- authored TOCしか持たない旧 `SessionLayout` に対する章定義駆動TOC契約
- dynamic route wrapperの実在・marker契約
- review修正では、次snapshotの `src/**` 外を指すsolutionを拒否する参照契約
- review fix round 2では、S2のcatalog 4件と実際にREDになるassertion 2件の不一致、およびS3 step 4の余分なtarget
- review fix round 3では、exercise失敗数だけが一致する偽陽性（top-level successや失敗種別を捨てるhelper）

最終確認:

- `pnpm --filter @fp-with-ts/docs test`: 25 files / 108 tests passed
- `pnpm --filter @fp-with-ts/docs build`: passed、10 HTML / 10 internal routes verified
- `pnpm typecheck`: passed（docsは0 errors / 0 warnings / 0 hints）
- `pnpm test`: passed（全session snapshotとdocs）
- `pnpm build`: passed
- `git diff --check`: passed
- `examples/**`、`examples/final/**`、`worker/**`、`README.md`、`docs/event/**` の変更: 0
- 新依存、Content Collections、MDXの追加: なし

CSSと公開ページ本文は変更しておらず、新しい章定義TOCはTask 5のwrapperから使う基盤であるため、このtaskでは視覚差分確認を追加していない。
