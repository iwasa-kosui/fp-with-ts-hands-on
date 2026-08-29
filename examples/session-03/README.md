# Session 03: 識別子を型にする

このディレクトリは Session 03 の開始スナップショットです。解答は `examples/session-04/src` にあります。

S2 の解答を保ったまま、`src/domain/` で用途の違う識別子を別々の型にし、予約の状態と遷移へ適用します。`ExamId` と `AppointmentId` と `VeterinarianId` は手本として配布済みです。

```bash
pnpm demo:03
pnpm --filter @fp-with-ts/clinic-session-03 typecheck
pnpm --filter @fp-with-ts/clinic-session-03 test
pnpm --filter @fp-with-ts/clinic-session-03 exercise
```

デモは `http://localhost:3000` で起動し、型で絞った状態遷移をHono routeから呼びます。

`typecheck` と `test` は S2 の回帰を確認します。`exercise` は識別子の取り違えを止められないことを3件の assertion failure で示します。
