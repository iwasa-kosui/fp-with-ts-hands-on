# Session 02: 状態を型にする

このディレクトリは Session 02 の開始スナップショットです。解答は `examples/session-03/src` にあります。

会計済み・キャンセル済みの来院を戻せず、キャンセルには理由を残すという不変条件を、`src/domain/appointment/` で型にします。

```bash
pnpm --filter @fp-with-ts/clinic-session-02 test
pnpm --filter @fp-with-ts/clinic-session-02 exercise
```

`pnpm exercise` は4つの業務上の不変条件について、意図した assertion failure で始まります。
