# fp-with-ts-hands-on

動物病院の予約・カルテ管理システムを題材に、TypeScriptで関数型ドメインモデリングを学ぶ教材とサンプルコードです。個人学習にも、社内勉強会やコミュニティのハンズオンにも使えます。

[教材サイト](https://fp-with-ts-hands-on.kosui.workers.dev/) から、使い方とセッションを確認できます。TypeScriptの基本文法を読み書きできる方を想定しています。

## はじめる

[事前準備](https://fp-with-ts-hands-on.kosui.workers.dev/setup/) を済ませ、[Session 00](https://fp-with-ts-hands-on.kosui.workers.dev/sessions/00-system-handover/) から進めます。演習や振り返りの手順は、各セッションで説明します。ハンズオンの進行役向けには [ファシリテーターガイド](docs/event/facilitator-guide.md) があります。

2026年8月30日の第1回は終了しました。第2回は2026年11月7日に開催します。教材は引き続き公開しています。

## セットアップ

Node.js 20以上、pnpm 9.12.0、Gitを用意し、リポジトリルートで次を実行します。

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm dev
```

`pnpm dev` は教材サイトを起動します。表示された localhost URL を開いてください。

各セッションのサーバーサイドアプリケーションは、別のターミナルで次の表のデモコマンドのいずれかを実行すると起動します。すべて同じ `http://localhost:3000` を使うため、一度に一つだけ起動してください。画面の「デモを初期状態へ戻す」で同じ予約済みfixtureへ戻せます。未実装の「電話フォローを依頼する」を選ぶと、トップページへ戻り「この機能は未実装です」と表示します。

| セッション | 開始のデモコマンド | 解答のデモコマンド |
| --- | --- | --- |
| S0 | `pnpm demo:00` | なし |
| S1 | `pnpm demo:01` | `pnpm demo:01-solution` |
| S2 | `pnpm demo:02` | `pnpm demo:02-solution` |
| S3 補助演習 | `pnpm demo:03-supplement` | `pnpm demo:03-supplement-solution` |
| S3 | `pnpm demo:03` | `pnpm demo:03-solution` |
| S4 | `pnpm demo:04` | `pnpm demo:04-solution` |
| S5 | `pnpm demo:05` | なし |
| S6 | `pnpm demo:06` | `pnpm demo:06-solution` |

コマンドの番号は `examples/session-NN` の番号で、教材ページの番号と一致します。解答のスナップショットは、開始と同じ名前に `-solution` を付けたフォルダです。この README と運営資料の S0〜S6 は、教材ページの S00〜S06 と同じ回を指します。

学習前の確認には [セットアップの詳細](docs/event/participant-setup.md) を使ってください。進行側の準備は [ファシリテーターガイド](docs/event/facilitator-guide.md)、詰まったときの切り分けは [トラブルシューティング](docs/event/troubleshooting.md) にまとめています。

## 演習の構成

公開教材は、現行業務とシステムを読む S0、コードを改善する S1〜S4、予約キャンセルの業務条件とユースケースを設計する S5、コードを改善する S6、参照実装を読む Final で構成します。S0 は10分、S1 と S2 は各20分、S3 は35分、S4 は31分、S5 は18分、S6 は36分、Final は10分が目安です。個人学習では時間を区切らず進められます。S5 は業務のコードを編集せず、悪い変更を検出する仕組みを足す回で、演習コマンドの実行は行いません。S1〜S4 と S6 の開始コードは、業務上の問題を示す assertion failure による RED から始まります。

S0 の観察対象は `examples/session-00` です。S1 は `examples/session-01`、S2 は `examples/session-02` を使います。S3 は `examples/session-03` を使い、補助演習で `examples/session-03-supplement` を使います。S4 は `examples/session-04`、S6 は `examples/session-06` を使います。S5 のカードは `examples/session-05/README.md` にあります。各演習の解答は、開始と同じ名前に `-solution` を付けた `examples/session-NN-solution` にあります。どの開始スナップショットも、前のコード演習の解答を取り込み済みです。自分の変更を次のディレクトリへコピーする必要はありません。`examples/session-06-solution` は S6 の解答であり、S1〜S4 と S6 の全解答と全回帰テストが GREEN になった到達点も兼ねます。`examples/final` は、各演習の改善を複数集約と SQLite へ広げた参照実装です。

通常テストは、セットアップと各スナップショットが健全であることを確認するために実行します。

```bash
pnpm test
```

演習テストは、S1〜S3 と S6 で扱う業務事故を再現します。演習で使うコマンドは次の5つだけです。

```bash
pnpm exercise:01
pnpm exercise:02
pnpm exercise:03-supplement
pnpm exercise:03
pnpm exercise:06
```

S1 は `pnpm exercise:01`、S2 は `pnpm exercise:02` を使います。S3 の補助演習は `pnpm exercise:03-supplement`、S3 の本演習は `pnpm exercise:03` を使います。S6 は `pnpm exercise:06` を使います。S4 の演習は、ブラウザの演習の画面で、悪い変更を検出する仕組みを足します。`pnpm exercise:04` は以前の演習のコマンドで、この回では使いません。

開始時の RED は、module-not-found や import error ではありません。サイトの手順に沿って既存モジュールを小さく改善し、S4 を除き、開始時と同じ exercise コマンドをもう一度実行して GREEN を確認します。S0、S5、解答のスナップショット、Final に exercise command はありません。各コード演習の最後には、その回で防ぐ問題と差分を照らして振り返ります。複数人の場合は相互レビューを行います。

## 第2回までの版と番号の振り直し

第2回の後で、`examples/session-NN` と `pnpm exercise:NN` の番号を教材ページの番号にそろえました。第2回までのコードは、[コミット d6f13e3](https://github.com/iwasa-kosui/fp-with-ts-hands-on/tree/d6f13e3d34cf0666ea3be3fe611a62bc84cbaf84) で見られます。これから新しく clone する人は、この節の手順を実行する必要はありません。

### clone 済みで `examples/` を編集した人が pull するとき

フォルダの番号が変わったので、`examples/` に編集が残っていると `git pull` が止まるか、競合します。次の手順で編集を別のブランチに残してから、最新の `main` へ移ってください。

1. `git pull` が競合で止まっているときは、merge を取り消します。競合が出ていないときは、この手順を飛ばします。

   ```sh
   git merge --abort
   ```

2. すべての編集を別のブランチに保存します。

   ```sh
   git switch -c my-session-work
   git add -A
   git commit -m "第2回までの演習の編集"
   ```

3. `main` を最新の状態に合わせて、依存を入れ直します。`git reset --hard` は `main` の手元の変更を消します。手順2の保存が終わってから実行してください。

   ```sh
   git switch main
   git fetch origin
   git reset --hard origin/main
   pnpm install
   ```

`pnpm demo:NN` がデータベースの列の不一致で失敗するときは、そのフォルダの古いデモ用データベースだけを消してから、もう一度実行してください。`NN` は失敗したデモの番号に置き換えます。

```sh
rm examples/session-NN/clinic.sqlite*
```

保存した編集は、`git switch my-session-work` で見られます。このブランチのフォルダは旧番号のままです。新しい番号で解き直すときは、`main` の `examples/session-NN`（NN は教材ページの番号）を使ってください。

## 学習の流れ

1. S0 で壊れやすい動物病院アプリの現行業務、操作、保存先、ログを読む
2. S1 で Discriminated Union を使い、状態遷移を閉じる。予約の状態は、予約済み、来院済み、診察中、会計待ち、会計済み、キャンセルの6つです
3. S2 で never 型と `assertNever` を使い、状態を追加したときの分岐漏れをコンパイルエラーにする
4. S3 で値の制約を型で表し、外部入力を Zod で検証して型付きの入力オブジェクトへ変換する。補助演習で AppointmentId と VeterinarianId を Branded Type で区別する
5. S4 で失敗理由を同期 Result の型付きの値として返し、呼び出し側へ運ぶ
6. S5 で予約のデータから始め、キャンセルを工程に分け、ROP（Railway Oriented Programming）とI/Oの分離を学び、業務のコードを編集せず、悪い変更を検出する仕組みを足す
7. S6 で時刻・ID・Storeを外から渡し、状態とイベントを一緒に記録する
8. S1〜S4 と S6 の各コード演習で、自分の差分を振り返るか相互レビューを行い、型検査では確認できない点を記録する
9. Final は環境構築や DB 操作をせず、ページの案内に沿って参照実装の5つの境界を読む
