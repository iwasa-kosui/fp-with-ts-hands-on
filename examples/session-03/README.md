# Session 03: 境界、用途別 ID、PII を守る

Session 02 の状態遷移に、外部入力を検証する境界を加えます。UUID を用途別に Zod brand で分け、検査結果を `safeParse` で検証します。飼い主の氏名、メールアドレス、電話番号は `Sensitive` に包み、JSON と文字列への変換で `[REDACTED]` だけを返します。

```bash
pnpm --filter @fp-with-ts/clinic-session-03 typecheck
pnpm --filter @fp-with-ts/clinic-session-03 test
pnpm --filter @fp-with-ts/clinic-session-03 exercise
```

`typecheck` と `test` は成功します。`exercise` は次に扱う Result、repository、domain event の source がまだ存在しないため、意図的に失敗します。この session では neverthrow を導入しません。
