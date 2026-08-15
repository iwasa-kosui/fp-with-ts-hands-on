# トラブルシューティング

エラーの全文、実行したコマンド、`node --version` と `pnpm --version` の結果をそろえると、原因を早く切り分けられます。

## `pnpm: command not found`

Node.js 20以上を確認してから、pnpm 9.12.0を有効にします。

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm --version
```

会社の端末などでCorepackを使えない場合は、端末の管理者にpnpmの導入を依頼してください。

## Node.js version too old

`node --version` が `v20` 未満の場合は、Node.js 20以上へ更新します。切り替え後にターミナルを開き直して確認してください。

```bash
node --version
pnpm --version
```

## install fails

リポジトリのルートとネットワーク接続を確認します。依存関係は会場へ来る前に取得してください。

```bash
pwd
git status
pnpm install
```

権限、証明書、社内プロキシのエラーが含まれる場合は、端末の管理者へ相談してください。

## tests fail before edits

編集前の通常テストは成功するのが正常です。コードを変更せず、次を順に確認します。

```bash
pnpm test
```

1. `pnpm install` が成功している。
2. リポジトリのルートで実行している。
3. Node.jsが20以上である。
4. 出力がコードの assertion ではなく、環境やmodule解決のエラーになっていないか確認する。

解決しなければ出力を保存して講師またはTAへ共有します。

## exercise が赤い

S1〜S4の開始スナップショットは、業務の言葉で命名された assertion failure から始まります。これは意図したREDです。

| セッション | 参加者ステップ | 意図した開始時の見え方 |
| --- | ---: | --- |
| S1 | 4件 | 状態遷移と網羅性の assertion が失敗する |
| S2 | 2件 | 外部JSONとPIIマスクの assertion が失敗する |
| S3 | 3件 | 予約なし、状態不正、同期Result pipeline の assertion が失敗する |
| S4 | 4件 | 決定性、single store、ResultAsync、保存失敗の assertion が失敗する |

module-not-found、import error、設定エラー、予期しない例外は意図したREDではありません。エラーの最初の行だけでなく、`Caused by` とスタックの先頭までTAへ見せてください。

対象モジュールを変更した後は、同じexerciseコマンドが成功することを確認します。S0、到達点 `examples/session-05`、Finalにはexerciseコマンドはありません。

## エージェントがモジュール外を変更した

まず対象を確認します。

```bash
git status --short
git diff --stat -- examples/session-0N
```

`session-0N` は現在のセッションページに表示された開始snapshot（S1なら `session-01`）へ置き換えます。scoped diffは現在の演習だけ、statusはリポジトリ全体の想定外pathを確認するために使います。

自分が残したい変更を消さないよう、戻す前にTAとパスを確認します。追跡済みで、今回不要な変更だけを戻す場合は明示したパスに限定します。

```bash
git restore --source=HEAD -- path/to/file
```

未追跡ファイルは自動で削除せず、リポジトリ外の退避先へ移してから再確認します。ディレクトリ全体や不明なglobを対象にしません。

## Code Explorer または Playground が動かない

「配布コードを読む」の Code Explorer は読み取り用ガイド、「型で閉じる」の Playground は WebContainer 上の編集・実行環境です。専用URLではなく各セッションに埋め込まれています。

1. デスクトップ版ChromeまたはEdgeの現行版で開く。
2. ページを再読み込みする。
3. ブラウザの開発者ツールにSharedArrayBuffer、cross-origin isolation、WebContainerのエラーがないか確認する。
4. 起動や依存取得が止まる場合は、主線であるローカル clone へ戻る。
5. エージェントを使わない場合、S1〜S3はページの「ステップごとの解答」の `details` を1件ずつ開く。S4は「完成ファイルの解答例」の `details` を開き、後続stepを含む完成ファイルを全targetへ反映してから同じexerciseを実行する。1stepずつの個別GREENは約束しない。

Playgroundのために新しいAPIキーを用意する必要はありません。Finalは講師ツアーなのでPlayground操作も不要です。

## 外部ディスプレイへ正しく映らない

会場の外部ディスプレイ、HDMI、USB-C変換アダプタ、電源は未確認です。使える場合だけ接続し、画面はミラーリングにします。拡張表示のまま別画面へウィンドウが残っていないか確認してください。

エディタのフォントを一時的に拡大し、対象の1ファイル・20行以内だけを表示します。利用できない場合は参加者のラップトップを島の中央へ向けます。口頭説明だけで相互レビューを済ませません。

## 開発サーバーのポートが使用中

起動中のサーバーが分かる場合はそのターミナルで `Ctrl+C` を押します。分からない場合は別ポートを指定します。

```bash
pnpm dev -- --port 5174
```

スマホ確認ではサーバーを `0.0.0.0` で待ち受け、実際のポートに対して `mobile-preview-url <port>` を実行します。明示的な依頼がない限り公開トンネルは使いません。

## 相互レビューが時間内に終わらない

レビュー自体と最後のシート記入1分は残します。2人目の比較枠2分を落とし、S1・S2は1名の5分版、S3・S4は1名の6分版へ切り替えます。次の回では未選出者を優先し、4回で全員を最低1回選べるよう記録欄を調整します。
