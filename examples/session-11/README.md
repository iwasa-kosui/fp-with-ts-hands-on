# Session 11: use case で副作用を合成する

## 開始状態

成功イベントは純粋に作れますが、予約の読み込みと保存を外部技術から切り離して合成できません。

## この回で変える関数

`StartExaminationUseCase.create` と `StartExaminationUseCase.run` を編集し、resolver と store port を `ResultAsync` でつなぎます。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-11 test
pnpm exercise:11
```

通常テストは成功イベントを確認し、演習は use case がまだ合成されないため意図的に失敗します。

## 次の snapshot

Session 12 で、同じ契約を原子保存へ進めます。
