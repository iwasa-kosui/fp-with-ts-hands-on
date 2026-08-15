# 新カリキュラム 自動リハーサル記録

計画日: 2026-08-15

自動検証実施日: 2026-08-16（Asia/Tokyo）

対象ブランチ: `main-a5cflu`

検証開始時の実装: `3711938`（旧教材URLの Worker 配信設定を含む）

この文書は、自動化できるリリース検証と、現地・人間によるリハーサルが必要な項目を分けて記録する。自動検証の成功を、人間が参加する進行リハーサルの成功とは扱わない。

## リリース判断の要約

- 自動ゲートは成功した。通常の型検査・テスト・build、28件の視覚/E2E検証、4演習の意図したRED、次snapshotのGREEN連鎖、差分予算、Final凍結を確認した。
- 旧Session 04/05の4 URLは、ローカルWranglerでredirect追従を無効にして、すべて `308` と正しい `Location` を返した。新Session 04は `200` を返した。
- post-auditでS4の解答適用契約を修正し、catalogを3ファイル・72実効行へ較正した。S1〜S4はいずれも絶対上限5ファイル・実効80行以内である。
- [30日後フォローアップ運用手順](./follow-up-30-days.md)にPRDの4設問、担当、D+30送付、回答導線、匿名集計を定義した。設問と送付方法は準備済みである。実送付は開催後のため未実施である。
- 現地・人間のリハーサル5項目は未確認である。したがって、イベント運営まで含めた準備完了とはまだ判定しない。

## 30日後フォローアップの準備状態

[運用手順](./follow-up-30-days.md)はリリース条件「30日後のフォローアップ設問と送付方法が用意されている」を満たす文書成果物である。主催者と運営責任者の役割、D+23からD+38の日程、参加募集に使ったイベント管理サービスの一斉連絡、回答URL、fallback、未回答者を全参加者の分母へ残す集計規則を確認した。

自動検証で確認できるのは文書契約までである。設問と送付方法は準備済みだが、実送付は開催後のため未実施であり、回答率や30日後指標を成功済みとは扱わない。

## Fresh verification

元リハーサルの所要時間は `/usr/bin/time -p` の `real`、post-audit再実行は実行環境のwall timeで計測した。

| コマンド | 結果 | 実測 |
| --- | --- | ---: |
| `pnpm typecheck` | 成功。session-00〜05、docs、Worker。Astro 70 files、0 errors / 0 warnings / 0 hints | review fix再実行 7.2秒 |
| `pnpm test` | 成功。session通常テスト51件、docs実行146件、明示的なWorker実行30件 | review fix再実行 15.0秒 |
| `pnpm --filter @fp-with-ts/docs test` | 24 files / 146 tests成功。event 7件と、docs側で収集されるWorker 30件を含む | review fix再実行 7.1秒 |
| `pnpm build` | 成功。Astro 70 files、0 diagnostics、8 HTML / 8 routes | review fix再実行 29.3秒 |
| `pnpm --filter @fp-with-ts/docs build` | 成功。Astro 70 files、0 diagnostics、8 HTML / 8 routes | review fix再実行 28.7秒 |
| `pnpm --filter @fp-with-ts/docs test:visual` | 28/28成功。更新したhome desktop/mobileを含む | 10.71秒 |
| Worker focused 3 files | 30/30成功（config 10、routes 10、HTTP handler 10） | targeted 6 files / 39 testsで1.88秒 |
| event document contract | 7/7成功。6 sessionの150分、固定3枠30分、合計180分、ADV、review、フォローアップ送付母集団を含む運営文書を照合 | review fix targeted再実行 11ms |

`pnpm test` のdocs実行は現行Vitest設定によりWorker 30件を含み、rootの `test:worker` が同じ30件を明示的に再実行する。fresh summaryのsession内訳 `1 + 2 + 4 + 9 + 14 + 21 = 51` とdocs 146件、明示Worker 30件から、実行回数を `51 + 146 + 30 = 227`、重複を除く契約を `51 + 146 = 197` と自動計算して記録した。明示経路は、docs側のtest対象を将来整理してもCIの `pnpm test` からWorker契約が外れないために残す。

buildでは既知のVite chunk-size warningが出たが、Astro diagnosticsと静的route検証は成功した。視覚検証の最初のsandbox内実行は `0.0.0.0:4321` のlistenが `EPERM` になったため、同じコマンドをローカルserver起動権限付きで再実行し、28件すべての成功を確認した。

## Worker配信契約のRED→GREEN

`worker/config.test.ts` をproduction設定より先に追加した。Vite test harnessでは `import.meta.url` がfile URLではなかったため、最初のharness errorをrepository cwd基準の読み取りへ直してから、次の正しいREDを確認した。

- 旧4 URLが `wrangler.jsonc` の `assets.run_worker_first` にない: 4 assertion failures
- rootの通常テストに明示的なWorker test経路がない: 1 assertion failure

`wrangler.jsonc` にslash有無の4 URLを追加し、既存の `/healthz`、`/module-00`、`/module-00/` は維持した。rootへ `test:worker` を追加し、CIが実行する `pnpm test` から呼び出した。同じconfig testを含むfocused実行は3 files / 25 testsでGREENになった。JSONCは新しい依存を追加せず、文字列内の記号を壊さないcomment/trailing-comma処理を通して読んでいる。

post-auditでは、Worker内に実装済みだった旧Session 00の2 redirectが `run_worker_first` にないことを、全redirect routeのdata-driven契約でREDにした。health、module-00のslash有無、旧Session 00の2 URL、旧Session 04/05の4 URLからなる正確なWorker-first集合を検査し、設定へ不足2 URLを追加した。focused Worker実行は3 files / 30 testsでGREENになり、既存health/module経路も維持した。

ローカルWrangler（`127.0.0.1:8787`）のHTTP smokeは次の通り。redirectは追従していない。

| Path | Status | Location |
| --- | ---: | --- |
| 旧Session 00（break-the-app） | 308 | `/sessions/00-onboarding/` |
| 旧Session 00（read-the-incident） | 308 | `/sessions/00-onboarding/` |
| 旧Session 04（slashなし） | 308 | `/sessions/04-effects-and-events/` |
| 旧Session 04（slashあり） | 308 | `/sessions/04-effects-and-events/` |
| 旧Session 05（slashなし） | 308 | `/sessions/04-effects-and-events/` |
| 旧Session 05（slashあり） | 308 | `/sessions/04-effects-and-events/` |
| `/sessions/00-onboarding/` | 200 | なし |
| `/sessions/04-effects-and-events/` | 200 | なし |

## 4演習の意図したRED

S0と到達点snapshotにはexercise scriptを設けていない。root scriptのキーを読み、存在するのが `exercise:01`〜`exercise:04`だけであることを確認した。存在しないscriptを実行してmissing-scriptを正常系と誤認する検査は行っていない。

| コマンド | Exit | AssertionError | Pass | 実測 | 判定 |
| --- | ---: | ---: | ---: | ---: | --- |
| `pnpm exercise:01` | 1 | 4 | 0 | 4.13秒 | Step 1〜4の型契約。unused `@ts-expect-error` だけでRED |
| `pnpm exercise:02` | 1 | 2 | 2 | 3.25秒 | 不正JSONとPIIマスクがRED。型・readonly回帰はGREEN |
| `pnpm exercise:03` | 1 | 3 | 1 | 2.38秒 | 状態不正、予約なし、失敗理由pipelineがRED。失敗後停止はGREEN |
| `pnpm exercise:04` | 1 | 4 | 0 | 2.37秒 | 決定性、single store、ResultAsync後の値、保存失敗がRED |

4コマンドとも失敗は業務名を持つ `AssertionError` であり、module resolution、syntax、type setupの失敗や予期しない例外はなかった。S1/S2/S3/S4の失敗数はcatalogのstep数 `4 / 2 / 3 / 4` と一致した。

## 次snapshotのGREEN連鎖

| コマンド | Test files / tests | 実測 |
| --- | ---: | ---: |
| `pnpm --filter @fp-with-ts/clinic-session-02 test` | 1 / 4 | 4.38秒 |
| `pnpm --filter @fp-with-ts/clinic-session-03 test` | 2 / 9 | 5.34秒 |
| `pnpm --filter @fp-with-ts/clinic-session-04 test` | 3 / 14 | 5.38秒 |
| `pnpm --filter @fp-with-ts/clinic-session-05 test` | 5 / 21 | 2.26秒 |

session-05はS1〜S4の全回帰に加え、in-memory storeの原子性、内部診断エラーのcause保持、公開エラーのcause・PII非露出を含めて21件すべて成功した。

## 差分予算とFinal凍結

`pnpm --filter @fp-with-ts/docs exec vitest run src/test/examples/exercise-budget.test.ts` は1/1成功（1.67秒）。starterと次snapshotの同一moduleを比較した実測値は次の通り。

| Exercise | Files | Effective lines | 上限 |
| --- | ---: | ---: | ---: |
| S1 | 2 | 35 | 5 files / 80 lines |
| S2 | 2 | 24 | 5 files / 80 lines |
| S3 | 3 | 77 | 5 files / 80 lines |
| S4 | 3 | 72 | 5 files / 80 lines |

`git diff --exit-code b8492ba3895adecf5cb1593a79008c90908f4090 -- examples/final` は差分0で成功した。`examples/final/**` は凍結されている。

## post-audit: S4解答適用とエラー境界

最初に、catalogのS4全targetについて次snapshotの同一相対pathをfull fileでsession-04一時複製へoverlayするテストを書いた。修正前は `startExamination` の同期契約消失、`startExaminationWithEffects` の名前不一致、`Appointment.startExamination` companion不足、store API不一致によりtypecheck・通常回帰・exerciseがREDになった。

session-04へcompanionを事前配布し、session-05をS3同期 `startExamination` とS4非同期 `startExaminationWithEffects` のdual APIへ分けた後、overlayした一時複製はtypecheck、通常回帰14件、exercise 4件をすべてGREENにした。participant module外のsession-04/session-05 companionはbyte-identicalである。

adapterはcause付きの内部 `RepositoryFailure` を返し、use case境界の `mapErr` はcauseなしの新しい `RepositoryError` plain objectを作る。到達点テストは、内部causeが元の `Error` と同一であることと、公開エラーJSONに `cause`、生の例外文言、ownerName、email、phoneがないことを固定した。

StepSolutionはS4の各targetについて、importと後続stepを含む次snapshotの完成ファイルを表示する。「表示された全target fileを反映後、同じexerciseをGREENにする」と明示し、1stepずつの個別GREENは約束しない。表示するcompleted-file集合とoverlay対象集合は完全一致し、target/solutionのpath traversal拒否、全target overlay後のtypecheck・通常回帰・exercise GREENを自動検証した。未確認なのは、エージェントを使わない参加者が8〜10分で全targetを反映できるかであり、現地リハーサルに残す。

review round 1では、Step 4のfake storeへ飼い主名・email・電話番号・固有error message・stackを含む内部causeを渡した。公開エラーはexact `{ kind: "RepositoryError", operation: "ExaminationStartedStore.store" }` で、`cause` propertyとPII・message・stackがJSONへ出ないことを同じparticipant assertionで固定した。`toRepositoryError` が内部failureをspreadする危険mutationでは到達点testが1件REDとなり、安全なplain object生成へ戻すとGREENになった。adapter内部causeは参照同一性を `toBe` で確認した。

## 公開route・旧語・変更境界の監査

- build verifierは `index.html`、`404.html`、catalogの6 sessionだけ、合計8 HTML / 8 routeを確認した。
- 廃止したSession 04/05のAstro pageとbuild HTMLは存在しない。旧URL文字列はWorkerの恒久redirect、対応test、運営文書の否定契約にだけ残る。
- standalone Code Explorer pageは存在せず、公開page、README、PRD、event docsに同routeへのリンクはない。
- 正規PRDは5状態だけを採用している。homeの主経路は `予約済み → 受付済み → 診察中 → 支払済み` とし、公開Astro page全体でPRD-15が禁止する追加状態の日英名称がないことを構造testで確認した。
- `git diff --check` は成功した。P4では教材本文、catalog、演習実装、runner、isolation headerを再設計していない。post-auditのhome変更は状態チップ1語だけである。
- P2最終commit `7ee44fd` からS4ブラウザ証拠を支えるrunner `runner.ts`、header設定 `astro.config.ts` / `_headers`、component `CodeExplorer.tsx` / `SessionCodePlayground.astro`、E2E spec `session-code-playground.spec.ts` に差分がないことを確認した。E2E全体の差分0は主張しない。homeのdesktop/mobile baseline 2枚はpost-auditで更新済みであり、このS4証拠の再利用判定から明示的に除外する。

## 視覚検証とS4ブラウザsmoke

post-audit前の最終HEADでvisual/E2Eをfresh実行し、28/28成功した。homeの状態チップ変更で生じたdesktop 125 pixels / mobile 143 pixelsのactual/diffを目視し、文字以外の差分がないことを確認して、この2 baselineだけを更新した。post-auditではS4本文の説明だけを同期し、CSS、layout、E2E構造を変更していないためvisualは再実行せず、docsの構造test 146件とbuild 8 routesをfresh実行した。

S4の実WebContainer実行はP2で取得した次の証拠を再利用した。上記の通り、P2以降にrunner、isolation header、Code Explorer/Playground component、session-playground E2E specの差分がないためである。

- `crossOriginIsolated === true`
- 49 packagesを18秒でinstall
- runtimeの`workspace`をcwdとしてVitestを実行
- fixed clock/id、`store(event)` once、aggregate state、RepositoryError/atomicityの4 `AssertionError`
- module-not-found、fixture load failureなし

P4ではローカルWranglerのredirect smokeを最終HEADで新規実行した。WebContainerへの再installは行っておらず、この二つを同じfresh証拠として扱わない。

## 未確認（現地・人間のリハーサルが必要）

- エージェントを使わない参加者が、S4の全target完成ファイルをdelegate 8〜10分で反映できるか。
- 5人班でpeer review 7分版が回るか。問い1で沈黙が起きないか。8分版を含め、原則2名を比較できるか。
- S2のteach 7分で、参加者がdelegateを開始できるか。
- 班数分の外部display、HDMI、USB-C adapter、電源があるか。班数と参加人数も未確認である。
- review対象になる心理的負担と、明確に拒否する参加者をどう扱うか。

自動検証からS4のbudgetと解答表示を較正したが、人の適用時間と運営fallbackの所要は未確認である。上の実測が終わるまでは、相互レビュー、短縮teach、手動fallbackを成功済みと記録しない。
