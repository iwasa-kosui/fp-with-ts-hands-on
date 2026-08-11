# Session 01: 守るべき不変条件を固定する

## 開始状態

Session 00 の legacy 実装は状態を任意の文字列で持つため、会計済みの来院を戻せます。

## この回で変える関数

この回は要求をテストで固定します。状態モデルの実装は次の snapshot で扱います。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-01 test
pnpm exercise:01
```

通常テストは要求の記録を確認し、演習は状態モデルがまだないため意図的に失敗します。

## 次の snapshot

Session 02 で、業務状態の語彙を一箇所に固定します。
