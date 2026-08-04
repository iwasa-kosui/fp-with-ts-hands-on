# 参加者向けセットアップ

イベント当日は、動物病院の予約・カルテ管理システムを題材に TypeScript のコードを変更します。開始前に、次の環境を用意してください。

## 必要なもの

- Node.js 20 以上
- pnpm
- Git
- TypeScript を編集できるエディタ

データベース、Docker、外部サービスの API キーは必要ありません。

## バージョンの確認

ターミナルで次を実行してください。

```bash
node --version
pnpm --version
git --version
```

Node.js は `v20` 以上であることを確認してください。pnpm と Git はバージョン番号が表示されれば準備できています。

## リポジトリの取得

作業する場所で、リポジトリを clone します。

```bash
git clone https://github.com/iwasa-kosui/fp-with-ts-hands-on.git
cd fp-with-ts-hands-on
```

すでに clone 済みの場合は、リポジトリのディレクトリで作業してください。

## 依存関係とテストの確認

依存関係をインストールし、セットアップ確認用のテストを実行します。

```bash
pnpm install
pnpm test
```

`pnpm test` が成功したら、教材を表示する開発サーバーを起動します。

```bash
pnpm dev
```

ターミナルに表示された localhost の URL をブラウザで開いてください。開発サーバーを終了するときは、起動したターミナルで `Ctrl+C` を押します。

## うまく進まないとき

エラーが出た場合は、[トラブルシューティング](./troubleshooting.md)を確認してください。当日は、エラーの全文と実行したコマンドを講師に見せてください。
