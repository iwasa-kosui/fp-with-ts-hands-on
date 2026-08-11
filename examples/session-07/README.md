# Session 07: 意味の違う値を分ける

## 開始状態

外部入力は検証できますが、ペット ID と飼い主 ID はどちらも `string` で取り違えられます。

## この回で変える関数

`OwnerId.parse` と `PetId.parse` を使い、用途別の ID を作ります。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-07 test
pnpm exercise:07
```

通常テストは境界入力を確認し、演習は PII の出力保護がまだないため意図的に失敗します。

## 次の snapshot

Session 08 で連絡先を `Sensitive` として出力境界から守ります。
