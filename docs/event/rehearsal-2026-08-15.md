# DMMFワークフローカリキュラム 自動リハーサル記録

計画日: 2026-08-15

カリキュラム同期日: 2026-08-16（Asia/Tokyo）

この文書は、自動化できるリリース検証と、現地・人間によるリハーサルが必要な項目を分けて記録する。自動検証の成功を、人間が参加する進行リハーサルの成功とは扱わない。

## 現行の運営契約

- 内容時間は S0 10分 + S1 15分 + S2〜S5 各30分 + Final 5分 = 150分である。
- 16:25-16:55の固定休憩30分を加え、開催時間は15:00-18:00の180分である。
- S0は現行業務、画面操作、保存・ログと事故を対応付ける。
- S1は紙面またはページ上のワークフローカードを使い、ビジネスイベントから診察開始ワークフローを班で描く。実行可能な演習ではない。
- S2〜S5はワークフローカードの current state、input、expected failures、output event / side effects に残ったリスクを1回に1つずつ実装する。
- 公開する演習コマンドは `pnpm exercise:02`、`pnpm exercise:03`、`pnpm exercise:04`、`pnpm exercise:05` の4本だけである。

## Worker配信契約のRED→GREEN

`worker/routes.test.ts`、`worker/index.test.ts`、`worker/config.test.ts` をproduction変更より先に更新した。最初の実行では、以前の正規URL 5件がAssetsへ委譲されて200相当になり、`wrangler.jsonc` の `assets.run_worker_first` にも含まれない正しいREDを確認した。

ルーティング表とworker-first設定を更新し、以前の正規URLは次の新しい正規URLへ直接HTTP 308で遷移する。静的ホスティングはこれらのredirectを迂回しない。

| 以前の正規URL | Status | Location |
| --- | ---: | --- |
| `/sessions/00-onboarding/` | 308 | `/sessions/00-system-handover/` |
| `/sessions/01-state-modeling/` | 308 | `/sessions/02-state-transitions/` |
| `/sessions/02-boundary-and-ids/` | 308 | `/sessions/03-boundaries-and-semantic-values/` |
| `/sessions/03-result-errors/` | 308 | `/sessions/04-workflow-errors/` |
| `/sessions/04-effects-and-events/` | 308 | `/sessions/05-effects-and-consistency/` |

これより前に退役したSession 00、Session 04、Session 05の互換routeも残し、中間の旧URLを経由せず対応する新正規URLへ直接遷移させる。focused Worker suiteは3 files / 45 testsでGREENになった。

## 4演習の意図したRED

S0、S1、到達点 `examples/session-06`、Finalにはexercise scriptを設けない。存在しないscriptを実行してmissing-scriptを正常系と誤認する検査は行わない。

| コマンド | 参加者ステップ | 意図した開始時のRED |
| --- | ---: | --- |
| `pnpm exercise:02` | 4 | 状態遷移と網羅性の業務名付き `AssertionError` |
| `pnpm exercise:03` | 2 | 外部JSONとPIIマスクの業務名付き `AssertionError` |
| `pnpm exercise:04` | 3 | 状態不正、予約なし、同期Result pipelineの業務名付き `AssertionError` |
| `pnpm exercise:05` | 4 | 決定性、single store、ResultAsync、保存失敗の業務名付き `AssertionError` |

4コマンドとも、module resolution、syntax、type setupの失敗や予期しない例外ではなく、各starterの未解決条件を示すREDであることを確認対象とする。

## 次snapshotのGREEN連鎖と解答表示

- S2の解答は `examples/session-03`、S3は `examples/session-04`、S4は `examples/session-05` の同一相対pathを参照する。
- S5は `examples/session-06` の全target完成ファイルを反映した後に、型検査・通常回帰・exerciseをまとめてGREENにする。1stepずつの個別GREENは約束しない。
- `examples/session-06` はS2〜S5の全回帰を含む到達点である。
- `examples/final` はFinalの5分間に講師が案内する参照実装であり、参加者はセットアップや編集を行わない。

## 公開route・旧語・変更境界の監査

- 公開セッションは `/sessions/00-system-handover/`、`/sessions/01-business-events-and-workflows/`、`/sessions/02-state-transitions/`、`/sessions/03-boundaries-and-semantic-values/`、`/sessions/04-workflow-errors/`、`/sessions/05-effects-and-consistency/`、`/sessions/final/` である。
- トップページ、404、セッション間CTA、参加者向け資料は新しい正規URLだけを案内する。
- 旧正規URL文字列は、上の互換redirect表、Worker実装、対応testにだけ残す。
- S5の教材実装とFinal参照実装は、この資料・redirect同期では変更しない。

## 30日後フォローアップの準備状態

[運用手順](./follow-up-30-days.md)にPRDの4設問、主催者/運営責任者、D+30の一斉連絡、回答締切、匿名集計を定義した。設問と送付方法は準備済みである。実送付は開催後のため未実施である。

## 未確認（現地・人間のリハーサルが必要）

- S1の15分で、班がワークフローカードの6欄を診察開始の業務語彙で埋められるか。
- エージェントを使わない参加者が、S5の全target完成ファイルを委譲時間内に反映できるか。
- 5人班で7分版と8分版の相互レビューが回り、問い1で沈黙が起きないか。
- 班数分の外部display、HDMI、USB-C adapter、電源があるか。班数と参加人数も未確認である。
- review対象になる心理的負担と、明確に拒否する参加者をどう扱うか。

上の実測が終わるまでは、班ワーク、相互レビュー、手動fallbackを成功済みと記録しない。
