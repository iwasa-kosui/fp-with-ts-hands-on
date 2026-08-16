# Session 04: 副作用を外に出す

このディレクトリは Session 04 の開始スナップショットです。S3 の同期 `startExamination` と `Result` の回帰契約を保ったまま、S4 用の `startExaminationWithEffects` に残した非決定値と dual-write を観察します。`Appointment.startExamination(context)(checkedIn, veterinarianId)` はドメイン側へ配布済みで、演習では `src/useCase` だけを編集します。解答は `examples/session-05/src/useCase` にあります。

```bash
pnpm --filter @fp-with-ts/clinic-session-04 typecheck
pnpm --filter @fp-with-ts/clinic-session-04 test
pnpm --filter @fp-with-ts/clinic-session-04 exercise
```

`typecheck` と `test` は成功します。`exercise` は `startExaminationWithEffects` にある `Date` / `randomUUID` の直接呼び出しと、状態・監査記録の2回書き込みを4件の業務名付き assertion failure として再現します。S3 の `startExamination` は変更せず、S4 の効果付き経路だけを改善します。
