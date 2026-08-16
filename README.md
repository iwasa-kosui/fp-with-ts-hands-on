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

公開教材は、現行業務とシステムを読む S0、診察開始のワークフローを描く S1、コードを改善する S2〜S5、講師ツアーの Final で構成します。S0 は10分のオリエンテーションです。S1 は15分の班ワークで、紙面またはページ上のワークフロー・カードを作ります。S1 ではコード編集や exercise command を行いません。S2〜S5 は各30分のコード演習で、各starterは業務語彙を含む assertion failure による RED から始まります。Final は5分です。

S0 の観察対象は `examples/session-00`、S1 のカードは `examples/session-01/README.md` にあります。S2〜S5 の開始スナップショットは `examples/session-02`〜`examples/session-05` で、前の回の改善を引き継ぎます。`examples/session-06` は非公開の到達点スナップショットで、S2〜S5 の全解答と全回帰テストが GREEN になった状態です。`examples/final` は、当日の局所的な改善を複数集約と SQLite へ広げた参照実装です。

通常テストは、セットアップと各スナップショットが健全であることを確認するために実行します。

```bash
pnpm test
```

演習テストは、S2〜S5 で扱う業務事故を再現します。公開スクリプトは次の4つだけです。

```bash
pnpm exercise:02
pnpm exercise:03
pnpm exercise:04
pnpm exercise:05
```

開始時の RED は、module-not-found や import error ではありません。サイトの手順に沿って既存モジュールを小さく改善し、同じ `pnpm exercise:NN` をもう一度実行して GREEN を確認します。S0、S1、`session-06`、Final に exercise command はありません。各コード演習の最後には、班で不変条件と差分を照らす相互レビューを行います。

## 当日の流れ

1. S0 で壊れやすい動物病院アプリの現行業務、操作、保存先、ログを読む
2. S1 で trigger、input、current state、expected failures、output event、side effects をワークフロー・カードへ整理する
3. S2 で Discriminated Union を使い、状態遷移を閉じる
4. S3 で外部入力事故と PII ログ漏えいを、Zod と Branded Type で守る
5. S4 で失敗理由を同期 Result の型付きの値として返し、呼び出し側へ運ぶ
6. S5 で時刻・ID・永続化を外から渡し、状態とイベントを1回の保存へまとめる
7. S2〜S5 の各コード演習で班内相互レビューを行い、型で守れなかった残りを持ち帰る
8. Final は環境構築や DB 操作をせず、講師が参照実装の3差分を案内する
