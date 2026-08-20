# 用途別 Branded Type を独立セッションへ切り出す

## 文書情報

- 作成日: 2026-08-21
- ステータス: 実装方針
- 対象イシュー: [#49](https://github.com/iwasa-kosui/fp-with-ts-hands-on/issues/49)、[#60](https://github.com/iwasa-kosui/fp-with-ts-hands-on/issues/60)
- 影響する資料: `docs/prd/prd-001.md`、`apps/docs/src/sessions/catalog.ts`、`examples/session-03` 以降のスナップショット、`docs/event/` 配下の当日資料

## 1. 背景

S3「外部境界と意味のある値を設計する」は、境界検証、用途別 Branded Type による識別、`Sensitive` による個人情報の保護という3つを同じ30分で扱っています。ここに2つの問題があります。

Issue #49 が指摘したのは、設計判断と演習ステップの数が合わないことです。`catalog.ts` の S3 は `decisions` を3件持ちますが、`steps` は2件しかありません。「用途の異なるIDを取り違えない」に対応するステップが存在せず、`examples/session-03/src/domain/ids/` の5つの識別子は完成済みで配布されます。参加者は Branded Type について手を動かしません。

Issue #60 が指摘したのは、識別子に型が付く差分がどのセッションにも属していないことです。`examples/session-03/src/domain/appointment/appointment.ts` では `appointmentId`、`petId`、`ownerId` が3つとも素の `string` ですが、`examples/session-04` の同じファイルでは別々の型になっています。S3 の編集範囲は `src/boundary` の2ファイルに閉じており、S2 の編集範囲は `transitions.ts` と `statusLabel.ts` です。この差分は、どちらの演習にも入っていません。

加えて、S3 の演習範囲の中には Branded Type の対比材料がありません。`examples/session-03/src/boundary/examResult.ts:6` は開始時点で既に `examId: ExamId` を持っており、「同じ形式の値を用途で区別する」変化を示せません。

## 2. 決めたこと

セッションを1つ増やし、開催時間を210分へ延ばします。増やすセッションは、用途別 Branded Type による識別を扱う回とします。

Issue #49 は4つの案を挙げていました。他の3案を採らない理由は次のとおりです。

- Branded Type を S2 へ移す案: S2 は既にステップ4件、設計判断3件で、PRD が定める上限に達しています。既存ステップの入れ替えが前提になり、扱う主題も状態遷移から離れます
- Branded Type を読むだけの扱いにする案: 事故報告に現れる ID の取り違えに対して、参加者が手を動かす場面が最後まで生まれません
- S3 の30分の中で前半と後半に分ける案: 演習時間が12分しかなく、2つの主題それぞれに検証と相互レビューを置けません

## 3. 新しいセッション構成

| 順 | slug | 題 | 分 | 開始スナップショット | 解答スナップショット |
| --- | --- | --- | --- | --- | --- |
| 00 | `00-system-handover` | 業務とシステムを引き継ぐ | 10 | `session-00` | なし |
| 01 | `01-business-events-and-workflows` | ビジネスイベントからワークフローを描く | 15 | なし | なし |
| 02 | `02-state-transitions` | 予約の状態と遷移をモデル化する | 30 | `session-02` | `session-03` |
| 03 | `03-semantic-identifiers` | 用途の異なる識別子を型で区別する | 30 | `session-03` | `session-04` |
| 04 | `04-boundaries-and-pii` | 外部入力を境界で検証し個人情報を守る | 30 | `session-04` | `session-05` |
| 05 | `05-workflow-errors` | 失敗をワークフローの結果として扱う | 30 | `session-05` | `session-06` |
| 06 | `06-effects-and-consistency` | 副作用と整合性境界を設計する | 30 | `session-06` | `session-07` |
| Final | `final` | 参照実装で境界をたどる | 5 | `final` | なし |

セッションの内容時間は 10 + 15 + 30 × 5 + 5 = 180分です。固定の休憩30分を合わせて210分になります。

新しい S3 の時間配分は S2 と同じ `brief: 4, teach: 6, exercise: 13, review: 7` とし、ADV は `articulate: 2, delegate: 9, verify: 2` とします。旧 S3 の配分 `brief: 4, teach: 7, exercise: 12, review: 7` は新しい S4 がそのまま引き継ぎます。

## 4. スナップショットの繰り下げ

`examples/session-04` から `examples/session-06` を1つずつ繰り下げ、空いた `examples/session-04` に新しい解答スナップショットを作ります。

| 現在 | 変更後 | 位置づけ |
| --- | --- | --- |
| `session-03` | `session-03` | 新 S3 の開始。識別子は素の `string` |
| なし | `session-04` | 新 S3 の解答かつ新 S4 の開始。識別子に型が付いた状態 |
| `session-04` | `session-05` | 新 S4 の解答かつ新 S5 の開始 |
| `session-05` | `session-06` | 新 S5 の解答かつ新 S6 の開始 |
| `session-06` | `session-07` | 当日の到達点 |

パッケージ名 `@fp-with-ts/clinic-session-NN`、公開する演習コマンド `pnpm exercise:02` から `pnpm exercise:06`、型テストの接頭辞 `sNN-` も同じ規則で追随させます。`ExampleSnapshot` の union に `session-07` を加え、`PublicCodeExplorerSnapshot` が除外する到達点も `session-07` へ移します。

## 5. 新しい S3 の演習設計

編集範囲は `examples/session-03/src/domain` の1モジュールとし、ファイル4件、実効30行を上限とします。

開始スナップショットでは、`ids/examId.ts`、`ids/appointmentId.ts`、`ids/veterinarianId.ts` の3つを完成済みの手本として配布し、`ids/petId.ts` と `ids/ownerId.ts` を素の `string` の別名へ戻します。手本を読んでから同じ規約で2つ書く形にすることで、5つとも書き写す作業になることを避けます。

ステップは3件とし、設計判断3件と1対1で対応させます。

| ステップ | 目的 | 対象 |
| --- | --- | --- |
| `s3-brand-pet-and-owner-id` | ペットと飼い主の識別子を、互いに代入できない型にする | `ids/petId.ts`、`ids/ownerId.ts` |
| `s3-apply-ids-to-appointment` | 予約の5状態が持つ識別子を、用途別の型へ置き換える | `appointment/appointment.ts` |
| `s3-reject-id-swap` | 取り違えがコンパイルで止まることを、型テストで自分で確かめる | `domain.test-types.ts` |

設計判断は次の3件です。

- 用途の異なる識別子を取り違えない。用途別の Branded Type で区別する。永続化上は同じ TEXT なので、復元時に再度 parse する必要がある
- 識別子は検査を通った値からしか作らない。`schema.parse` を通す companion object に生成経路を絞る。`as` によるキャストで型を捏造することは型だけでは防げない
- 状態が変わっても識別子の意味は変わらない。5状態すべてで同じ識別子の型を使う。同じ型を別の業務的な意味で使い回すことは型では検出できない

事故は「ラボの ID を取り違えて他の患者へ検査結果が付いた」を新しい S3 が引き取ります。S0 の事故報告には追加しません。S0 は10分しかなく、二重請求と連絡先の流出の2件で現行業務の観察に必要な材料が揃っているためです。

## 6. Issue #49 と #60 への対応

#49 が「いずれを採る場合でも必要」として挙げた3点は次のように扱います。

- `ownerContact.ts` の `.brand<...>().transform(Sensitive.of)` が2つの手段を1行に載せている点は、新しい S4 の解説セクションで、識別のための brand と保護のための `Sensitive` を別の段落に分けて説明します。ID の取り違えは前の回で扱い済みになるため、S4 では `Sensitive` の側だけを主題にできます
- ID 取り違えの事故は、新しい S3 の `incident` として残します
- Branded Type には、上の3ステップが対応します

#60 が挙げた2点は次のように扱います。

- `domain/appointment/appointment.ts` で識別子に型が付く差分は、新しい S3 の2つ目のステップそのものになります。どのセッションにも属さない差分ではなくなります
- 対比が成立する開始状態は `examples/session-03/src/domain` に置きます。合わせて `boundary/examResult.ts` の `ExamResult` が持つ `examId` と `petId` も開始時点では素の `string` とし、識別子に型が付くのは新しい S3 の演習を通ってからにします

## 7. 影響範囲

- `docs/prd/prd-001.md`: 開催時間、セッション配分、演習の本数、ADV 配分、公開する演習コマンド、到達点スナップショットの名前
- `apps/docs/src/sessions/catalog.ts`: 新しい S3 のエントリ追加と、既存 S3 以降の `sequence`、`slug`、`snapshot`、`solutionSnapshot`、ステップ ID の繰り下げ
- `apps/docs/src/pages/sessions/`: 新しいページの追加と既存3ページのリネーム
- `apps/docs/src/code-explorer/`: `session-workspaces.ts` の slug と可視ファイル、`project-files.ts` の到達点スナップショット名
- `examples/`: ディレクトリ3件のリネーム、新しい `session-04` の作成、`session-03` の開始状態の変更、各スナップショットの演習テストと回帰テスト
- `package.json`: `exercise:06` の追加とフィルタ名の更新
- `docs/event/`: ファシリテーター向けガイド、参加者向けセットアップ、レビューシート、相互レビューカード、トラブルシューティング
- `README.md`、`AGENTS.md`

## 8. 検証

- `pnpm typecheck` が全パッケージで成功すること
- `pnpm test` が全ファイルで成功すること。`pnpm exercise:02` から `pnpm exercise:06` が開始スナップショットで業務語彙の `AssertionError` として失敗すること
- `pnpm build` が全ページを生成すること
- 新しい S3 のステップ数が3件、設計判断が3件で、`catalog.test.ts` の上限検査を通ること
