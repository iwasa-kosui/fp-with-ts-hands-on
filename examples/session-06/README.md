# Session 06: 副作用を外に出す

このディレクトリは Session 06 の開始スナップショットです。S5 の同期 `startExamination` と `Result` の回帰契約を保ったまま、S6 用の `startExaminationWithEffects` に残した非決定値と dual-write を観察します。`Appointment.startExamination(context)(checkedIn, veterinarianId)` はドメイン側へ配布済みで、演習では `src/useCase` だけを編集します。解答は `examples/session-07/src/useCase` にあります。

```bash
pnpm demo:06
pnpm --filter @fp-with-ts/clinic-session-06 typecheck
pnpm --filter @fp-with-ts/clinic-session-06 test
pnpm exercise:06
```

デモは `http://localhost:3000` で起動し、`startExaminationWithEffects` の非決定値と2回書き込みを実際のrouteから実行します。

`typecheck` と `test` は成功します。`exercise` は `startExaminationWithEffects` にある `Date` / `randomUUID` の直接呼び出しと、状態・監査記録の2回書き込みを4件の業務名付き assertion failure として再現します。S5 の `startExamination` は変更せず、S6 の効果付き経路だけを改善します。
