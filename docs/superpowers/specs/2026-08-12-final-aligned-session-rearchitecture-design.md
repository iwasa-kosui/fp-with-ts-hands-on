# `examples/final` に到達する段階的セッション再設計

## 背景

現行の教材は、業務事故から始め、状態・境界・失敗・イベントを順に扱うという重要な骨格を持つ。一方で、`examples/session-01` から `session-03` は複数の独立した設計判断を一回に導入しており、`examples/final` の `AwaitingPayment`、typed domain event、`ResultAsync`、原子的な SQLite store、競合、認可、PII の出力境界への橋渡しが不足している。

本設計は完成例をアーキテクチャの雛形として一括模倣させない。受講者が一つの業務事故を不変条件に翻訳し、必要最小限の設計手段を選び、検証し、型だけでは守れない残余リスクを説明する学習経路に作り直す。

## 目的

- 初級から中級の TypeScript 開発者が、完成例に含まれる設計を事故ごとに理解し、既存コードへ小さく適用できるようにする。
- 各セッションで、問題、守る不変条件、採用する手段、その限界、検証を一対一に対応させる。
- `examples/final` を、各ステップの解答の累積ではなく、判断を統合した参照実装として読めるようにする。
- 現行の 3 時間イベント枠を維持しつつ、実装量より判断と検証を優先する。

## 設計原則

1. **業務の言葉と事故を先に置く。** 型やライブラリ名から導入しない。
2. **防御層を混同しない。** 判別共用体、Zod、brand、`Sensitive`、`Result`、transaction はそれぞれ異なる事故を対象にする。
3. **編集は最大二関数。** 一回の演習で新しい設計判断を一つだけ求める。
4. **完成例の順でなく、事故の因果順に読む。** 構成図は最後に提示する。
5. **型を検証の代替にしない。** 各回で「型で守ること／実行時検証・統合テストで守ること／人がレビューすること」を明示する。
6. **成功した事実だけをイベント化する。** domain event を event sourcing や非同期メッセージングの同義語として教えない。

Kamae の TypeScript 向けの規約は、FDM の唯一の定義ではなく、構造的型付け・型消去・Node.js の出力経路に対応する実装上の選択として扱う。`Readonly`、`kind` を持つ判別共用体、Zod 境界、branded value、`Sensitive`、`ResultAsync`、typed event、用途別 port を採用する理由を、それぞれの事故と結び付ける。

## セッション構成

セッション番号は開始スナップショットを表す。`session-NN` は Session NN の配布開始状態、次の snapshot はその解答状態とする。各回のコード編集は明記した二関数以内に限定する。3 時間版では太字の回を主な編集演習にし、他は失敗予測、コード読解、ペアレビュー、解答ツアーで進める。

| 回 | 時間 | 事故と不変条件 | 設計手段と最小編集 | 主な検証 |
| --- | ---: | --- | --- | --- |
| 00 事故を読む | 10分 | 会計済み予約を診察中に戻せず、PII をログに出さない | legacy と事故報告を観察。編集なし | 事故再現テストを読む |
| 01 不変条件を固定する | 8分 | 事故を「会計済みから診察開始しない」と表現する | characterization test。編集なし | 失敗理由を業務用語で説明 |
| **02 状態の語彙** | 15分 | 予約済みからだけ受付できる | `Scheduled` / `CheckedIn` と `book`、`checkIn` | 不正な順序を型・テストで確認 |
| **03 遷移を閉じる** | 12分 | 診察開始は受付済みからだけ | `InExamination` と `startExamination`、網羅性確認 | `Scheduled` / `Paid` から開始できない |
| **04 診察と会計を分ける** | 12分 | 診察完了と支払完了を混同しない | `AwaitingPayment`、`completeExamination`、`recordPayment` | `InExamination → AwaitingPayment → Paid` |
| 05 終端状態を表す | 10分 | 取消理由は取消時だけ存在する | `Canceled`、`cancel`、終端判定 | 終端状態から再開しない |
| **06 外部入力を検証する** | 13分 | 外部値を TypeScript の注釈だけで信用しない | `unknown → Zod → schemaResult` | 不正 UUID・日時・金額を拒否 |
| 07 意味の違う値を分ける | 10分 | Owner/Pet/Appointment ID を取り違えない | 用途別 brand と parse | 異なる ID を代入できない |
| 08 PII を出力境界で守る | 10分 | 値の意味と秘匿性を混同せず、文字列化で漏らさない | `Sensitive` | JSON、String、inspect が redaction |
| **09 失敗を値で扱う** | 15分 | UI が未発見・状態不正・権限不足を区別できる | error union、`Result`、guard 二関数 | 失敗時に副作用が起きない |
| 10 成功した事実を残す | 12分 | 失敗を監査イベントとして残さない | `EventContext`、typed event、純粋遷移 | 成功時だけ event を生成 |
| **11 use case で副作用を合成する** | 15分 | 判断を HTTP/DB に埋め込まない | resolver/store/clock を注入した `ResultAsync` use case | port 呼出順とエラー変換 |
| **12 原子的保存と競合** | 16分 | projection と監査 event の片方だけを保存しない | event 専用 store、transaction、条件付き更新 | 競合時は一方だけ成功し rollback |
| **13 権限・安全な出力・総合** | 15分 | 操作者・閲覧者を問わず PII を出さない。フォローを重複させない | role/capability、allowlist read model、target収集と event 作成の分離 | 不正 role、重複 claim、PII 非露出 |
| Final 事故別ツアー | 7分 | 全判断がどこで合成されるかを説明できる | `examples/final` を事故から domain → use case → store → web の順で参照。編集なし | 一つの未解決リスクと次の改善を書く |

## `examples/final` との対応

- Session 02〜05 は `src/domain/appointment/appointment.ts` の状態モデルと純粋遷移へ到達する。ただし、最初から全状態・全イベントを作らない。
- Session 06〜08 は `src/domain/shared/schemaResult.ts`、各 value object、`src/domain/shared/sensitive.ts` の理由を分解して示す。
- Session 09〜11 は `src/useCase/errors.ts`、`startExaminationUseCase.ts`、小さい resolver/store port の責務へ接続する。
- Session 12 は SQLite event store の projection と監査イベントを同一 transaction で保存する責務と、`AppointmentConflict` を扱う範囲を扱う。
- Session 13 は follow-up の `collectFollowUpTargets` と `requestFollowUpUseCase` の分離、認可、監査・HTTP の安全な出力へ接続する。
- `app.ts`、Hono、Inertia、React は最後の composition / adapter として読む。フレームワーク設定を受講者の編集課題にしない。

## スナップショットと演習の契約

- `examples/session-00` から新たな `examples/session-13` までを、自己完結した累積 package とする。各 package の通常テストは開始時点で成功する。
- `exercise:NN` は Session NN で扱う事故を理由として配布状態では失敗し、次の snapshot が解答となる。通常の `test` は意図的に失敗する exercise を含めない。
- 各 README と docs ページには、必ず「開始状態」「この回で変える関数」「次の snapshot」「検証コマンド」を同じ表現で書く。現在の README とサイトの番号・到達点のずれを解消する。
- Final は演習 package にしない。全 snapshot が学習上の小さな例であり、Final は実運用で必要な統合判断を示す参照実装であることを明記する。

## 移行方針

1. 現行 Session 00 の事故を維持し、01 を不変条件・テスト専用の短い回として追加する。
2. 現行 Session 01 を 02〜05 の state progression に分解し、Final と同じ `AwaitingPayment` を早期に導入する。
3. 現行 Session 02 を 06〜08 に分解し、Zod、brand、`Sensitive` の対象事故を分離する。
4. 現行 Session 03〜04 を 09〜12 に分解し、`Result`、event、use case、atomic store、競合を別々に検証可能にする。
5. 現行 Session 05 を 13 の一部に置き換える。Final に合わせ、純粋関数は target を収集し、use case が認可・重複確認・event 保存を担当する。
6. AI エージェントの依頼・レビューは独立した技法回にせず、Session 12〜13 の統合レビューとして扱う。依頼文には業務用語、不変条件、変更上限、検証、残る人間レビュー項目を含める。

## 更新対象

- `apps/docs/src/sessions/catalog.ts`、各 `apps/docs/src/pages/sessions/*.astro`、セッションページテスト、Code Explorer の snapshot 対応、ルート `exercise:*` scripts。
- `examples/session-00`〜`examples/session-05` の再配置・README同期、および `examples/session-06`〜`examples/session-13` の追加。
- `docs/prd/prd-001.md`、参加者セットアップ、ファシリテーターガイド、トラブルシューティング。
- リポジトリガイドの旧 `packages/clinic-example` 参照。現行実体は `examples/` であり、実装着手時に正規パスへ同期する。

## 受け入れ条件

- 全ページが事故、登場人物の要求、参加者の作業、確認方法、期待する気づきを、技法名より前に示す。
- 各回は不変条件、手段、手段の限界、検証、振り返りを対応付ける。
- 各編集演習は二関数以内で完了でき、通常テスト・exercise・説明の期待結果が一致する。
- Session 04 以降の状態は Final の `AwaitingPayment` を含む状態遷移と矛盾しない。
- Final へ至る過程で、`ResultAsync`、typed event、atomic store、競合、認可、安全な出力境界の理由が一つずつ説明される。
- `pnpm typecheck`、通常の `pnpm test`、`pnpm build` が成功する。Final の既存 Web フローテストの `302` / `303` 不一致は、教材再設計とは別に解消してから完了とする。

## 対象外

- event sourcing、outbox、メッセージブローカー、外部通知の実装。
- 新しいフレームワークや関数型ライブラリの導入。
- Final の業務機能を増やすこと。
- legacy 実装を先回りして安全な実装に置換すること。
