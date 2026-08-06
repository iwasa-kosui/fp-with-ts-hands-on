# 動物病院サンプルのセッション別スナップショット設計

## 背景

現在の `packages/clinic-example` には、事故を再現する legacy 実装、各セッションで導入する設計要素、全セッション終了後の機能が同居しています。受講者がセッション開始時点のコードを取得できず、`apps/docs` の説明が同じ完成実装を参照しているため、学習順序と実装の状態が一致していません。

本変更では、各セッション開始時点の実装を独立した pnpm package として `examples/` に配置します。セッションを進めるごとに設計上の問題を一つずつ解消し、最後に Kamae の原則を適用した `examples/final` を完成例として提供します。

## 目的

- 任意のセッションを、必要な開始コードが揃った状態から始められるようにします。
- セッションの説明、実装、テスト、実行コマンドを同じ package に対応付けます。
- 前後の package を比較すると、そのセッションで改善する設計要素が分かるようにします。
- 通常テストでは全スナップショットの完成済み機能を検証し、演習テストでは次に実装する機能を検証します。
- 最終例では、Kamae の状態モデリング、境界防御、Result、PII 保護、宣言的処理を一貫して適用します。

## 対象外

- 実データベースやメッセージブローカーは導入しません。
- outbox の実装は追加しません。状態とイベントを一括保存する契約を in-memory 実装で示します。
- セッション間で共有する内部 package は作りません。
- 旧 `/modules/...` URL の互換ページやリダイレクトは残しません。リポジトリ内のリンクを `/sessions/...` へ更新します。

## 採用する構成

各 package は、直前の package に依存しない自己完結した累積スナップショットにします。ソースの重複は増えますが、受講者が任意のセッションから開始でき、前後の差分を直接確認できます。

```text
examples/
├── session-00/
├── session-01/
├── session-02/
├── session-03/
├── session-04/
├── session-05/
└── final/
```

`pnpm-workspace.yaml` に `examples/*` を追加し、移行後は `packages/clinic-example` を削除します。各 package は固有の `package.json`、`tsconfig.json`、ソース、通常テスト、必要な場合は演習テストを持ちます。

## スナップショットの意味

`session-NN` は、その番号のセッションを始める時点のコードです。したがって、`session-01` は Session 00 の終了時点でもあり、Session 01 の開始時点でもあります。`final` は Session 05 の終了時点であり、`session-06` に相当します。`examples/session-06` は作りません。

### `session-00`

事故を含む初期実装です。文字列の status、状態に関係なく存在できる optional field、例外、PII を含むログを残します。Session 00-A と Session 00-B はどちらもこの package を参照します。

### `session-01`

Session 00 で確認した事故条件と要求を characterization test として固定します。実装はまだ legacy のままとし、状態表現を Session 01 で改善する理由が分かる状態にします。

### `session-02`

Session 01 の成果として、`kind` を判別子に使う状態の判別共用体と、入力型で遷移元を制限する純粋関数を導入します。ID は primitive のまま残し、境界から来た値を信頼できない問題を次の課題にします。

### `session-03`

Session 02 の成果として、Zod による外部入力の検証、用途別の branded ID、`Sensitive<T>` による PII 保護を導入します。Result によるユースケースのエラー処理はまだ導入しません。

### `session-04`

Session 03 の成果として、neverthrow、判別共用体で表すエラー、ユースケース、repository、domain event を導入します。状態保存とイベント保存は別操作のまま残し、Session 04 のレビューで扱う問題にします。

### `session-05`

Session 04 のエージェントレビュー結果を反映します。責務が集中したファイルの分割、ログや Node.js の inspect に対する PII 保護、未検証だった境界入力、状態とイベントを保存する契約を改善します。電話フォローの統合ユースケースは未実装のまま残します。

### `final`

Session 05 の電話フォロー要件を統合した完成例です。Paid、再診希望、対象の pet ID、飼い主の連絡先、`FollowUpRequested` を一つの処理で扱います。処理は `filter`、`map`、`reduce` と companion object の predicate を使って宣言的に記述します。

## package の契約

各 `session-NN` package は次の script を持ちます。

- `typecheck`: package 内の TypeScript を検査します。
- `test`: セッション開始時点までに完成している機能の回帰テストを実行します。
- `exercise`: そのセッションで実装する改善を検証します。配布状態では想定した理由で失敗し、docs の手順を終えると成功します。

`examples/final` は `typecheck` と `test` を持ちます。未完了の演習は含めません。

ルートの `exercise:00` から `exercise:05` は、同じ番号の `examples/session-NN` にある `exercise` を実行します。ルートの `typecheck`、`test`、`build` は通常テストだけを対象とし、意図的に失敗する演習テストを含めません。

## docs の構成

`apps/docs` では、画面とソースの両方で「module」を「session」へ変更します。

```text
apps/docs/src/pages/sessions/
├── 00-break-the-app.astro
├── 00-read-the-incident.astro
├── 01-state-modeling.astro
├── 02-boundary-and-ids.astro
├── 03-result-errors.astro
├── 04-agent-review.astro
├── 05-mini-integration.astro
└── final.astro
```

次の関連ファイルも同じ語彙へ変更します。

- `modules/catalog.ts` を `sessions/catalog.ts` へ変更します。
- `ModuleLayout.astro` を `SessionLayout.astro` へ変更します。
- `test/pages/modules/` を `test/pages/sessions/` へ変更します。
- 画面内の `/modules/...` と `packages/clinic-example` への参照を更新します。

各セッションページは、同じ番号の開始 package だけを参照します。Session 00-A と Session 00-B は `examples/session-00` を参照します。完成例のページは `/sessions/final/` で公開し、`examples/final` の設計要素と連携を説明します。

## final の設計

### ドメインモデル

予約の状態は `kind` を統一した判別子に使い、状態ごとに必要な情報を `Readonly` の型として定義します。型と companion object は一つの概念ごとにファイルを分けます。状態遷移は純粋関数にし、引数の型で有効な遷移元を制限します。

### 境界防御

API、repository、時刻や識別子の生成結果など、ドメイン外から入る値は Zod schema で検証します。用途の異なる識別子は別の branded type にします。飼い主名、メールアドレス、電話番号は `Sensitive<T>` で包み、JSON、文字列変換、Node.js の inspect で値を公開しません。

### エラー処理

予期できる失敗は neverthrow の `Result` または `ResultAsync` で返します。エラーは `kind` を持つ判別共用体として定義し、呼び出し側が網羅的に処理できるようにします。ドメインコードでは例外を投げません。

不正な遷移元は実行時エラーにせず、遷移関数の入力型でコンパイル時に除外します。外部入力の検証失敗、対象の未検出、保存失敗など、境界や実行時に起こる失敗だけを Result で表します。

### 状態とイベントの保存

ユースケースは次状態と domain event を組み立て、store の `save(state, events)` に一度だけ渡します。in-memory 実装は状態更新とイベント追加を同じ操作の中で完了させ、片方だけが保存された状態を作りません。

### 電話フォロー

電話フォロー対象の抽出は、Paid、再診希望、pet ID の一致を predicate として分離します。対象の連絡先と `FollowUpRequested` を immutable な値として生成し、mutable array や命令的な loop は使いません。

## テスト方針

- 各 package の通常テストは、その開始時点で完成している契約だけを検証します。
- 各 exercise は、次の package で完成する設計要素を検証します。
- 状態遷移では実行時テストに加え、無効な遷移が型検査で拒否されることを検証します。
- 境界では不正な unknown、異なる ID の混同、PII の文字列化を検証します。
- Result のテストでは成功と各エラーの `kind`、失敗時に状態やイベントが保存されないことを検証します。
- final では状態とイベントの一括保存、電話フォロー対象の抽出、重複イベントの防止を検証します。
- fixture は `as const satisfies Type` を使い、判別子の widening と不正なテストデータを防ぎます。
- docs のテストは catalog、前後のナビゲーション、ページ内の package パス、コマンド、公開 URL を検証します。

## 完了条件

- `packages/clinic-example` が削除され、必要なコードが `examples/session-00` から `examples/final` へ移行されています。
- 各 package が単独で typecheck と通常テストを実行できます。
- 各 `exercise:NN` が、対応する未実装機能を理由として失敗します。
- `examples/final` の通常テストが全要件を検証します。
- docs の全ページが対応する開始 package を参照します。
- docs の公開 URL と内部リンクが `/sessions/...` へ統一されています。
- ルートの typecheck、通常テスト、build が成功します。
