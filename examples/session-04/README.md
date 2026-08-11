# Session 04: 診察開始を状態遷移として閉じる

`startExamination` は `CheckedIn` だけを受け取ります。表示関数は `assertNever` により、状態を増やしたときの分岐漏れを型検査で検出します。

```bash
pnpm --filter @fp-with-ts/clinic-session-04 typecheck
pnpm --filter @fp-with-ts/clinic-session-04 test
pnpm --filter @fp-with-ts/clinic-session-04 exercise
```

`typecheck` と `test` は成功します。`exercise` は次に扱う診察完了と会計待ちを要求するため、意図的に失敗します。
