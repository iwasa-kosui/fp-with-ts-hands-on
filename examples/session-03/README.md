# Session 03: 診察開始の識別子を型で区別する

このディレクトリはSession 03の開始スナップショットです。解答は `examples/session-04/src` にあります。

S1で決めた「どの予約を、どの獣医師が開始するか」という入力を扱います。PetId、OwnerId、ExamIdは用途別の型として配布済みです。これらを手本に、AppointmentIdとVeterinarianIdを区別し、予約状態と `startExamination` まで同じ型を使います。

```bash
pnpm demo:03
pnpm --filter @fp-with-ts/clinic-session-03 typecheck
pnpm --filter @fp-with-ts/clinic-session-03 test
pnpm --filter @fp-with-ts/clinic-session-03 exercise
```

デモは `http://localhost:3000` で起動します。

`typecheck` と `test` はS2の回帰を確認します。`exercise` は次の3段が未実装であることを示します。

1. AppointmentIdとVeterinarianIdを相互に代入できる
2. 予約状態と `startExamination` にstringが残っている
3. 取り違えを止める型テストがない

PetId、OwnerId、ExamIdをさらに比較したい場合は、時間外の補足として `src/domain/pet/petId.ts`、`src/domain/owner/ownerId.ts`、`src/domain/examResult/examId.ts` を読みます。
