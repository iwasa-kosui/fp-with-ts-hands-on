# Task 4 実装レポート

## 概要

予約登録、予約変更、担当獣医師の再割当、飛び込み受付を、同一の予約集約と SQLite のスケジュール不変条件へ接続した。Task 3 の version 付き予約 projection と legacy migration、Task 2 の機微監査 payload 分離と全文保存は維持した。前受金登録、最終精算、予約詳細の拡張、受付ボード本体は Task 5 の範囲として実装していない。

## 変更内容

- `appointment.updated`、`appointment.walk-in-registered`、`appointment.veterinarian-reassigned` を追加した。
- `Scheduled` の全項目変更、`Scheduled | CheckedIn` の担当医再割当、直接 `CheckedIn` になる飛び込み受付を純粋な状態遷移として追加した。
- `UpdateAppointmentUseCase`、`RegisterWalkInUseCase`、`ReassignAppointmentVeterinarianUseCase`、全ロール向けの専用 `ListVeterinariansUseCase` を追加した。
- 予約登録でも担当獣医師の存在と `Veterinarian` role を検証するようにした。
- SQLite event store に半開区間の担当医重複判定、immediate transaction、typed conflict、`busy_timeout = 5000` を追加した。
- 予約登録・変更の共通フォーム、予約変更ページ、飛び込み受付ページを追加し、固定診療メニューと既定所要時間を接続した。
- `GET/POST /appointments` に加えて、予約変更、担当医再割当、飛び込み受付の Hono route を追加した。
- 既知の clinicFlow 302/303 回帰は、差し替えアプリにもテスト harness の clock を注入し、認証前段の期限切れ 302 を防いで解消した。

## RED

- domain test は `Appointment.update`、`Appointment.registerWalkIn`、`Appointment.reassignVeterinarian` が存在しないため 3 件失敗した。
- use case test は新規 4 module が存在しないため suite が失敗した。
- 担当獣医師が存在しない予約登録は、実装前には成功してしまうことを確認した。
- SQLite focused RED は 8 ケース中 4 ケースが失敗した。失敗したのは 10:29 開始の重複、既存 `Scheduled`、既存 `CheckedIn`、別接続からの並行重複登録である。除外対象 4 状態は既存時点でも重複を妨げなかった。
- UI focused RED は新規 Edit/WalkIn module が存在しないため失敗した。
- route 配線前は `/appointments/new` が 500 になり、配線不足を再現した。

## GREEN

- domain focused: 15/15 PASS。
- use case focused: 14/14 PASS。
- SQLite overlap focused: 8/8 PASS。
- SSR/UI focused: 16/16 PASS。
- clinicFlow: 4/4 PASS。予約変更、再割当、飛び込み受付、fresh event identity、機微分類を統合経路で確認した。
- Task 4 focused 全体: 84/84 PASS。

## 重複判定マトリクス

| 条件 | 結果 |
| --- | --- |
| 同じ担当医、10:00–10:30 と 10:29–10:44 | `VeterinarianScheduleConflict` |
| 同じ担当医、10:00–10:30 と 10:30 開始 | 許可 |
| 候補の担当医が `null` | 許可 |
| 既存の担当医が `null` | 対象外 |
| 既存 `Scheduled` | 拒否 |
| 既存 `CheckedIn` | 拒否 |
| 既存 `InExamination` | 許可 |
| 既存 `AwaitingPayment` | 許可 |
| 既存 `Paid` | 許可 |
| 既存 `Canceled` | 許可 |
| 予約変更時の同一 appointment ID | 自分自身を除外 |
| file DB の別接続から同時間帯へ並行登録 | 1 件成功、1 件 typed conflict |

競合時は projection と監査 event の両方を rollback し、エラーには候補と競合相手の appointment ID だけを保持する。自由記述、飼い主名、ペット名は含めない。

## version と保存条件

- 予約変更と担当医再割当は `expectedVersion` を必須にした。
- use case は resolved state の version と `expectedVersion` を store 呼び出し前に比較する。
- SQLite は予約変更を `status = Scheduled AND version = expectedVersion`、再割当を `status IN (Scheduled, CheckedIn) AND version = expectedVersion` で更新する。
- 飛び込みは作成操作として version 1 で直接 `CheckedIn` を保存する。
- event ID は各 mutation で generator から新規生成する。
- 新イベントも機微情報を含む unknown event として機微 payload table へ aggregate state と event payload の全文を保存し、通常 payload table へ複製しない。

## 認可と入力境界

- すべての追加 route は actor と管理権限を確認してから path/body を検証する。
- owner/pet 整合、担当獣医師の存在と role、状態、version を store 呼び出し前に検証する。
- HTTP body は Zod で owner、pet、日時、固定診療メニュー、所要時間、担当医、自由記述、version を検証する。
- stale version、担当医重複、変更不可状態、前受後の禁止変更は allowlist された日本語エラーへ写像する。
- 自由記述や PII を query string と typed conflict へ含めない。
- mutation 成功時の予約詳細への redirect は 303 に統一した。

## 日本語 UI

- 新規・変更の共通フォームは、飼い主、ペット、予約日時、診療メニュー、所要時間、担当獣医師、来院理由の順で日本語表示する。
- 固定診療メニューは「一般診療」「再診」「予防接種」「検査・処置」として表示し、内部 value は英語 code のまま維持する。
- 飛び込み受付は予約日時を入力させず、受付メモを追加する。
- 担当医未定、validation、schedule conflict、version conflict、変更不可を日本語で表示する。
- 診療メニュー変更時の既定所要時間は、利用者が所要時間を手動変更する前だけ提案する。

## 全検証

- `pnpm --filter @fp-with-ts/clinic-final exec vitest run test/domain/appointment.test.ts test/useCase/appointmentUseCases.test.ts test/adaptor/sqliteEventStore.test.ts test/web/clinicFlow.test.ts test/web/operatorConsolePages.test.tsx`: 5 files、84 tests PASS。
- `pnpm --filter @fp-with-ts/clinic-final typecheck`: PASS。
- `pnpm --filter @fp-with-ts/clinic-final test`: 25 files、251 tests PASS。
- `pnpm --filter @fp-with-ts/clinic-final build`: client、SSR、app artifact、built entry smoke PASS。
- `pnpm typecheck`: 全 examples、docs、worker PASS。Astro diagnostics は error 0、warning 0、hint 0。
- `pnpm test`: 全 examples と docs PASS。final 251 tests、docs 83 tests を含む。
- `pnpm build`: 全 examples と docs PASS。docs は 10 HTML と 10 internal routes の静的 build 検証を通過した。

## SHA

- 開始 SHA: `a59ac5c29a58eaf11a87919e95e3ebb3ee706117`
- Task 4 完了 SHA: 本レポートを含むコミットのため、コミット後の完了応答に記載する。

## 残課題

- Task 5 の受付ボード、受付メモ更新、事前会計、最終精算、予約詳細拡張は未着手。
- Task 4 の受け入れ条件に対する未解決事項はない。
