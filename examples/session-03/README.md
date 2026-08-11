# Session 03: 状態ごとに必要な情報を表す

## 事故

状態名が決まっていても、受付時刻や担当医なしに「診察中」の予約を作れてしまうと、後続の業務判断が壊れます。

## 守る不変条件

`Scheduled`、`CheckedIn`、`InExamination` はそれぞれ必要な情報を持ちます。特に診察中には受付時刻、担当医、診察開始時刻が必須です。

## 採用する技法と限界

`kind` を判別子にした union で、不正な状態の組み立てを型で見つけます。ただし、この snapshot はまだ遷移関数を狭めていないため、どの状態から診察を始められるかは防げません。

## 検証と振り返り

```bash
pnpm --filter @fp-with-ts/clinic-session-03 typecheck
pnpm --filter @fp-with-ts/clinic-session-03 test
pnpm --filter @fp-with-ts/clinic-session-03 exercise
pnpm --filter @fp-with-ts/clinic-session-03 typecheck:exercise
```

通常の検証は成功します。演習は `startExamination` がないため意図的に失敗します。状態名だけでは不足する、各状態固有の業務情報を一つ書き出してください。
