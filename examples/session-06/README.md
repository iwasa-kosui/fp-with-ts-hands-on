# Session 06: キャンセルと終端状態

開始状態です。この回では状態モデルを変更しません。次の Session 07 で外部入力を検証する境界を追加します。

## 事故

診察中や会計済みの来院をキャンセルできると、処置や会計を取り消すための別の業務判断を見落とします。終わった来院を通常フローへ戻すことも防ぐ必要があります。

## 守る不変条件

キャンセルできるのは `Scheduled` または `CheckedIn` だけです。`Paid` と `Canceled` は終端状態として扱います。

## 採用する技法と限界

`cancel` の引数を許可された状態の union に絞り、`isTerminal` を `Paid | Canceled` へ絞り込む type guard にします。これはキャンセル理由の妥当性や、外部から来る入力値の検証までは保証しません。

## 検証と振り返り

```bash
pnpm --filter @fp-with-ts/clinic-session-06 typecheck
pnpm --filter @fp-with-ts/clinic-session-06 test
pnpm --filter @fp-with-ts/clinic-session-06 exercise
```

通常テストでは、受付済みのキャンセル、診察中のコンパイル時拒否、`Paid` と `Canceled` の終端判定を確認します。演習は、外部からの不正な UUID をまだ拒否できないため意図的に失敗します。自分の業務で、終了後に戻してはいけない状態を一つ探してください。
