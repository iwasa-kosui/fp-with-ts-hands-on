# Session 05: 会計待ちを独立した状態にする

診察完了後は `AwaitingPayment` へ進め、会計はその状態からだけ記録します。これにより、診察中に会計を済ませる操作を型で防ぎます。

```bash
pnpm --filter @fp-with-ts/clinic-session-05 typecheck
pnpm --filter @fp-with-ts/clinic-session-05 test
pnpm --filter @fp-with-ts/clinic-session-05 exercise
```

`typecheck` と `test` は成功します。`exercise` は次に扱うキャンセルと終端状態を要求するため、意図的に失敗します。
