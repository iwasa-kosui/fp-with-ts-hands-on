# Workers PR プレビュー環境 設計

## 目的

同一リポジトリから作成された Pull Request ごとに、レビュー可能な Cloudflare Workers 環境を作成する。PR の更新では同じ環境を更新し、PR をクローズまたはマージしたときには環境と配下の Worker バージョンを削除する。

## 採用する方式

PR ごとに本番 Worker とは別の Worker を作成する。名前は `fp-with-ts-hands-on-pr-<PR番号>` とする。

Workers の単一 Worker 内にプレビュー用バージョンやエイリアスを残す方式ではなく、PR 専用 Worker を削除する。これにより、クリーンアップ対象が PR 番号から一意に決まり、クローズ時に関連するすべてのバージョンをまとめて削除できる。本番 Worker `fp-with-ts-hands-on` とそのデプロイワークフローには影響しない。

## ワークフロー

`.github/workflows/preview.yml` を追加し、`pull_request` イベントの `opened`、`reopened`、`synchronize`、`closed` を受け取る。

### 作成と更新

`opened`、`reopened`、`synchronize` では、次をこの順に実行する。

1. PR のコードをチェックアウトする。
2. pnpm 9.12.0 と Node.js 24 をセットアップし、`pnpm install --frozen-lockfile` を実行する。
3. `pnpm typecheck`、`pnpm test`、`pnpm build` を実行する。
4. `pnpm exec wrangler deploy --name "fp-with-ts-hands-on-pr-<PR番号>"` を実行する。

同じ PR 番号を concurrency group に使い、新しい更新やクローズ処理が始まったときには進行中の古いジョブをキャンセルする。これにより、古いコミットのデプロイが新しい環境を上書きすることを防ぐ。

### クリーンアップ

`closed` では、PR がマージされたか手動でクローズされたかを問わず、`pnpm exec wrangler delete "fp-with-ts-hands-on-pr-<PR番号>" --force` を実行する。存在しない Worker を削除しようとした場合は、原因を明瞭に残すためジョブを失敗として扱う。

この削除は PR 専用 Worker だけを対象にする。本番 Worker 名は固定であり、プレビュー Worker の命名規則と一致しないため、クリーンアップから除外される。

## セキュリティと権限

デプロイおよび削除ジョブは、`github.event.pull_request.head.repo.full_name == github.repository` の場合だけ実行する。外部フォークの PR には `CLOUDFLARE_API_TOKEN` を渡さず、プレビュー環境も作成しない。

既存の GitHub Actions secret `CLOUDFLARE_API_TOKEN` を使う。トークンには対象アカウントの `Workers Scripts: Write` 権限が必要である。ワークフローの GitHub 権限は `contents: read` のみとする。

## エラー処理

型検査、テスト、ビルド、デプロイのいずれかが失敗した場合、プレビュー Worker は更新しない。削除ジョブは `--force` で対話を要求せず、PR のクローズ操作をブロックしない。失敗は GitHub Actions 上で可視化し、権限不足、トークンの無効化、または Cloudflare 側の一時障害を判断できるようにする。

## 検証

ワークフローに含める `pnpm typecheck`、`pnpm test`、`pnpm build` をローカルで実行し、既存の品質ゲートが PR デプロイ前に動くことを確認する。GitHub Actions の YAML は静的に検査し、同一リポジトリ PR のオープン／更新／クローズに対する各ジョブの条件と Wrangler コマンドを確認する。

実際の Cloudflare への作成・削除は、PR を用いた GitHub Actions 実行でのみ検証する。ローカル環境では `CLOUDFLARE_API_TOKEN` を使用しない。
