# Session 06: 副作用を外に出す

このディレクトリは Session 06 の開始スナップショットです。S04 の同期 `startExamination` と `Result` の回帰契約を保ったまま、S06 用の `startExaminationWithEffects` に残した非決定値（呼ぶたびに変わる時刻とイベント ID）と dual-write（状態と監査記録を2つの保存処理で別々に書くこと）を観察します。`Appointment.startExamination(context)(checkedIn, veterinarianId)` はドメイン側へ配布済みで、演習では `src/useCase` だけを編集します。解答は `examples/session-06-solution/src/useCase` にあります。

```bash
pnpm demo:06
pnpm --filter @fp-with-ts/clinic-session-06 typecheck
pnpm --filter @fp-with-ts/clinic-session-06 test
```

S06 の演習は、ブラウザの演習の画面で、誤った変更を検出する仕組みを足します。

デモは `http://localhost:3000` で起動し、`startExaminationWithEffects` の非決定値と2回書き込みを実際のrouteから実行します。

`typecheck` と `test` は成功します。S04 の `startExamination` は変更せず、S06 の効果付き経路だけを改善します。
