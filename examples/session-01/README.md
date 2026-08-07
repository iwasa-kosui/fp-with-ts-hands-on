# Session 01: 要求の固定

Session 00 で、`string` の状態と optional な項目による legacy 実装が、会計済みの来院を診察中へ戻せる事故を起こすことを分析しました。

この Session では、来院の状態、終端状態、キャンセルに必要な情報を要求として固定します。状態モデリングはまだ実装していないため、legacy 実装は意図的に unsafe のままです。

```bash
pnpm --filter @fp-with-ts/clinic-session-01 test
pnpm --filter @fp-with-ts/clinic-session-01 exercise
```

`pnpm test` は legacy の通常フローと要求スナップショットを確認して成功します。`pnpm exercise` は Session 01 で実装する型付き状態モデルの API を要求するため、意図的に失敗します。
