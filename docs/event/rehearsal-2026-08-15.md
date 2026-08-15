# 新カリキュラム 自動リハーサル記録

計画日: 2026-08-15

自動検証実施日: 2026-08-16（Asia/Tokyo）

対象ブランチ: `main-a5cflu`

検証開始時の実装: `3711938`（旧教材URLの Worker 配信設定を含む）

この文書は、自動化できるリリース検証と、現地・人間によるリハーサルが必要な項目を分けて記録する。自動検証の成功を、人間が参加する進行リハーサルの成功とは扱わない。

## リリース判断の要約

- 自動ゲートは成功した。通常の型検査・テスト・build、28件の視覚/E2E検証、4演習の意図したRED、次snapshotのGREEN連鎖、差分予算、Final凍結を確認した。
- 旧Session 04/05の4 URLは、ローカルWranglerでredirect追従を無効にして、すべて `308` と正しい `Location` を返した。新Session 04は `200` を返した。
- catalogの較正は不要だった。S1〜S4はいずれも絶対上限5ファイル・実効80行以内である。
- 現地・人間のリハーサル5項目は未確認である。したがって、イベント運営まで含めた準備完了とはまだ判定しない。

## Fresh verification

所要時間は `/usr/bin/time -p` の `real` で計測した。

| コマンド | 結果 | 実測 |
| --- | --- | ---: |
| `pnpm typecheck` | 成功。session-00〜05、docs、Worker。Astro 69 files、0 errors / 0 warnings / 0 hints | 7.21秒 |
| `pnpm test` | 成功。session通常テスト50件、docs実行134件、明示的なWorker実行25件 | 13.95秒 |
| `pnpm build` | 成功。Astro 69 files、0 diagnostics、8 HTML / 8 routes | 29.30秒 |
| `pnpm --filter @fp-with-ts/docs test:visual` | 28/28成功。home desktop/mobileを含む | 10.78秒 |
| Worker focused 3 files | 25/25成功（config 5、routes 10、HTTP handler 10） | Vitest 0.39秒 |
| event document contract | 5/5成功。6 sessionの150分、固定30分、ADV、review、運営文書を照合 | 1.45秒 |

`pnpm test` のdocs実行は現行Vitest設定によりWorker 25件を含み、rootの `test:worker` が同じ25件を明示的に再実行する。実行回数は209件、重複を除く契約は184件である。明示経路は、docs側のtest対象を将来整理してもCIの `pnpm test` からWorker契約が外れないために残す。

buildでは既知のVite chunk-size warningが出たが、Astro diagnosticsと静的route検証は成功した。視覚検証の最初のsandbox内実行は `0.0.0.0:4321` のlistenが `EPERM` になったため、同じコマンドをローカルserver起動権限付きで再実行し、28件すべての成功を確認した。

## Worker配信契約のRED→GREEN

`worker/config.test.ts` をproduction設定より先に追加した。Vite test harnessでは `import.meta.url` がfile URLではなかったため、最初のharness errorをrepository cwd基準の読み取りへ直してから、次の正しいREDを確認した。

- 旧4 URLが `wrangler.jsonc` の `assets.run_worker_first` にない: 4 assertion failures
- rootの通常テストに明示的なWorker test経路がない: 1 assertion failure

`wrangler.jsonc` にslash有無の4 URLを追加し、既存の `/healthz`、`/module-00`、`/module-00/` は維持した。rootへ `test:worker` を追加し、CIが実行する `pnpm test` から呼び出した。同じconfig testを含むfocused実行は3 files / 25 testsでGREENになった。JSONCは新しい依存を追加せず、文字列内の記号を壊さないcomment/trailing-comma処理を通して読んでいる。

ローカルWrangler（`127.0.0.1:8787`）のHTTP smokeは次の通り。redirectは追従していない。

| Path | Status | Location |
| --- | ---: | --- |
| 旧Session 04（slashなし） | 308 | `/sessions/04-effects-and-events/` |
| 旧Session 04（slashあり） | 308 | `/sessions/04-effects-and-events/` |
| 旧Session 05（slashなし） | 308 | `/sessions/04-effects-and-events/` |
| 旧Session 05（slashあり） | 308 | `/sessions/04-effects-and-events/` |
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
| `pnpm --filter @fp-with-ts/clinic-session-05 test` | 5 / 20 | 5.37秒 |

session-05はS1〜S4の全回帰に加え、in-memory storeの原子性を含めて20件すべて成功した。

## 差分予算とFinal凍結

`pnpm --filter @fp-with-ts/docs exec vitest run src/test/examples/exercise-budget.test.ts` は1/1成功（1.67秒）。starterと次snapshotの同一moduleを比較した実測値は次の通り。

| Exercise | Files | Effective lines | 上限 |
| --- | ---: | ---: | ---: |
| S1 | 2 | 35 | 5 files / 80 lines |
| S2 | 2 | 24 | 5 files / 80 lines |
| S3 | 3 | 77 | 5 files / 80 lines |
| S4 | 3 | 35 | 5 files / 80 lines |

`git diff --exit-code b8492ba3895adecf5cb1593a79008c90908f4090 -- examples/final` は差分0で成功した。`examples/final/**` は凍結されている。

## 公開route・旧語・変更境界の監査

- build verifierは `index.html`、`404.html`、catalogの6 sessionだけ、合計8 HTML / 8 routeを確認した。
- 廃止したSession 04/05のAstro pageとbuild HTMLは存在しない。旧URL文字列はWorkerの恒久redirect、対応test、運営文書の否定契約にだけ残る。
- standalone Code Explorer pageは存在せず、公開page、README、PRD、event docsに同routeへのリンクはない。
- 正規PRDは5状態だけを採用し、追加の会計待ち状態を導入していない。
- `git diff --check` は成功した。P4では教材本文、catalog、演習実装、runner、isolation header、homeを再設計していない。
- P2最終commit `7ee44fd` から、runner、Code Explorer component、Astro isolation header、public header、E2Eに差分がないことを確認した。

## 視覚検証とS4ブラウザsmoke

最終HEADでvisual/E2Eをfresh実行し、28/28成功した。home desktop/mobileのapproved screenshot、全6 sessionのmobile/desktop horizontal overflow、S0のtable/dl、S1〜S4 playgroundの可視性を含む。

S4の実WebContainer実行はP2で取得した次の証拠を再利用した。上記の通り、P2以降にrunner/header/component/E2Eの差分がないためである。

- `crossOriginIsolated === true`
- 49 packagesを18秒でinstall
- runtimeの`workspace`をcwdとしてVitestを実行
- fixed clock/id、`store(event)` once、aggregate state、RepositoryError/atomicityの4 `AssertionError`
- module-not-found、fixture load failureなし

P4ではローカルWranglerのredirect smokeを最終HEADで新規実行した。WebContainerへの再installは行っておらず、この二つを同じfresh証拠として扱わない。

## 未確認（現地・人間のリハーサルが必要）

- エージェントを使わない参加者が、delegate 8〜10分でcatalogの1〜4ステップを完了できるか。
- 5人班でpeer review 7分版が回るか。問い1で沈黙が起きないか。8分版を含め、原則2名を比較できるか。
- S2のteach 7分で、参加者がdelegateを開始できるか。
- 班数分の外部display、HDMI、USB-C adapter、電源があるか。班数と参加人数も未確認である。
- review対象になる心理的負担と、明確に拒否する参加者をどう扱うか。

自動検証からはbudgetや運営fallbackを変更する根拠が出ていないため、catalog、facilitator guide、peer-review cardの較正は行っていない。上の実測が終わるまでは、相互レビューや短縮teachを成功済みと記録しない。
