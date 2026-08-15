# P1 budget correction report

## 結果

session-04 の S3 同期 `Result` 解答と S4 weak starter が持っていた別ファイル実装を統合した。`resultDependencies.ts` と `startExaminationResult.ts` は削除し、次の3ファイルだけで S3 解答と S4 starter を表す。

- `dependencies.ts`: 同期 pipeline の `Dependencies` と effect wrapper の `EffectsDependencies` が resolver / transition の型を共有する。
- `errors.ts`: `AppointmentNotFound` / `InvalidAppointmentState` / `RepositoryError` と Result helper を共有する。
- `startExamination.ts`: `startExamination` が同期 Result pipeline、`startExaminationWithEffects` が `Date` / `randomUUID` / dual-write を残した S4 starter を担う。

session-04 の regression と exercise は同じ実在モジュールを static import する。Code Explorer の visible paths から削除した2ファイルを除き、実在構成へ同期した。

## 差分予算

`git diff --no-index --unified=0` の追加・変更後行から、空行とコメントのみの行を除外して計測した。

| Exercise | 比較 | Files | Effective lines | Gate |
| --- | --- | ---: | ---: | --- |
| S1 | session-01 → session-02 `src/domain/appointment` | 2 | 35 | PASS |
| S2 | session-02 → session-03 `src/boundary` | 2 | 24 | PASS |
| S3 | session-03 → session-04 `src/useCase` | 3 | 77 | PASS |
| S4 | session-04 → session-05 `src/useCase` | 3 | 35 | PASS |

S3 は修正前の 5 files / 106 effective lines から 3 files / 77 effective lines へ縮約した。S3 の内訳は `dependencies.ts` 11行、`errors.ts` 13行、`startExamination.ts` 53行。全 exercise が絶対上限 5 files / 80 effective lines 以下である。

## 教材契約

- S3 solution は `Result`、`andThen`、`Readonly` な依存型を維持する。予約未検出と状態不正を値で返し、失敗後の transition / save は0回。
- S4 starter は教材上の意図的弱点として `new Date()`、`crypto.randomUUID()`、state / event の dual-write を維持する。
- S4 exercise は固定 clock / ID、単一 store、pipeline の aggregate state、保存失敗時の原子性という4契約を assertion failure で示す。
- session-05 は S3 / S4 の全回帰契約を維持する。

## 検証

- `pnpm --filter @fp-with-ts/clinic-session-03 exercise`: intended RED。4 tests 中3件が assertion failure、1件が成功。module resolution error なし。
- `pnpm --filter @fp-with-ts/clinic-session-04 test`: 3 files / 14 tests passed。
- `pnpm --filter @fp-with-ts/clinic-session-04 typecheck`: exit 0。
- `pnpm --filter @fp-with-ts/clinic-session-04 exercise`: intended RED。4 tests / 4件が assertion failure。module resolution error なし。
- `pnpm --filter @fp-with-ts/clinic-session-05 test`: 5 files / 20 tests passed。
- `pnpm --filter @fp-with-ts/clinic-session-05 typecheck`: exit 0。
- `pnpm --filter @fp-with-ts/docs test`: 22 files / 83 tests passed。
- `pnpm --filter @fp-with-ts/docs build`: Astro check / build / static verification 成功。10 HTML / 10 routes。
- `pnpm typecheck`: exit 0。
- `pnpm test`: session-00〜05 と docs の全 normal test が成功。
- `pnpm build`: exit 0。10 HTML / 10 routes。
- `git diff --check`: exit 0。

## 変更境界

- 変更: `examples/session-04/src/useCase/**`、同 regression / exercise import、`apps/docs/src/code-explorer/session-workspaces.ts`、本 report。
- diff なし: `examples/final/**`、`worker/**`、`docs/prd/**`、session catalog。
- push は実施しない。
