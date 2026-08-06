# fp-with-ts-hands-on

関数型ドメインモデリングハンズオン with TypeScript の example とドキュメントサイトです。

## セットアップ

```bash
pnpm install
pnpm test
pnpm dev
```

`pnpm dev` のあと、表示された localhost URL を開いてください。

当日前の確認には [参加者向けセットアップ](docs/event/participant-setup.md) を使ってください。進行側の準備は [ファシリテーターガイド](docs/event/facilitator-guide.md)、詰まったときの切り分けは [トラブルシューティング](docs/event/troubleshooting.md) にまとめています。

## 演習の構成

各セッションは `examples/session-00` から `examples/session-05` に分かれています。前のセッションで扱った改善を引き継ぎながら、次の業務上の問題を扱います。`examples/final` には、全セッションの改善を統合した完成例があります。

通常テストは、セットアップと各スナップショットが健全であることを確認するために実行します。

```bash
pnpm test
```

演習テストは、各セッションで扱う問題を再現するためのものです。セッション 00 は、次のコマンドから始めて意図した失敗を確認してください。

```bash
pnpm exercise:00
```

セッション 01 から 05 では、対応する `pnpm exercise:01` から `pnpm exercise:05` を実行します。開始時は演習対象の source file が意図的にないため、assertion の前に import error で失敗します。これは想定どおりの開始状態です。サイトの手順に沿って file を作成・実装してから、同じ `pnpm exercise:NN` をもう一度実行し、演習の assertion を確認してください。

## 当日の流れ

1. 壊れやすい動物病院アプリを読む
2. 事故テストを赤くして不変条件を確認する
3. Discriminated Union で状態遷移を閉じる
4. 新たに発覚した外部入力事故と PII ログ漏えいを、Zod と Branded Type で守る
5. 失敗理由を Result 型で返し、成功した状態変更をドメインイベントとして記録する
6. AI エージェントに次の追加要求を頼む前提でレビューする
7. 電話フォロー対象のミニ総合演習で、既存設計を横断して使う
