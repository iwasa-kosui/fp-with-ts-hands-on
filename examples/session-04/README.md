# Session 04: 診察開始を状態遷移として閉じる

## 事故

予約済みのまま診察を開始できると、受付という業務上の確認を飛ばします。また、状態を追加したとき表示が抜けても気付きにくくなります。

## 守る不変条件

`startExamination` が受け取れるのは `CheckedIn` だけです。表示は既知の全状態を扱います。

## 採用する技法と限界

遷移元を関数引数で絞り、`assertNever` を使って表示の分岐漏れを型検査します。これは会計完了までの順序や入力値の正しさを検証するものではありません。

## 検証と振り返り

```bash
pnpm --filter @fp-with-ts/clinic-session-04 typecheck
pnpm --filter @fp-with-ts/clinic-session-04 test
pnpm --filter @fp-with-ts/clinic-session-04 exercise
pnpm --filter @fp-with-ts/clinic-session-04 typecheck:exercise
```

通常の検証は成功します。演習は会計待ちの契約がまだないため意図的に失敗します。自分の業務で、前提状態を確認せずに実行できてしまう操作を一つ探してください。
