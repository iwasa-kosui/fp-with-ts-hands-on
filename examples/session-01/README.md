# Session 01: 状態を型にする

このディレクトリは Session 01 の開始スナップショットです。解答は `examples/session-01-solution/src` にあります。

会計済み・キャンセル済みの来院を戻せず、診察結果の記録前には会計できず、キャンセルには理由を残すという不変条件を、`src/domain/appointment/` で型にします。

```bash
pnpm demo:01
pnpm --filter @fp-with-ts/clinic-session-01 test
pnpm exercise:01
```

デモは `http://localhost:3000` で起動します。画面操作はこの開始スナップショットの遷移関数を呼びます。

`pnpm exercise:01` は5つの型要件について、意図した失敗で始まります。
