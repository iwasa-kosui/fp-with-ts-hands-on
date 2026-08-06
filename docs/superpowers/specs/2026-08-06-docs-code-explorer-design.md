# モジュール別コードエクスプローラー設計

## 背景

`apps/docs` の各モジュールページは、参加者が読むファイルと実行するテストをパスで案内している。一方、実際のコードを確認するにはリポジトリを別途開く必要があり、ページに書かれた説明、対象ファイル、テスト結果を往復しなければならない。

この往復を減らすため、各モジュールページへファイルツリー付きのコードエクスプローラーを追加する。参加者はページ内で教材コードを選択、編集し、選択した1ファイルをテストまたはTypeScriptのエントリポイントとして実行できる。

実行基盤には、既存の [`iwasa-kosui/fp-ts-playground`](https://github.com/iwasa-kosui/fp-ts-playground) と同じくWebContainersとMonaco Editorを使う。WebContainersはCloudflare Workers上で実行するのではなく、Workersが配信したページを開いた参加者のブラウザ内でNode.js環境を起動する。

## 目的

- `apps/docs` の7つのモジュールページすべてで、そのモジュールに関係する教材コード群を閲覧できるようにする。
- ディレクトリ構造を保ったファイルツリーから、表示・編集するファイルを1つ選べるようにする。
- 選択した `*.test.ts` を、他のテストを含めずVitestで実行できるようにする。
- 選択したその他のTypeScriptファイルを、1つのエントリポイントとして実行できるようにする。
- 選択していないファイルへの編集も保持し、import先を含む現在の編集内容で実行できるようにする。
- 既存のAstro静的生成、Cloudflare Workers Static Assets配信、モジュール本文と目次構造を維持する。

## 対象外

- 編集内容のサーバー保存、アカウント間同期、GitHubへのcommitまたは共有URL生成
- 対話シェル、任意のシェルコマンド入力、常駐開発サーバーの操作
- 複数のテストファイルを一度に選択して実行する機能
- 補完候補のためにnpm registry全体を探索する機能
- SafariとFirefoxを正式な動作対象にすること
- Cloudflare Workers上で参加者のコードをサーバー実行すること
- 教材のドメインコード、exercise、通常テストの内容変更

## 動作環境

- 正式な対象ブラウザは、デスクトップ版ChromeとEdgeの現行版とする。
- JavaScript、WebAssembly、SharedArrayBufferを利用できることを前提とする。
- WebContainersの起動と依存パッケージ取得のため、実行時にネットワーク接続を必要とする。
- 商用・営利環境へ転用する場合は、WebContainer APIの利用条件を別途確認する。

## 採用する構成

Astroがビルド時に教材ファイルを文字列として収集し、モジュール別カタログから表示対象を決める。Reactアイランドは受け取ったファイル群をMonaco Editorへ表示し、実行要求があったときだけWebContainerを起動する。

```text
packages/clinic-example/
    └── 教材の正本
             │ build時に収集
             ▼
apps/docs/src/code-explorer/
    ├── project-files.ts      全実行ファイルの収集
    ├── module-workspaces.ts  slugごとの表示対象と初期選択
    └── runner.ts             WebContainerとの境界
             │
             ▼
apps/docs/src/components/code-explorer/
    ├── ModuleCodeExplorer.astro
    ├── CodeExplorer.tsx
    ├── FileTree.tsx
    ├── MonacoEditor.tsx
    └── OutputPanel.tsx
```

### 教材ファイルの収集

`packages/clinic-example` を教材の唯一の正本とする。Astro/Viteの静的なglob importを使い、次のファイルをビルド時に文字列として取り込む。

- `src/**/*.ts`
- `exercises/**/*.test.ts`
- `test/**/*.test.ts`
- WebContainer内で必要な `package.json`、`tsconfig.json`、Vitest設定

ページ本文へコードを複製しない。教材ファイルを変更してdocsを再ビルドすれば、エクスプローラーの初期コードも同じcommitの内容へ更新される。

WebContainerには実行の依存解決を確実にするため、収集したプロジェクト全体をマウントする。ファイルツリーにはモジュール別カタログが選んだファイルだけを表示する。これにより、実行に必要なimport先を失わず、学習中のモジュールと無関係なファイルでツリーを埋めない。

### モジュール別カタログ

`module-workspaces.ts` はモジュールslugごとに次を宣言する。

- ファイルツリーへ表示するファイルパス
- 初期選択するファイルパス
- エクスプローラーの短い説明

表示対象の基準は次の通りとする。

| モジュール | 主な表示対象 |
| --- | --- |
| `00-break-the-app` | legacy appointment/logger、exercise 00、通常フローtest |
| `00-read-the-incident` | legacy appointment、clinic appointmentとID、exercise/test 01 |
| `01-state-modeling` | clinic appointmentとID、exercise/test 01 |
| `02-boundary-and-ids` | exam result、owner contact、ID、Sensitive、schema result、exercise/test 02 |
| `03-result-errors` | use case、repository、event store/events、Resultと必要なdomain files、exercise/test 03 |
| `04-agent-review` | agent review、exercise/test 04 |
| `05-mini-integration` | use case、follow-upに必要なdomain files、exercise/test 05 |

各グループは、ページ本文の「先に読むファイル」「編集する場所」と一致させる。import依存を増減したときに、実行用プロジェクト全体は自動的に追従する。学習上表示すべき依存はカタログのテストで明示的に保つ。

### `ModuleCodeExplorer.astro`

モジュールslugを受け取り、カタログと収集済みファイルからReactへ渡す直列化可能なworkspace descriptorを作る。未知のslug、存在しない初期ファイル、カタログに書かれた存在しないファイルはビルドまたはテストで失敗させる。

このコンポーネントは `ModuleLayout.astro` から1回だけ描画する。本文の `article` とページ内目次の外へ置き、既存の著者定義見出しと目次項目を変えない。

### `CodeExplorer.tsx`

コードエクスプローラー全体のクライアント状態を管理する。

- 現在選択しているファイル
- 各ファイルの現在の編集内容
- 初期内容との差分有無
- WebContainerの準備状態
- 実行中のファイルと実行方式
- stdoutとstderrを含む統合端末出力、終了コード

Reactアイランドは初期表示からエディタ操作に必要なためクライアントでhydrateするが、WebContainer本体と実行依存の準備は「実行」を押すまで遅延する。

hydrate前とJavaScript無効時には、初期選択ファイルのパスとコードを読み取り専用の `<pre>` として表示する。Monacoの準備完了後に同じ場所をエディタへ置き換える。

### `FileTree.tsx`

ファイルパスからディレクトリ階層を構築し、フォルダとファイルを区別して表示する。ファイルはbuttonとして操作でき、選択中、編集済み、実行可能種別を視覚表示とテキストの両方で伝える。

キーボード操作ではTabで各ファイルへ移動し、EnterまたはSpaceで選択できる。初版ではVS Codeと同じtree keyboard patternの完全再現やドラッグ操作は行わない。

### `MonacoEditor.tsx`

選択したTypeScriptファイルごとにMonaco modelを持ち、ファイル切り替え後もundo履歴と編集内容を維持する。TypeScriptの診断を有効にし、教材内のファイルをextra libまたはmodelとして登録してローカルimportの型情報を解決する。

エディタ上部には現在のパス、実行種別、次の操作を置く。

- `実行`
- `このファイルを元に戻す`

コピーは既存の `CopyButton` と責務が重なるため、初版のエディタ専用操作には追加しない。

### `OutputPanel.tsx`

対話端末ではなく、一回の実行結果を読みやすく表示する専用パネルとする。

- 準備中、実行中、成功、失敗の状態
- 実行したファイルと実行方式
- stdoutとstderrを到着順に含む統合端末出力
- 終了コード

出力は逐次追記し、`aria-live="polite"` で状態変化を通知する。ANSI色を無効化したコマンドを実行し、文字列をHTMLとして解釈しない。

## 実行方式

### WebContainerのライフサイクル

1ページにつきWebContainerを1個だけ起動する。起動Promiseを共有し、二重bootを防ぐ。

1. 最初の「実行」でブラウザ要件を確認する。
2. WebContainerをbootする。
3. `packages/clinic-example` 相当のファイルツリーと実行用package manifestをmountする。
4. `npm install` を1回実行する。
5. 編集中の全ファイルをWebContainerへwriteする。
6. 選択ファイルに対応するコマンドをspawnする。
7. 出力と終了コードを表示する。

同じページ内の2回目以降は、bootとinstallを繰り返さず、編集内容の同期と選択ファイルの実行だけを行う。

### コマンドの選択

- `exercises/*.test.ts` は `vitest.exercises.config.ts` を指定し、選択パスだけをVitestへ渡す。
- `test/*.test.ts` は `vitest.config.ts` を指定し、選択パスだけをVitestへ渡す。
- その他の `.ts` ファイルは、`tsx`へ選択パスだけを渡して起動する。
- TypeScript以外のファイルは閲覧・編集できても実行対象にはしない。
- 実行中は実行ボタンを無効化し、同じWebContainerでプロセスを重ねない。

Vitest、Zodなど教材が既に使う依存は、教材package manifestのバージョンを維持する。エントリポイント実行のために `tsx`、UIと実行基盤のために `monaco-editor` と `@webcontainer/api` を追加する。

## 編集状態

編集内容はReactアイランドのメモリ内だけに保持する。ファイルを切り替えても保持し、実行前に全編集内容を同期する。ページを再読み込みした場合はリポジトリの初期内容へ戻る。

初版ではlocalStorage、URL hash、サーバーへ保存しない。イベント中に意図せず以前の試行が残ることを避け、教材の初期状態へ確実に戻せることを優先する。

「このファイルを元に戻す」は現在のファイルだけを初期内容へ戻す。実行中は編集と復元を無効化し、実行した内容と画面上の内容が食い違わないようにする。

## エラー処理

### ブラウザ要件

`crossOriginIsolated` と必要なWeb APIを実行前に検査する。満たさない場合はbootせず、ChromeまたはEdgeで開くことと、配信ヘッダーを確認することを日本語で案内する。コードの閲覧と編集は継続できる。

### 初期化と依存準備

boot、mount、`npm install` を別々の状態として表示する。失敗時はエラーを出力パネルへ表示し、再試行できる状態へ戻す。ページ全体を例外で壊さない。

### 実行

非zero終了を実行失敗として表示するが、編集内容とWebContainerは保持する。参加者は同じファイルを修正して再実行できる。端末出力の内容にかかわらず、終了コードが非zeroなら失敗とする。

### データ不整合

未知のslug、存在しないファイル、初期選択が表示対象外、重複パスは開発時の不具合であり、ユーザー向けフォールバックにせずビルドまたはテストで検出する。

## Cloudflare Workersとローカル開発

WebContainersに必要な次のレスポンスヘッダーを、Cloudflare Workers Static AssetsとAstro開発サーバーの両方で付与する。

```text
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

本番配信では `apps/docs/public/_headers` を追加する。Astroがこれを `dist/_headers` へコピーし、Cloudflare Workers Static Assetsが静的レスポンスへ適用する。`run_worker_first` を全ページへ広げず、現在のassets-first配信を維持する。

ローカル開発とローカルプレビューでは、`astro.config.ts` のVite `server.headers` と `preview.headers` へ同じ値を設定する。

`worker/index.ts` のhealth check、互換リダイレクト、asset委譲の責務は変更しない。

## レスポンシブ表示

デスクトップでは、上段をファイルツリーとエディタの2列、下段を横幅いっぱいの出力パネルにする。ファイルツリーは一定幅、エディタは残り幅を使う。

狭い画面ではファイルツリー、エディタ、出力を縦に並べる。エディタと出力には最小高を持たせ、ページ全体と各パネルの二重横スクロールを避ける。タッチ操作でもファイルと実行ボタンへ十分な押下領域を与える。

既存のケースファイル配色を引き継ぎ、コード領域は暗色、操作部はミント、レモン、コーラルで状態を区別する。装飾よりファイル名、コード、テスト結果の可読性を優先する。

## セキュリティとデータ境界

- 編集コードは参加者のブラウザ内のWebContainerだけで実行し、Cloudflare Workerへ送信しない。
- 任意の対話シェルを公開せず、アプリが組み立てた固定コマンドと選択ファイルパスだけをspawnする。
- 選択ファイルはカタログ由来の既知パスに限定し、ユーザー入力をコマンド文字列として評価しない。
- 出力はtextとして描画し、HTMLを挿入しない。
- 編集内容はブラウザメモリ内だけに保持し、外部へ保存しない。

## テスト方針

### モジュール別カタログ

- 7つすべてのモジュールslugにworkspaceがある。
- 各workspaceの初期選択が表示対象に含まれる。
- 表示対象の全パスが収集済みプロジェクトに存在する。
- exerciseと通常testの期待パス、および本文で案内する主要sourceが含まれる。
- 重複パスと未知のslugを受け入れない。

### 実行判断

- `exercises/*.test.ts` はexercise用設定と選択ファイルだけをVitestへ渡す。
- `test/*.test.ts` は通常テスト用設定と選択ファイルだけをVitestへ渡す。
- その他の `.ts` は選択ファイルだけをtsxへ渡す。
- 実行不能な拡張子ではコマンドを作らない。
- パスを単一のspawn引数として扱い、シェル文字列へ連結しない。

### React UI

- ツリーから選んだファイルの内容を表示する。
- ファイル切り替え後も編集内容を保持する。
- 編集したファイルだけに変更状態を表示する。
- 現在のファイルだけを初期内容へ戻せる。
- 実行中は二重実行と復元を防ぐ。
- 準備、成功、非zero終了、初期化失敗を区別して表示する。

WebContainer APIそのものは外部実行基盤として境界の内側へ閉じ込める。UIテストでは制御可能なrunner実装を注入し、ボタン操作から状態・出力へ至る自分たちの振る舞いを検証する。コマンド選択とworkspace検証は純粋関数として実物をテストする。

### ページ統合

- 7つすべてのモジュールページに1つのコードエクスプローラーがある。
- module slugに対応する初期ファイルとファイルツリーが静的HTMLへ含まれる。
- 既存の `article h2` とページ内目次の構造を変えない。
- JavaScript実行前でもファイル名、初期コード、ブラウザ要件の説明を読める。

### 配信とビルド

- docsの型検査、テスト、静的ビルドが成功する。
- `dist/_headers` が生成され、Cloudflare用ヘッダー規則を含む。
- Workerの既存health check、リダイレクト、asset routeテストが成功する。
- 全体のテスト、型検査、ビルドが成功する。

## 完了条件

- 7つすべてのモジュールページで、モジュールに対応するファイルツリーを閲覧できる。
- ファイルを切り替えて編集でき、切り替え前の編集が保持される。
- 選択したテストファイル1つだけをVitestで実行できる。
- 選択した通常TypeScriptファイル1つだけをエントリポイントとして実行できる。
- import先を含む現在の編集内容が実行へ反映される。
- 出力、エラー、終了状態をページ内で確認でき、失敗後に修正して再実行できる。
- ChromeとEdgeでCloudflare Workers配信およびローカル開発の双方からWebContainerを起動できる。
- 既存の本文、目次、前後ナビゲーション、Workerルートが維持される。
- 教材コードをdocs側へ手作業で複製していない。
- 関連するテスト、型検査、静的ビルドが成功する。

## 参考実装と仕様

- [`iwasa-kosui/monorepo` のCodePlayground](https://github.com/iwasa-kosui/monorepo/tree/main/apps/kosui-me/src/components/CodePlayground): Monacoによる編集、遅延初期化、実行状態と出力表示
- [`iwasa-kosui/fp-ts-playground`](https://github.com/iwasa-kosui/fp-ts-playground): WebContainer、Monaco、ファイル書き込み、プロセス出力、Cloudflare向け `_headers`
- [WebContainers API](https://webcontainers.io/api): `boot`、`mount`、filesystem、`spawn`
- [WebContainersのヘッダー設定](https://webcontainers.io/guides/configuring-headers): COOP/COEPとCloudflareでの設定
- [Cloudflare Workers Static Assetsのcustom headers](https://developers.cloudflare.com/workers/static-assets/headers/): `_headers` の配信規則
