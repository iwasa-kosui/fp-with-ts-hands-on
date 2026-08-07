# 各セッションへの Code Playground 導入設計

## 背景

`apps/docs` には、Monaco Editor と WebContainers を使って教材コードを編集・実行できる `Code Explorer` がすでにある。しかし現在は Session 00 の snapshot を使う `/code-explorer/` の実験用プレビューページに限定され、各セッション本文からは利用できない。

参加者は本文で事故・要求、失敗するテスト、読むべきファイルを確認してから、別のページまたはローカル環境へ移動してコードを試す必要がある。この往復を減らし、各セッションの開始 snapshot を本文の流れで編集・実行できるようにする。

## 目的

- 8つのセッションページすべてで、そのページに対応する開始 snapshot をブラウザ内で閲覧、編集、実行できるようにする。
- 「事故・要求 → テスト → 読む対象 → 編集・実行」という教材の順序を保つ。
- 既存の WebContainer runner、session workspace、通常の `pnpm` 手順を再利用し、教材コードと実行ロジックを複製しない。
- 実験用の `/code-explorer/` ページを維持する。

## 対象外

- 編集内容の永続化、共有、Git commit、サーバーへの送信
- 任意のシェルコマンドや複数ファイルの一括実行
- 教材の domain コード、exercise、通常テスト、各セッションの学習内容の変更
- Safari と Firefox の WebContainer 対応

## 採用する構成

各セッションページが共通の `SessionCodePlayground` Astro コンポーネントを個別に配置する。共通レイアウトからの自動表示にはしない。これにより、各ページの既存の導入、失敗再現、読むべきファイルという学習構造に合わせて Playground の位置を明示できる。

```text
apps/docs/src/pages/sessions/*.astro
  ├── 課題・失敗・読むべきファイル
  └── SessionCodePlayground (ページごとに配置)
        ├── sessionWorkspaceFor(slug)
        ├── projectFilesFor(slug)
        └── CodeExplorer (React island, client:load)
```

### `SessionCodePlayground.astro`

コンポーネントはセッションの slug を受け取り、既存の `sessionWorkspaceFor` と `projectFilesFor` から対応する workspace と教材ファイルを作る。見出し、短い操作説明、ブラウザ要件の案内、`data-code-explorer` を含む実行領域を一つにまとめる。

`CodeExplorer` の状態管理、Monaco、WebContainer、ファイルツリー、実行結果の責務は変更しない。未知の slug や不足ファイルは既存の workspace 検証に従って、ビルドまたはテストで検出する。

### ページごとの配置

各ページの本文では、RED の失敗と「先に読むファイル」を示した後に、`<h2 id="code-playground">ブラウザで試す</h2>` を置いて Playground を挿入する。目次にも同じ項目へのリンクを追加する。

これにより、参加者はコードを先に見てしまわず、業務上の問題と検証対象を把握してから実行環境へ進む。`final` ページでは完成例の検証の直前に置き、完成した設計要素をその場で確認できるようにする。

### スタイル

既存の `code-explorer-preview.css` にある実行環境のスタイルを、セッション内で使える再利用可能なセレクターへ切り出す。セッションページではケースファイルの配色、枠線、フォーカス表示を引き継ぎ、デスクトップではファイルツリーとエディタを2列、狭い画面では縦1列にする。

実験用プレビューのヘッダーと導入文のスタイルはそのまま残す。共通の実行環境スタイルを移しても `/code-explorer/` の見た目と操作を変えない。

## データフローと実行時の振る舞い

1. Astro がページの slug から session workspace と全教材ファイルをビルド時に取得する。
2. `CodeExplorer` は初期ファイルを表示し、編集内容をページ内のメモリにだけ保持する。
3. 参加者が実行を押すと、既存どおり WebContainer を遅延起動し、現在の全編集内容を反映して選択ファイルを実行する。
4. 実行結果、失敗、停止は既存の `OutputPanel` に表示する。ページの再読み込みまたは選択ファイルのリセットで、開始 snapshot に戻せる。

通常の `CommandBlock` は削除しない。参加者はローカルの `pnpm` 実行とブラウザ内の実行のどちらでも同じ学習手順を進められる。

## エラー処理と制約

- `crossOriginIsolated` または WebAssembly を利用できない場合、WebContainer を起動せず、既存の Chrome/Edge と分離ヘッダーの案内を表示する。ファイル閲覧と編集は継続できる。
- 起動、依存準備、実行の失敗は出力パネルに表示し、再実行可能な状態へ戻す。
- 編集内容はブラウザ外へ保存しない。参加者のコードは Cloudflare Worker へ送信しない。
- 固定された workspace 内の既知パスだけを実行対象にし、ユーザー入力をシェルコマンドとして評価しない。

## テストと視覚確認

- `SessionCodePlayground` のテストで、slug に対応する初期ファイル、説明、React island の props が描画されることを確認する。
- 8つのセッションページそれぞれで、Playground と目次リンクが描画され、該当する session workspace を渡すことを確認する。
- 既存の `CodeExplorer`、workspace、runner のユニットテストを維持する。
- `pnpm --filter @fp-with-ts/docs test`、`pnpm --filter @fp-with-ts/docs typecheck`、`pnpm --filter @fp-with-ts/docs build`、およびリポジトリ全体の検証を実行する。
- 8つの対象 URL をモバイル幅とデスクトップ幅で確認し、ファイルツリー、エディタ、操作ボタン、出力領域の横あふれや操作不能がないことを確認する。

## 完了条件

- 8つのセッションページすべてに、そのページの開始 snapshot を使う Code Playground がある。
- 各 Playground は対応するファイルツリー、初期選択ファイル、編集、リセット、実行、停止、出力を既存の契約どおり提供する。
- セッション本文の問題、テスト、読むべきファイル、通常のコマンド手順を維持する。
- 実験用 `/code-explorer/` ページが引き続き Session 00 snapshot を使って表示・実行できる。
- docs のテスト、型検査、静的ビルドと、対象ページのモバイル・デスクトップ視覚確認が成功する。
