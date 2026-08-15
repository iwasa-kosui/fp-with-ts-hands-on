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

公開教材は、事故と配布コードを読む S0、手を動かす S1〜S4、5分間の講師ツアー Final で構成します。各開始スナップショットは `examples/session-00` から `examples/session-04` にあり、前の回の改善を引き継ぎます。

`examples/session-05` は S1〜S4 の全解答と全回帰テストが GREEN になった到達点スナップショットです。公開セッションではなく、S4 の解答と回帰確認に使います。`examples/final` は、当日の局所的な改善を複数集約と SQLite へ広げた参照実装です。

通常テストは、セットアップと各スナップショットが健全であることを確認するために実行します。

```bash
pnpm test
```

演習テストは、S1〜S4 で扱う業務事故を再現します。

```bash
pnpm exercise:01
pnpm exercise:02
pnpm exercise:03
pnpm exercise:04
```

開始時の RED は、module-not-found や import error ではなく、業務語彙を含む assertion failure です。サイトの手順に沿って既存モジュールを小さく改善し、同じ `pnpm exercise:NN` をもう一度実行して GREEN を確認します。S0 と `session-05` に exercise command はありません。各演習の最後には、班で不変条件と差分を照らす相互レビューを行います。

## 当日の流れ

1. 壊れやすい動物病院アプリを読む
2. 事故テストを赤くして不変条件を確認する
3. Discriminated Union で状態遷移を閉じる
4. 新たに発覚した外部入力事故と PII ログ漏えいを、Zod と Branded Type で守る
5. 失敗理由を同期 Result の型付きの値として返し、呼び出し側へ運ぶ
6. 時刻・ID・永続化を外から渡し、状態とイベントを1回の保存へまとめる
7. 各演習で班内相互レビューを行い、型で守れなかった残りを持ち帰る
8. Final は環境構築や DB 操作をせず、講師が参照実装の3差分を案内する
