# 参加者向けセットアップ

イベント当日は、動物病院の予約・カルテ管理システムを題材に TypeScript のコードを変更します。会場ではセットアップに時間を使わないため、依存関係のインストールと通常テストを事前に済ませてください。

## 必要なもの

- Node.js 20以上
- pnpm
- Git
- TypeScript を編集できるエディタ
- デスクトップ版 Chrome または Edge の現行版
- 普段利用しているコーディングエージェント（任意）

データベース、Docker、外部サービスのAPIキーは必要ありません。コーディングエージェントも必須ではなく、このリポジトリのために新しいAPIキーを発行する必要はありません。

## バージョンの確認

ターミナルで次を実行します。

```bash
node --version
pnpm --version
git --version
```

Node.js は `v20` 以上であることを確認してください。pnpm と Git はバージョン番号が表示されれば準備できています。

## リポジトリの取得

作業する場所でリポジトリを clone します。

```bash
git clone https://github.com/iwasa-kosui/fp-with-ts-hands-on.git
cd fp-with-ts-hands-on
```

すでに clone 済みの場合は、そのリポジトリのディレクトリで作業します。当日の主な作業場所はこのローカル clone です。

## 事前に済ませること

依存関係をインストールし、通常テストを実行します。

```bash
pnpm install
pnpm test
```

編集前の `pnpm test` は成功するのが正常です。失敗した場合は、当日までに [トラブルシューティング](./troubleshooting.md) の「tests fail before edits」を確認してください。

教材サイトも事前に表示できます。

```bash
pnpm dev
```

ターミナルに表示された localhost のURLを Chrome または Edge で開きます。開発サーバーを終了するときは `Ctrl+C` を押します。

セッションのデモアプリも事前に確認できます。`NN` を `00` から `07` のセッション番号へ置き換えてください。

```bash
pnpm demo:NN
```

デモはすべて `http://localhost:3000` を使うため、一度に一つだけ起動します。別セッションへ切り替えるときは `Ctrl+C` で終了してから次を起動します。画面の「デモを初期状態へ戻す」で初期予約へ戻せます。未実装操作は500にならず、「この機能は未実装です」というダイアログになります。

## 当日の演習コマンド

コードを編集する演習は S2〜S6 の5本です。S1 は散文からドメインイベントを拾い、Excalidraw 上で集約を班で見つける回です。コマンドは実行しません。

| セッション | コマンド |
| --- | --- |
| S2 | `pnpm exercise:02` |
| S3 | `pnpm exercise:03` |
| S4 | `pnpm exercise:04` |
| S5 | `pnpm exercise:05` |
| S6 | `pnpm exercise:06` |

4本を続けて確認したい場合は、次を順に実行します。

```bash
pnpm exercise:02
pnpm exercise:03
pnpm exercise:04
pnpm exercise:05
pnpm exercise:06
```

各コマンドは、そのセッションの開始時には業務上の未解決条件を示す assertion failure になるよう作られています。環境エラーではありません。対象モジュールを変更したあと、同じコマンドを再実行して成功を確認します。

S0 は現状の業務・操作・保存先・ログを読む回、S1 は Excalidraw を使う班ワークなので演習コマンドはありません。`examples/session-07` は全解答と回帰テストを持つ到達点です。Final は講師が参照実装を案内する5分のツアーで、参加者が `examples/final` をセットアップしたり編集したりする必要はありません。

## 差分の確認と次のセッションへの進み方

レビューする差分は、その回の開始snapshotだけに限定します。

| セッション | 差分確認 |
| --- | --- |
| S2 | `git diff --stat -- examples/session-02` |
| S3 | `git diff --stat -- examples/session-03` |
| S4 | `git diff --stat -- examples/session-04` |
| S5 | `git diff --stat -- examples/session-05` |
| S6 | `git diff --stat -- examples/session-06` |

各回で `git status --short` も実行し、表のpath以外に意図しない変更がないか確認します。前のセッションの未commit差分は次の回の差分確認に含まれません。

相互レビューとシート記入が終わったら、変更はそのまま残し、次のセッションページとexerciseコマンドを開いて、表の差分確認pathだけを切り替えます。前のセッションの未commit差分を消すための reset、stash、commit は必要ありません。作業を失わないよう、TAの確認なしに変更を戻したり未追跡ファイルを削除したりしないでください。

## エージェントを使わない場合

S2〜S6 の各演習ページには、次スナップショットの実ソースから切り出したステップごとの解答があります。S6 は import や後続stepを含む完成ファイルを全target分表示します。S6では1stepずつ反映して個別にGREENになるとは限らないため、表示された全target fileを反映した後、同じ `pnpm exercise:06` で確認してください。

ページの「配布コードを読む」では読み取り用の Code Explorer、「型で閉じる」では編集・実行できる WebContainer Playground を利用できます。Playground は説明用・環境トラブル時の退避先であり、ローカル clone が主線です。

## 班内相互レビューについて

S2〜S6 の各演習後に、班で5回の相互レビューを行います。TA が毎回1〜2名の差分を選び、そのセッションの具体的な問いに沿って設計判断を比べます。5回を通して班の全員が最低1回は選ばれるように配分します。

TAは、同じ課題に対して設計判断が異なる差分を選びます。完成度や技能による選出ではありません。本人が説明するのはAgentへの依頼文だけです。自分の差分が選ばれなかった回も、最後の1分で [レビュー観点シート](./review-sheet.md) を記入します。

## うまく進まないとき

[トラブルシューティング](./troubleshooting.md)を確認し、エラーの全文、実行したコマンド、`node --version` と `pnpm --version` の結果を講師またはTAへ見せてください。
