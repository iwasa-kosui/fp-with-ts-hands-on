# Session 02: 予約の状態の分岐漏れを型で検出する

このディレクトリは Session 01 の解答が入った状態から始める、Session 02 の開始スナップショットです。解答は `examples/session-02-solution/src` にあります。

遷移関数は Session 01 の解答のとおり、状態型で入口を絞っています。`src/domain/appointment/statusLabel.ts` の表示名の分岐が、未知の状態を見逃さないようにします。

```bash
pnpm demo:02
pnpm --filter @fp-with-ts/clinic-session-02 typecheck
pnpm --filter @fp-with-ts/clinic-session-02 test
pnpm exercise:02
```

デモは `http://localhost:3000` で起動します。

`typecheck` と `test` は成功します。`pnpm exercise:02` は、表示名の分岐が状態の追加を検出できない1件の型要件について、意図した失敗で始まります。
