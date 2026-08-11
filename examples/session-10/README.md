# Session 10: 成功だけをイベントとして記録する

## 開始状態

失敗理由は値で返せますが、診察開始の成功を業務上の事実として残せません。

## この回で変える関数

`Appointment.startExamination` を編集し、状態だけでなく `AppointmentExaminationStarted` を返します。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-10 test
pnpm exercise:10
```

通常テストは typed error を確認し、演習は成功イベントをまだ組み立てないため意図的に失敗します。

## 次の snapshot

Session 11 で port を通じて use case に副作用を合成します。
