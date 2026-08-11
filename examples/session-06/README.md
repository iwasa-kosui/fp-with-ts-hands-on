# Session 06: 状態モデルの次に入力境界を置く

## 事故

状態遷移を型で閉じても、外部 API やフォームから不正な ID・時刻・状態が `string` として入れば、モデルへ不正な入力を渡せます。

## 守る不変条件

状態モデルへ渡す前に、信頼できない入力の形と値を検証します。この snapshot は、その必要性を演習として明示するだけで、まだ入力検証を実装しません。

## 採用する技法と限界

状態 union と遷移関数は内部状態の順序を守りますが、外部入力を安全にする技法ではありません。次の session で境界の検証を追加します。

## 検証と振り返り

```bash
pnpm --filter @fp-with-ts/clinic-session-06 typecheck
pnpm --filter @fp-with-ts/clinic-session-06 test
pnpm --filter @fp-with-ts/clinic-session-06 exercise
pnpm --filter @fp-with-ts/clinic-session-06 typecheck:exercise
```

通常の検証は成功します。演習は入力境界が未実装のため意図的に失敗します。自分のシステムで、最初に検証すべき外部入力を一つ選んでください。
