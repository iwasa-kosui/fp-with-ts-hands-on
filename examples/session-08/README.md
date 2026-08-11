# Session 08: PII を出力境界で守る

## 開始状態

値の意味は区別できても、飼い主の電話番号が JSON やログへ露出します。

## この回で変える関数

`OwnerContact.parse` を編集し、電話番号を直接の文字列ではなく秘匿値として保持します。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-08 test
pnpm exercise:08
```

通常テストは branded value を確認し、演習は PII を隠せないため意図的に失敗します。

## 次の snapshot

Session 09 で、予期可能な業務上の失敗を値として返します。
