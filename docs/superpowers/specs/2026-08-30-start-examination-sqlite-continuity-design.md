# 診察開始の識別子・SQLite・transaction統合設計

- 日付: 2026-08-30
- 対象: [Issue #110](https://github.com/iwasa-kosui/fp-with-ts-hands-on/issues/110)、[Issue #111](https://github.com/iwasa-kosui/fp-with-ts-hands-on/issues/111)、[Issue #112](https://github.com/iwasa-kosui/fp-with-ts-hands-on/issues/112)
- 前提: [診察開始ワークフローのセッション間契約](../../curriculum/start-examination-continuity.md)

## 背景

Session 03〜07は識別子を`domain/ids`へ置き、利用側が実装ファイルを直接importしています。Finalは識別子を所有概念へ置いていますが、対象概念に公開APIがありません。

診察開始のruntimeも連続していません。Session 00はfile SQLiteへ状態と監査を保存しますが、Session 01はMap、Session 02〜07はin-memory adapterを使います。そのため、状態型、用途別ID、境界検証、Result、effect注入、transactionが同じ永続化経路を改善したことを実行結果で比較できません。

## 基本方針

- 対象は診察開始の1ワークフローに限定します。
- application port、DB adapter、schema、migration、transactionは各snapshotが所有します。
- snapshot間でsourceをimportせず、前の解答を次の開始snapshotへ配布済みコードとして引き継ぎます。
- runtimeの共通packageは作りません。共通化するのはfixtureと横断テストの比較手順だけです。
- #110、#111、#112を順に実装し、各checkpointを独立して検証・commitします。
- Session 05は#111でS4解答後のSQLite到達状態を作り、#112でResult、effect、transactionへ発展させます。

## #110: 識別子と公開API

識別子の所有先を次のように統一します。

- `OwnerId`は`domain/owner/ownerId.ts`
- `PetId`は`domain/pet/petId.ts`
- `AppointmentId`と`VeterinarianId`は`domain/appointment`
- `ExamId`は`domain/examResult/examId.ts`

Session 03〜07の`domain/ids`を廃止します。対象概念の`index.ts`は再exportだけを記述し、型や関数を定義しません。Finalにも同じ4概念の`index.ts`を追加します。

use case、adapter、boundary、web、testは概念の`index.ts`からimportします。同じ概念内は循環参照を避けるため、実装ファイルを直接importします。exercise、型fixture、docsのコード例、Code Explorer、solution snippetも新しい公開APIへ同期します。

構造契約テストで、`domain/ids`が存在しないこと、対象概念の公開シンボルが再exportされること、概念外の直接importが残らないこと、概念内から`index.ts`を参照しないことを確認します。TypeScriptの型検査とimport graphの検査を組み合わせ、循環参照を検出します。

## #111: Session 00〜05のSQLite経路

Session 00の事故再現は維持します。Session 01はMapを廃止し、Session 00と同じ利用者操作、fixture、file SQLite上の状態更新と監査追記を持つ独立実装へ置き換えます。

Session 02〜05はsnapshotごとに次を所有します。

- Drizzle schemaとmigration
- file SQLiteを開くcomposition root
- 永続化した行とsnapshot固有のAppointmentとの変換
- 予約を読むresolver
- 予約状態を保存し、監査を追記するstore
- resetと初期データ投入

Session 02〜04のadapterは演習対象外の配布済みコードです。参加者が変更するdomain、boundary、use caseのファイル数は増やしません。Session 02の広い遷移とSession 03の状態制約、Session 03のstring IDとSession 04の用途別IDを、同じSQLite結果で比較します。

Session 04まではSession 00から引き継いだ連絡先を含む監査payloadを事故として観察できます。Session 05では監査用DTOを明示的に組み立て、氏名、メールアドレス、電話番号を保存対象から外します。境界で検証に失敗した入力はresolverへ渡しません。

各snapshotは`createDatabaseBackedApp`から単独起動できます。既定の開発用DBと、テストが渡す一時DBの両方を同じcomposition rootで配線します。

## #112: Session 05〜07のResult・effect・transaction

Session 05は、予約なしと状態不正を例外文言で分類する開始状態をSQLite上で再現します。SQLite接続やSQL実行の失敗は業務エラーへ変換しません。

Session 06はS5の解答として、予約なしと状態不正を判別可能なResultへ変えます。resolverとstoreの失敗は永続化失敗として別の型にし、業務エラーのunionへ混ぜません。Webは業務エラーを利用者向けnoticeへ変換し、永続化失敗は500応答へ渡します。

Session 06のS6開始状態では時刻とevent IDを処理内で生成し、予約状態の更新後に監査eventを別処理で追記します。監査追記が失敗した場合は状態更新だけが残り、二重書き込みの事故を観察できます。

Session 07はclock、event ID generator、resolver、storeをportとして注入します。use caseは1回分のEventContextから`ExaminationStarted`を作り、状態とeventを1つのstore操作へ渡します。SQLite adapterはDrizzle transaction内で状態更新と監査追記を実行します。

監査テーブルのevent ID重複を使って実際のINSERTを失敗させます。Session 06では状態だけが残り、Session 07ではtransactionがrollbackして開始前の状態と監査記録が保たれることをfile SQLiteで確認します。テスト専用の失敗分岐はruntimeへ追加しません。

## 横断テスト

`examples/start-examination-continuity`をテスト専用workspace packageとして追加します。各snapshot向けの薄いadapterが、snapshot固有のcomposition rootと永続化結果を共通のシナリオへ接続します。snapshotのruntime sourceはこのpackageにも他snapshotにも依存しません。

横断テストは共通fixtureを使い、必要なsnapshotだけで次を確認します。

- 診察開始のHTTP結果
- 実行後の予約状態
- SQLiteへ保存された監査記録
- 状態不正のruntime拒否と識別子取り違えのtypecheck拒否
- 不正入力時にデータが変わらないこと
- Session 05の監査payloadに連絡先がないこと
- 予約なし、状態不正、永続化失敗の区別
- 注入した時刻とevent IDが保存されること
- 監査保存失敗時に残った状態とevent

テストはadapterの関数名、SQL呼び出し順、内部の行型を固定しません。各snapshot向けの薄いadapterが差を吸収し、共通シナリオは利用者操作と観測結果だけを扱います。

## checkpointと検証

#110ではruntimeを変える前に、exercise、test、typecheck、docs buildを実行します。#111ではSession 00〜05の横断契約を追加した後、同じ検証に全snapshotのbuildを加えます。#112ではSession 05〜07を横断契約へ追加し、全検証を再実行します。

構造変更、Session 00〜05のSQLite接続、Session 05〜07のResult・effect・transactionは別のcommit群にします。最終的に#110、#111、#112の順で差分をレビューできるDraft PRを作成します。

## 対象外

- Finalの認証、認可、他集約の途中Sessionへの移植
- snapshotをまたぐruntime packageやapplication portの共通化
- Finalの全ドメインへの`index.ts`一括導入
- 診察開始以外のResult、effect、transactionの変更
- 既存の累積回帰テストの一括削除

## 完了条件

- Session 03〜07に`domain/ids`が残らず、対象概念の公開APIが統一されています。
- Session 00〜07を同じfixture、利用者操作、SQLite上の観測結果で比較できます。
- S5解答snapshotのSession 06と完成snapshotのSession 07で、業務エラーと永続化失敗が別の型と表示へ対応します。
- Session 07で状態更新と監査追記が同じDrizzle transactionへ入り、失敗時に片方だけ残りません。
- 各snapshotが単独で起動、test、typecheck、buildできます。
- exercise、横断テスト、全体test、typecheck、build、docs buildが成功します。
