# Session 02: 状態を型にする

このディレクトリは Session 02 の開始スナップショットです。解答は `examples/session-03/src` にあります。

会計済み・キャンセル済みの来院を戻せず、診察結果の記録前には会計できず、キャンセルには理由を残すという不変条件を、`src/domain/appointment/` で型にします。

```bash
pnpm demo:02
pnpm --filter @fp-with-ts/clinic-session-02 test
pnpm exercise:02
```

デモは `http://localhost:3000` で起動します。画面操作はこのstarterの遷移関数を呼びます。

`pnpm exercise:02` は5つの型要件について、意図した失敗で始まります。
