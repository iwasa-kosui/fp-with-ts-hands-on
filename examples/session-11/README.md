# Session 11: use case で副作用を合成する

開始状態です。診察開始の成功イベントは純粋に作れますが、予約の読み込みと保存を HTTP や DB から切り離して合成する use case はまだありません。次の Session 12 が、この回の解答済み snapshot です。

## 事故

読み込み、業務判断、保存を controller や repository に埋め込むと、失敗時にどこまで処理されたかを確認できず、保存を伴わない業務判断のテストも難しくなります。

## 守る不変条件

外部入力を検証してから予約を一度解決し、存在と `CheckedIn` を確認した成功時だけイベントを作り、一つの `ExaminationStartedStore` へ渡します。途中の失敗では store を呼びません。

## この回で変える関数

- `StartExaminationUseCase.run`
- `StartExaminationUseCase.create`

`AppointmentResolver` と `ExaminationStartedStore` は用途を一つに絞った port とします。`ResultAsync` による合成は、store 内部の原子性や stale state の競合までは守りません。

## 検証と次の snapshot

```bash
pnpm --filter @fp-with-ts/clinic-session-11 typecheck
pnpm --filter @fp-with-ts/clinic-session-11 test
pnpm --filter @fp-with-ts/clinic-session-11 exercise
```

通常テストは純粋な成功イベントまでを確認します。演習は非同期 port を合成する use case がないため意図的に失敗します。Session 12 では同じ契約が通常テストとして成功します。
