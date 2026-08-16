# Final のインフラ障害境界

## 状態

- ステータス: 実装承認済み
- 対象: `examples/final` の SQLite secondary adapter、domain port、use case、web adapter
- 根拠: Codex task `01a00946-0ebd-7710-808c-4e72bf686b88` で合意した失敗分類と、2026-08-16 の明示的な修正依頼

## 問題

現在の `RepositoryError` は、SQLite の接続・制約違反、Zod による保存行の検証失敗、実装上の整合性破壊を一つの `ResultAsync` error channel に入れている。`cause: unknown` を含むため、呼び出し側は診断情報を必要とする未知障害を業務エラーのように列挙し、route は常に同じ 500 を返している。

これは、業務上の分岐を表す `Result` と、業務に含まれないインフラ／データ破損を分ける DMMF の失敗分類に合わない。

## 決定

- 業務で予期し、利用者または workflow が分岐する失敗だけを `ResultAsync` の error type に残す。例は `AppointmentConflict`、`FollowUpRequestConflict`、最後の管理者を変更・削除できない制約である。
- SQLite driver の失敗、transaction 中の一意性制約違反、Zod の保存行検証失敗、projection の内部整合性破壊は例外として reject する。`RepositoryError` には変換しない。
- error channel がない reader / resolver / store は `ResultAsync<T, never>` を返す。これは成功値の非同期合成を維持するためであり、インフラ失敗を成功・失敗の業務 contract にしない。
- expected conflict を transaction rollback のため一時的に throw する既存実装は維持する。ただし adapter の error mapper はその conflict だけを typed error として返し、それ以外は元の例外を再 throw する。
- Hono の `app.onError` を予期しない例外の公開境界とする。原因をレスポンスへ含めず、route ごとの `RepositoryError` 分岐は削除する。エラー object を無加工でログへ出さない。

## 契約

```ts
type AppointmentByIdResolver = Readonly<{
  resolveById: (appointmentId: AppointmentId) => ResultAsync<Appointment | undefined, never>;
}>;

type ExaminationStartedStore = Readonly<{
  store: (...events: readonly ExaminationStarted[]) => ResultAsync<void, AppointmentConflict>;
}>;
```

呼び出し側の use case は `RepositoryError` を error union に含めず、`andThen` と `andThrough` によって業務失敗だけを合成する。adapter の rejected promise は `ResultAsync` の error value へ変換されず、Hono error handler まで伝播する。

## 受け入れ条件

1. `RepositoryError` 型と `RepositoryFailure` web 型を削除し、`examples/final/src` の公開 contract に残さない。
2. 壊れた SQLite projection、domain event、follow-up claim は `RepositoryError` ではなく rejection になる。
3. duplicate event ID などの想定外の transaction failure は rejection になり、projection rollback は保たれる。
4. stale appointment / follow-up request と最後の管理者制約は、従来どおり typed `ResultAsync` error として扱える。
5. 予期しない adapter rejection は Hono の top-level handler から原因を公開せず HTTP 500 となる。
6. participant-facing Final の説明は、業務失敗と未知の障害の境界をこの実装と一致させる。

## 非ゴール

- SQLite 障害を再試行する仕組み、監視基盤、ログ基盤を導入しない。
- Hono の 500 本文を変更しない。
- すべての `throw` を除去しない。`assertNever` と transaction rollback のための局所的な throw は残す。
