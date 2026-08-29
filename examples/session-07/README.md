# Session 07: ラボ結果到着

S2〜S6 の解答と回帰テストを統合した、非公開スナップショットです。S5 の同期 `startExamination` は `Result` の契約を維持し、S6 の `startExaminationWithEffects` は `ResultAsync` と `andThrough` で効果を接続します。`Clock` と `EventIdGenerator` で非決定値を外へ出し、状態と監査記録を `store(event)` 1回で保存します。

予約なし、状態不正、予約競合は、利用側が判断できる業務上の失敗として `Result` の `Err` に残します。保存障害や破損データは業務上の失敗ではないため、catchして `Err` へ詰め直しません。外側のアプリケーション境界で安全な情報だけを記録し、詳細を含まない500応答へ変換します。

## 次のワークフロー

ラボ結果到着は、診察開始の続きとして同じ入力へ足す処理ではありません。外部ラボから結果を受信したことを trigger にする別ワークフローです。入力境界、起こりうる業務失敗、出力イベント、副作用を個別に定義し、`startExaminationWithEffects` へ混ぜません。このスナップショットにある診察開始の解答は、次のワークフローを考える前に当日の到達点を固定するためのものです。

```bash
pnpm demo:07
pnpm --filter @fp-with-ts/clinic-session-07 typecheck
pnpm --filter @fp-with-ts/clinic-session-07 test
```

デモは `http://localhost:3000` で起動し、Clock・EventIdGenerator・原子的な `store(event)` を注入した到達点を操作できます。
