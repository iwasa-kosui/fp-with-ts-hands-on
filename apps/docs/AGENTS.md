# 公開サイト作業ガイド

## セッションページの受け入れ条件

`src/pages/sessions/*.astro` を変更する場合は、背景、登場人物の要求、出来事、参加者の作業、確認方法、期待する気づきを、ページ単体で理解できる順序で示す。最初のセッションだけでなく、後続セッションも同じ学習構造を保つ。散文は `src/sessions/prose/<session-slug>/<page-slug>.mdx` に分かれている。各 session の最初のページは `index.mdx` である。この `.mdx` を変更する場合にも同じ条件を適用する。

状態モデリングを扱う場合は、業務イベント、遷移前、遷移後、実装する関数を対応させる。時系列や状態遷移を理解しづらい表だけで説明せず、内容に応じてタイムライン、段階表示、状態図、カードを使う。

トップページ、案内ページ、エラーページにはこのモジュール構造を強制しない。すべての参加者向けページでは、日本の開発現場で自然な日本語を使い、不自然な直訳やプロジェクトで定着していない用語を避ける。

## トップページの保護

明示的な依頼がない限り、トップページの見た目、文章、情報量、主要導線を変更しない。トップページの直接変更だけでなく、サイト基盤の移行、共通レイアウト、共通 CSS の変更も影響対象として扱う。

影響する変更では、`pnpm --filter @fp-with-ts/docs test` と `pnpm --filter @fp-with-ts/docs build` を実行する。表示を変更した箇所は、ユーザーが見る実画面を確認する。

## 変更時に同期する対象

セッションの追加、改名、移動では、次をまとめて同期する。

- `src/pages/sessions/<session-slug>.astro`（最初のページ）と `src/pages/sessions/<session-slug>/[page].astro`（残りのページ）: ルート、frontmatter、本文、前後ナビゲーションと対応するページテスト。
- `src/sessions/prose/<session-slug>/<page-slug>.mdx`: 各ページの本文。
- `src/sessions/pages/<session-slug>.ts`: `sessionPages` に、ページの一覧と順序がある。ページを足すときは、`sessionPages` に slug を足し、同じ名前の `.mdx` を作る。`.mdx` が無いと、`SessionProsePage.astro` が例外を投げてビルドが失敗する。
- `src/sessions/pages/<session-slug>-content.ts`: 各ページの文言。
- `scripts/verify-static-build.mjs` の必須 HTML、内部リンク、前後ナビゲーション。
- 旧 URL を維持する場合は、`../../worker/routes.ts` とそのテスト。

## UIの検証方針

E2Eテストと画像スナップショットテストは追加しない。文言、HTML構造、配色、配置を固定するテストへ置き換えることもしない。見た目を変更した場合は、対象ページをモバイルとデスクトップの実画面で確認する。過去の設計書や実装計画にE2Eの追加・実行手順が残っていても、この方針を優先する。

## 変更範囲別の検証

- ページを変更したときは、`pnpm --filter @fp-with-ts/docs test` と `pnpm --filter @fp-with-ts/docs build` を実行する。
- CSS とレスポンシブ UI を変更したときは、ページ変更時の検証に加えて、変更した箇所の実画面確認を行う。
- Worker ルーティングを変更したときは、`pnpm test:worker` と `pnpm typecheck` を実行する。
- `src/sessions/prose/**/*.mdx` は `.astro` から props を受け取らない。`.astro` は `<Prose />` を props なしで描画し、`.mdx` は必要な値を自分で import する。`astro check` は MDX の中身を検査しない。`.mdx` を変更したときは、`pnpm --filter @fp-with-ts/docs test` と `pnpm --filter @fp-with-ts/docs build` に加えて、変更前後の `dist` を `compare-dist` で比べ、差が意図した変更だけであることを確認する。
- MDX 化のように表示を変えない変更では、変更前後の `dist` を `node apps/docs/scripts/compare-dist.mjs <before> <after>` で比べる。
