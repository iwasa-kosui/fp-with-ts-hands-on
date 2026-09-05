# fp-with-ts-hands-on

動物病院の予約・カルテ管理システムを題材に、TypeScriptで関数型ドメインモデリングを学ぶ教材とサンプルコードです。個人学習にも、社内勉強会やコミュニティのハンズオンにも使えます。

[教材サイト](https://fp-with-ts-hands-on.kosui.workers.dev/) から、使い方とセッションを確認できます。TypeScriptの基本文法を読み書きできる方を想定しています。

## 学び方を選ぶ

- **ひとりで学ぶ**: [事前準備と個人学習の進め方](https://fp-with-ts-hands-on.kosui.workers.dev/setup/#self-study) を確認し、Session 00から順番に進めます。班ワークは自分の考えを図やメモに残し、相互レビューはページの問いと解答例を使って自分の差分を振り返ります。1回ずつ分けて取り組めます。
- **ハンズオンで使う**: [ハンズオンの進め方](https://fp-with-ts-hands-on.kosui.workers.dev/setup/#workshop) を確認し、開催時間に合わせて扱うセッションを決めます。全体の目安は学習180分と休憩30分です。進行の詳細は [ファシリテーターガイド](docs/event/facilitator-guide.md) を使ってください。

Discordへの参加やコーディングエージェントの利用は、教材を使うための必須条件ではありません。2026年8月30日のイベントは終了していますが、教材は引き続き公開しています。

## セットアップ

Node.js 20以上、pnpm 9.12.0、Gitを用意し、リポジトリルートで次を実行します。

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm dev
```

`pnpm dev` は教材サイトを起動します。表示された localhost URL を開いてください。

各セッションのサーバーサイドアプリケーションは、別のターミナルで `pnpm demo:00` から `pnpm demo:07` のいずれかを実行すると起動します。すべて同じ `http://localhost:3000` を使うため、一度に一つだけ起動してください。画面の「デモを初期状態へ戻す」で同じ予約済みfixtureへ戻せます。未実装の「電話フォローを依頼する」を選ぶと、トップページへ戻り「この機能は未実装です」と表示します。

| セッション | デモコマンド |
| --- | --- |
| S0 | `pnpm demo:00` |
| S1 | `pnpm demo:01` |
| S2 | `pnpm demo:02` |
| S3 | `pnpm demo:03` |
| S4 | `pnpm demo:04` |
| S5 | `pnpm demo:05` |
| S6 | `pnpm demo:06` |
| S7 | `pnpm demo:07` |

学習前の確認には [セットアップの詳細](docs/event/participant-setup.md) を使ってください。進行側の準備は [ファシリテーターガイド](docs/event/facilitator-guide.md)、詰まったときの切り分けは [トラブルシューティング](docs/event/troubleshooting.md) にまとめています。

## 演習の構成

公開教材は、現行業務とシステムを読む S0、予約キャンセルの業務条件とユースケースを設計する S1、コードを改善する S2〜S6、参照実装を読む Final で構成します。S0 は10分、S1 は15分、S2〜S6 は各30分、Final は5分が目安です。個人学習では時間を区切らず進められます。S1 はExcalidrawで考えを整理する回で、コード編集や演習コマンドの実行は行いません。S2〜S6の開始コードは、業務上の問題を示す assertion failure による RED から始まります。

S0 の観察対象は `examples/session-00`、S1 のカードは `examples/session-01/README.md` にあります。S2〜S6 の開始スナップショットは `examples/session-02`〜`examples/session-06` で、前の回の改善を取り込み済みです。自分の変更を次のディレクトリへコピーする必要はありません。`examples/session-07` は独立した公開セッションを持たない到達点スナップショットで、S2〜S6 の全解答と全回帰テストが GREEN になった状態です。`examples/final` は、各演習の改善を複数集約と SQLite へ広げた参照実装です。

通常テストは、セットアップと各スナップショットが健全であることを確認するために実行します。

```bash
pnpm test
```

演習テストは、S2〜S6 で扱う業務事故を再現します。公開スクリプトは次の5つだけです。

```bash
pnpm exercise:02
pnpm exercise:03
pnpm exercise:04
pnpm exercise:05
pnpm exercise:06
```

開始時の RED は、module-not-found や import error ではありません。サイトの手順に沿って既存モジュールを小さく改善し、同じ `pnpm exercise:NN` をもう一度実行して GREEN を確認します。S0、S1、`session-07`、Final に exercise command はありません。各コード演習の最後には、その回で防ぐ問題と差分を照らして振り返ります。複数人の場合は相互レビューを行います。

## 学習の流れ

1. S0 で壊れやすい動物病院アプリの現行業務、操作、保存先、ログを読む
2. S1 で「予約がキャンセルされた」からアクター、コマンド、確認する条件を逆算し、集約とユースケースをExcalidrawで整理する
3. S2 で Discriminated Union を使い、状態遷移を閉じる
4. S3 で AppointmentId と VeterinarianId を Branded Type で区別する
5. S4 で外部入力を Zod で検証し、型付きの入力オブジェクトへ変換する
6. S5 で失敗理由を同期 Result の型付きの値として返し、呼び出し側へ運ぶ
7. S6 で時刻・ID・Storeを外から渡し、状態とイベントを一緒に記録する
8. S2〜S6 の各コード演習で、自分の差分を振り返るか相互レビューを行い、型検査では確認できない点を記録する
9. Final は環境構築や DB 操作をせず、ページの案内に沿って参照実装の5つの境界を読む
