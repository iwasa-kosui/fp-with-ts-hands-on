# fp-with-ts-hands-on

動物病院の予約・カルテ管理システムを題材に、TypeScriptで関数型ドメインモデリングを学ぶ教材とサンプルコードです。個人学習にも、社内勉強会やコミュニティのハンズオンにも使えます。

[教材サイト](https://fp-with-ts-hands-on.kosui.workers.dev/) から、使い方とセッションを確認できます。TypeScriptの基本文法を読み書きできる方を想定しています。

## はじめる

[事前準備](https://fp-with-ts-hands-on.kosui.workers.dev/setup/) を済ませ、[Session 00](https://fp-with-ts-hands-on.kosui.workers.dev/sessions/00-system-handover/) から進めます。演習や振り返りの手順は、各セッションで説明します。ハンズオンの進行役向けには [ファシリテーターガイド](docs/event/facilitator-guide.md) があります。

2026年8月30日の第1回と2026年11月7日の第2回は終了しました。教材は引き続き公開しています。

## セットアップ

この節の手順は、演習には要りません。演習は、各 Session の「演習」ページのブラウザ内で行います。手元で教材サイトやデモ画面を動かしたい人だけが、次の任意の手順を実行します。

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
| S3 | `pnpm demo:03` | `pnpm demo:03-solution` |
| S4 | `pnpm demo:04` | `pnpm demo:04-solution` |
| S5 | `pnpm demo:05` | なし |
| S6 | `pnpm demo:06` | `pnpm demo:06-solution` |

コマンドの番号は `examples/session-NN` の番号で、教材ページの番号と一致します。解答のスナップショットは、開始と同じ名前に `-solution` を付けたフォルダです。この README と運営資料の S0〜S6 は、教材ページの S00〜S06 と同じ回を指します。

学習前の確認には [セットアップの詳細](docs/event/participant-setup.md) を使ってください。進行側の準備は [ファシリテーターガイド](docs/event/facilitator-guide.md)、詰まったときの切り分けは [トラブルシューティング](docs/event/troubleshooting.md) にまとめています。

## 演習の構成

公開教材は、現行業務とシステムを読む S0、誤った変更を検出する仕組みを足す S1〜S4、予約キャンセルの業務条件とユースケースを設計する S5、誤った変更を検出する仕組みを足す S6、参照実装を読む Final で構成します。S0 は10分、S1 と S2 は各20分、S3 は35分、S4 は31分、S5 は18分、S6 は36分、Final は10分が目安です。個人学習では時間を区切らず進められます。S5 は業務のコードを編集せず、誤った変更を検出する仕組みを足す回です。

演習は、各 Session の「演習」ページのブラウザ内で行います。手元の `examples/` を編集する必要はありません。S0 の観察対象は `examples/session-00` です。各演習の解答のコードは、開始と同じ名前に `-solution` を付けた `examples/session-NN-solution` にあります。`examples/final` は、各演習の改善を複数集約と SQLite へ広げた参照実装です。

通常テストは、セットアップと各スナップショットが健全であることを確認するために実行します。

```bash
pnpm test
```

各 Session の「演習」ページで、誤った変更の一覧を読み、Linter のルール、型のテスト、テストのどれかを足して、「検出を検証する」を押します。必須の誤った変更がすべて「検出」で、正しいコードがすべて「誤検知なし」で、表の下に「問題」が出ていないときに合格です。必要なものは、デスクトップ版の Chrome または Edge です。作業内容は、そのブラウザに保存されます。詰まったときは、ページの「解答の例を見る」を開きます。S0 と Final に合否の判定はありません。

## 第2回までの版と番号の振り直し

第2回の後で、`examples/session-NN` の番号を教材ページの番号にそろえました。CLI で実行する旧演習のコマンドは削除しました。第2回までのコードは、[コミット d6f13e3](https://github.com/iwasa-kosui/fp-with-ts-hands-on/tree/d6f13e3d34cf0666ea3be3fe611a62bc84cbaf84) で見られます。これから新しく clone する人は、この節の手順を実行する必要はありません。

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
4. S3 で値の制約を型で表し、外部入力を Zod で検証して型付きの入力オブジェクトへ変換する。AppointmentId と VeterinarianId を Branded Type で区別する話は、事前知識の `branded` のページで読む
5. S4 で失敗理由を同期 Result の型付きの値として返し、呼び出し側へ運ぶ
6. S5 で予約のデータから始め、キャンセルを工程に分け、ROP（Railway Oriented Programming）とI/Oの分離を学び、業務のコードを編集せず、誤った変更を検出する仕組みを足す
7. S6 で時刻・ID・Storeを外から渡し、状態とイベントを一緒に記録する
8. S1〜S4 と S6 の各演習で、隣の人のブラウザの前に移り、相手の仕組みで検出されない誤った変更を作る。「検出を検証する」でその行が「未検出」になれば成功で、何を変えたのか、何を足せば検出できるかを話す。S5 と Final に相互レビューはありません
9. Final は環境構築や DB 操作をせず、ページの案内に沿って参照実装の5つの境界を読む。そのあと、all-rules、own-rule-review、next-mechanism のページで、参加者が判断する
