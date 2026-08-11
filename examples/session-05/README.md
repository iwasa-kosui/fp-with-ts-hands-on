# Session 05: 会計待ちと終端状態を分ける

## 事故

診察中に会計を記録できると、診察完了の情報が残りません。また、診察中の来院をキャンセルできると、診療中断の判断を見落とします。

## 守る不変条件

会計は `AwaitingPayment` からだけ記録します。キャンセルできるのは `Scheduled` または `CheckedIn` だけで、`Paid` と `Canceled` は終端状態です。

## 採用する技法と限界

状態を増やし、関数引数を union で狭め、`isTerminal` を type guard にします。これは金額の妥当性、キャンセル理由の内容、外部入力の形式までは保証しません。

## 検証と振り返り

```bash
pnpm --filter @fp-with-ts/clinic-session-05 typecheck
pnpm --filter @fp-with-ts/clinic-session-05 test
pnpm --filter @fp-with-ts/clinic-session-05 exercise
pnpm --filter @fp-with-ts/clinic-session-05 typecheck:exercise
```

通常の検証とキャンセル演習は成功します。演習の `@ts-expect-error` は診察中のキャンセルをコンパイル時に拒否することも確かめます。型だけで判断できない業務ルールを一つ挙げてください。
