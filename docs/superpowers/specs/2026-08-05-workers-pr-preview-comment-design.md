# Workers PR プレビュー URL コメント 設計

## 目的

PR のプレビュー Worker がデプロイされた後に、その Workers URL を PR へ投稿する。以後の PR 更新では同じコメントを更新し、最新のプレビュー URL だけを表示する。

## URL の取得

deploy job の Wrangler 実行結果を標準出力・標準エラーの両方から job log へ記録したうえで、`https://` で始まり `.workers.dev` で終わる URL を抽出する。パイプラインの失敗を維持するために `pipefail` を有効にし、抽出した URL を `GITHUB_OUTPUT` の `preview_url` として次のステップへ渡す。

URL を抽出できない場合は deploy job を失敗として終了し、URL を含まないコメントは投稿しない。Worker 名と Cloudflare アカウントの workers.dev サブドメインをリポジトリ設定へ重複して持たず、Wrangler が実際にデプロイした URL を唯一の情報源にする。

## 固定コメント

URL 取得後に `actions/github-script@v7` を実行する。コメント本文には機械識別用の `<!-- workers-pr-preview -->` を含める。

1. 現在の PR のコメントを取得する。
2. GitHub Actions bot が投稿した、識別子を含むコメントがあれば URL を含む本文に更新する。
3. 該当コメントがなければ、新しく投稿する。

コメント本文はプレビュー URL への Markdown リンクだけを示し、PR タイトル・本文・ブランチ名などの外部入力をスクリプトや API 引数へ流さない。

## 権限と実行条件

deploy job にだけ `contents: read` と `issues: write` を設定する。`issues: write` は PR の会話コメントを作成・更新するために必要である。cleanup job は既存どおり `contents: read` のみを使う。

コメント処理は既存の deploy job の末尾に置く。そのため、同一リポジトリ PR かつ `opened`、`reopened`、`synchronize` の成功したデプロイでのみ実行される。外部フォークと `closed` イベントはコメント処理を実行しない。

## エラー処理と検証

Wrangler デプロイ、URL 抽出、コメント更新のいずれかが失敗した場合、ジョブを失敗として可視化する。Worker を削除する cleanup job は変更しない。

ローカルでは workflow に必要なイベント・権限・URL 抽出・固定コメントの要件を静的に検証し、YAML 構文、型検査、テスト、ビルド、Wrangler dry-run を実行する。実際のコメント更新は、同一リポジトリの PR を更新して GitHub Actions で確認する。
