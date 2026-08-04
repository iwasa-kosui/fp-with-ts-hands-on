# トラブルシューティング

エラーの全文、実行したコマンド、`node --version` と `pnpm --version` の結果をそろえると、原因を早く切り分けられます。

## `pnpm: command not found`

pnpm がインストールされていないか、実行ファイルの場所が PATH に含まれていません。Node.js 20 以降を確認してから、次のコマンドで pnpm を有効にしてください。

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm --version
```

会社の端末などで Corepack を使えない場合は、端末の管理者に pnpm の導入を依頼してください。

## Node.js version too old

`node --version` が `v20` 未満の場合は、Node.js 20 以上へ更新してください。更新後にターミナルを開き直し、次を確認します。

```bash
node --version
pnpm --version
```

Node.js の切り替えツールを使っている場合は、今回のリポジトリで Node.js 20 以上が選ばれていることを確認してください。

## install fails

まずリポジトリのルートで実行していることと、ネットワークに接続できることを確認します。

```bash
pwd
git status
pnpm install
```

依存関係の取得が途中で止まる場合は、社内プロキシやパッケージレジストリの設定を確認してください。エラーに権限や証明書の問題が含まれる場合は、端末の管理者へ相談してください。

## tests fail before edits

編集前の `pnpm test` はセットアップ確認用のテストなので、失敗した場合はコードを変更せずに原因を確認します。

```bash
pnpm test
```

次を順に確認してください。

1. `pnpm install` が成功していること
2. リポジトリのルートでコマンドを実行していること
3. Node.js が 20 以上であること
4. テスト出力に、既存の実装ではなく環境エラーが出ていないこと

環境を確認しても失敗する場合は、出力を保存して講師に共有してください。module 開始後の赤いテストは意図的なものがあるため、`exercise:*` の失敗と区別します。

## port already in use

`pnpm dev` でポートが使用中と表示された場合は、別の開発サーバーを終了するか、表示されたポートを使ってください。

起動中のターミナルが分かる場合は、そのターミナルで `Ctrl+C` を押します。分からない場合は、まず別のポートを指定して起動します。

```bash
pnpm dev -- --port 5174
```

ターミナルに表示された localhost の URL をブラウザで開いてください。
