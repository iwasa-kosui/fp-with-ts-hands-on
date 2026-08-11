# Session 10: 予期可能な失敗を値にする

解答済みのスナップショットです。入力 Schema の失敗とは別に、予約が見つからないことと、受付済みでないことを判別可能な値として返します。次の Session 11 で、成功した状態変更だけをイベントとして組み立てます。

## 事故

`undefined` や例外で失敗を返すと、呼び出し元は画面で何を伝えるか、次に何をするかを判断できません。

## 守る不変条件

診察を始める前に、予約が存在し、状態が `CheckedIn` でなければなりません。失敗は `StartExaminationError.kind` で区別でき、失敗からイベントは作りません。

## 採用する技法と限界

`Result` と判別共用体で、見つからない予約と不正な状態を値として返します。これは予約の読み込み、保存、非同期処理、成功イベントの記録までは扱いません。

## 検証と振り返り

```bash
pnpm --filter @fp-with-ts/clinic-session-10 typecheck
pnpm --filter @fp-with-ts/clinic-session-10 test
pnpm --filter @fp-with-ts/clinic-session-10 exercise
```

通常テストは、存在と状態の失敗理由を区別できることを確認します。演習は成功イベントをまだ組み立てないため意図的に失敗します。自分の業務で、`undefined` だけでは利用側が判断できない失敗を一つ探してください。
