# 公開サイト作業ガイド

## モジュールページの受け入れ条件

`src/pages/modules/*.astro` を変更する場合は、背景、登場人物の要求、出来事、参加者の作業、確認方法、期待する気づきを、ページ単体で理解できる順序で示す。状態モデリングを扱う場合は、業務イベント、遷移前、遷移後、実装する関数を対応させる。

すべての参加者向けページでは自然な日本語を使う。ただし、トップページ、案内ページ、エラーページにこのモジュール構造を強制しない。

## トップページの保護

明示的な依頼がない限り、トップページの見た目、文章、情報量、主要導線を変更しない。

## 変更時に同期する対象

モジュールを変更するときは、`src/modules/catalog.ts`、Astro ページ、ページテスト、静的ビルドで必須とする HTML、内部リンク、必要な Worker ルートを同期する。

## 視覚検証

現行の `test:visual` はトップページだけを対象とする。モジュール UI を変更するときは、対象 URL をモバイル幅とデスクトップ幅の両方で確認するか、視覚テストに対象を追加する。

## 変更範囲別の検証

- ページを変更したときは、`pnpm --filter @fp-with-ts/docs test` と `pnpm --filter @fp-with-ts/docs build` を実行する。
- CSS を変更したときは、`pnpm --filter @fp-with-ts/docs typecheck` を実行し、トップページを変更した場合は `pnpm --filter @fp-with-ts/docs test:visual` も実行する。
- Worker ルーティングを変更したときは、`pnpm --filter @fp-with-ts/docs exec vitest run ../../worker/routes.test.ts` と `pnpm typecheck` を実行する。
