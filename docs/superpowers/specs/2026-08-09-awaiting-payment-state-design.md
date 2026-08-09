# AwaitingPayment 状態追加設計

## 背景

現行アプリケーションでは、診察結果を記録しても予約 projection は `InExamination` のままです。診察結果は保存されていますが、詳細画面には保存済みであることが現れず、同じフォームを繰り返し送信できます。実際のローカル確認では、同じ予約操作から複数の `ExamResultRecorded` が保存されました。

診察結果の記録完了と会計待ちを予約状態として区別し、画面、認可、永続化を同じ業務状態に揃えます。

## 予約状態

予約の通常経路を次の5状態にします。

```text
Scheduled → CheckedIn → InExamination → AwaitingPayment → Paid
```

`Scheduled | CheckedIn → Canceled` は維持します。`Paid` と `Canceled` は終端状態です。

`AwaitingPayment` は次の値を必須で持つ `Readonly` な判別共用体の一員です。

- 既存の予約、受付、担当獣医師、診察開始の値
- 診察結果を識別する branded `ExamId`
- 診察完了時刻を表す branded `Timestamp`

optional field で「診察結果記録済み」を表現しません。`kind: "AwaitingPayment"` で、会計可能な状態を型から一意に判定できるようにします。

## ドメインイベントと状態遷移

`Appointment.completeExamination(context)(appointment, { examId })` を純粋関数として追加します。入力は `InExamination` に限定し、`AppointmentExaminationCompleted` を返します。イベントの `aggregateState` は `AwaitingPayment` です。

診察結果記録時には、次の2イベントを同じユースケースで生成します。

1. `ExamResultRecorded`
2. `AppointmentExaminationCompleted`

`RecordExamResultUseCase` の依存は、これら2イベントを受け取る一つの専用 store port を持ちます。成功結果は `ExamResult` と `AwaitingPayment` を返します。ID generator、clock、ドメイン遷移の例外は `IdentityGenerationFailed`、永続化失敗は `RepositoryError`、競合は ID 以外を含まない `AppointmentConflict` として `ResultAsync` のエラーチャネルへ載せます。

## SQLite 永続化

専用 SQLite store は一つの transaction で次を実行します。

1. 予約 projection を、現在の status が `InExamination` の場合だけ `AwaitingPayment` へ条件付き更新する
2. 診察結果 projection を追加する
3. `ExamResultRecorded` を `domain_events` に追記する
4. `AppointmentExaminationCompleted` を `domain_events` に追記する

予約更新の affected row が1でなければ `AppointmentConflict` を返し、診察結果 projection と両イベントをすべて rollback します。同じ `InExamination` snapshot から並行実行された場合、成功は一つだけです。

`appointments.status` は SQLite の text 列であるため、既存 DB を破壊する SQL migration は不要です。Drizzle schema の列挙と JSON state parser を5状態へ更新します。`AwaitingPayment` が `examId` を持つため、イベント履歴から operational state を導出する resolver や、新しい関連 projection は追加しません。

既存の `ExamResultRecorded` 行とイベントは変更・削除しません。既存の `InExamination` 予約は自動 backfill しません。過去の診察結果には予約 ID がなく、機械的な紐付けが別の来院を誤って選ぶ可能性があるためです。修正後に一度記録すると、新しい診察結果と予約遷移が正式に同じ transaction で保存されます。

## 会計と問い合わせ

`RecordPaymentUseCase` と `Appointment.recordPayment` は `AwaitingPayment` だけを入力に取ります。`InExamination` から直接 `Paid` へ進めません。`Paid` は `examId` と `examinationCompletedAt` を保持し、状態の時系列と診察結果との関連を失わない形にします。

予約 resolver、一覧、詳細 DTO は `AwaitingPayment` を独立した variant として schema 検証し、網羅的に変換します。関連 owner、pet、veterinarian が削除済みの場合の表示規則は維持します。

## HTTP と画面

診察結果記録の成功は従来どおり予約詳細への `303 See Other` を返します。リダイレクト先では `AwaitingPayment` が表示され、診察結果フォームは消えます。

- `Admin` と `Receptionist` には会計フォームを表示する
- `Veterinarian` には会計操作を表示せず、診察結果が記録済みで会計待ちであることを表示する
- stale な画面から再送された場合は `AppointmentConflict` を安全な allowlist error code へ変換し、最新状態を再表示する

診察結果や診断などの自由記述は、既存どおり domain/useCase では `Sensitive` を保持し、許可された HTTP page DTO と SQLite projection 境界だけで明示的に unwrap します。監査イベントへ自由記述を保存しません。

## 検証

次を RED → GREEN で確認します。

- domain: `InExamination → AwaitingPayment → Paid` の純粋遷移、旧状態からの不正遷移が型で表現できないこと、イベント shape
- useCase: 認可、pet 一致、2イベント生成、generator/clock 例外、typed conflict、失敗時 store 未呼び出し
- SQLite: projection 2件とイベント2件の原子保存、各書き込み失敗時の全 rollback、同一 snapshot の並行再送で成功が一つだけ
- route: booking から payment までの5状態、成功時303、競合表示、状態別 action、ロール別403
- SSR: `AwaitingPayment` の表示、診察結果フォームの消失、Admin/Receptionist の会計フォーム、Veterinarian の会計待ち表示
- migration/file smoke: 既存 DB schema から新状態を保存・復元でき、既存行を変更しないこと
- docs: README と公開 final ページの状態遷移が5状態で一致すること

## 対象外

- 既存の重複診察結果 projection や監査イベントの削除
- 過去イベントから予約 projection を再構築する event resolver
- 通常の再診フロー
