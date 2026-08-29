# 診察開始ワークフローのセッション間契約

この文書は、[Issue #108](https://github.com/iwasa-kosui/fp-with-ts-hands-on/issues/108) で扱う診察開始ワークフローについて、Session 00からFinalまでを同じシステムの段階的な改善として扱う条件を定めます。後続Issueは、この文書で決めたsnapshotの所有範囲とテスト責任を前提に実装します。

## 同じシステムと判断する条件

各snapshotは同じSQLiteファイルや同じ実装を共有しません。次の内容をSession 00からFinalまで追跡できる場合に、同じシステムを改善していると判断します。

- 診察開始を依頼する利用者操作
- `examples/fixtures/clinic.ts` にある予約、ペット、飼い主、獣医師の初期データ
- 診察開始の実行結果
- 実行後の予約状態
- SQLiteに保存された監査記録
- 保存失敗時に残ったデータ

利用者操作は、共通fixtureの予約IDと獣医師IDを使って診察開始を依頼する操作です。Finalでは認証済みの利用者が必要ですが、認可とactorはFinal固有の拡張として扱います。途中セッションへ移植しません。

## 実装の所有範囲

### snapshotが所有するもの

次の実装は教材の題材になり得るため、各snapshotが所有します。

- applicationが使うport
- DB adapter
- Drizzleのschemaとmigration
- repository、resolver、store
- transaction
- 永続化したデータとドメイン型の相互変換
- composition rootでの配線

`examples/session-*` 間でこれらのsourceをimportしません。前の解答を次の開始snapshotへ配布済みコードとして複製します。DB adapterを共通packageへ移して重複を消すことはしません。application portも、学習上の必要性が現れる前に共通化しません。

各snapshotは自分のpackageだけを指定して起動、test、typecheck、buildできる状態を保ちます。SQLiteファイルもsnapshotごとに分けます。横断テストではテストごとに一時SQLiteファイルを作り、別snapshotの実行結果が混ざらないようにします。

### 共通fixtureに置くもの

共通データは既存の `examples/fixtures/clinic.ts` を使います。この設計の時点では、次の既存項目で比較を始められます。

- 予約ID
- ペットID
- 飼い主ID
- 獣医師ID
- 検査ID
- 予約日時
- 受付日時
- 飼い主の氏名、メールアドレス、電話番号

固定したevent ID、診察開始日時、Finalの利用者IDなどは、必要なテスト内で定義します。同じ値を複数snapshotで使う必要が確認できた場合に限り、共通fixtureへの追加を検討します。

横断テストのためだけに、applicationが依存する共通の型、port、driver、harnessは先に作りません。最初の横断テストを実装するときに重複と呼び出し方を確認し、必要な最小単位だけを命名します。

## snapshot対応表

この表は後続Issueが作る到達状態を示します。Session 02〜06では、開始snapshotがその回のstarterであり、次のsnapshotが直後のsolutionです。

| snapshot | 開始状態 | 参加者の変更対象 | 直後の解答状態と解消する事故 | 永続化境界 |
| --- | --- | --- | --- | --- |
| Session 00 | 任意の状態文字列、用途を区別しないID、未検証入力、例外文言による分類、処理内で生成する時刻とevent ID、非原子的な二重書き込みを含みます。 | コードは変更しません。現行の事故を再現します。 | 解答はありません。後続セッションと比較する未改善状態です。 | snapshot内のDB adapterがfile SQLiteへ予約状態と監査記録を別々に保存します。 |
| Session 01 | Session 00と同じ利用者操作、fixture、SQLite上の事故を使います。別のMap実装へ戻しません。 | EventStormingで診察開始のコマンド、actor、事前条件、業務イベントを整理します。sourceは変更しません。 | 診察開始は受付済みの予約だけに許可する、という業務上の事前条件を確定します。 | Session 01自身が持つDB adapterを使います。Session 00のsourceはimportしません。 |
| Session 02 | Session 01で確定した事前条件に対して、状態型と遷移関数が広すぎるstarterです。SQLite接続は配布済みコードとして残します。 | `src/domain/appointment` の2ファイルを変更します。 | Session 03がsolutionです。会計済みやキャンセル済みの予約から診察を開始できない状態型と遷移になります。 | Session 02自身のDB adapterがfile SQLiteへ保存します。状態更新と監査追記はまだ別の処理です。 |
| Session 03 | Session 02の解答に、用途を区別していないIDが残るstarterです。 | `src/domain` の5ファイルを変更します。 | Session 04がsolutionです。予約IDと獣医師IDをコード上で取り違えるとコンパイルできません。 | Session 03自身のDB adapterが、snapshot内のIDをSQLiteの値へ変換します。 |
| Session 04 | Session 03の解答に、未検証のHTTP入力と連絡先を含む監査payloadが残るstarterです。 | `src/boundary` の1ファイルを変更します。 | Session 05がsolutionです。不正な外部入力は診察開始へ渡りません。配布済みの永続化処理は、監査記録から飼い主の連絡先を除外します。 | Session 04自身のDB adapterを使います。Session 05では検証済み入力と必要最小限の監査payloadを保存します。 |
| Session 05 | Session 04の解答に、例外と例外文言による失敗分類が残るstarterです。 | use case、エラー、呼び出し側の3ファイルを変更します。 | Session 06がsolutionです。予約なしと状態不正を別の業務エラーとして返し、SQLite障害を業務エラーへ変換しません。 | Session 05自身のresolverとstoreをDB adapterへ接続します。保存処理はまだS6で扱う改善前の形です。 |
| Session 06 | Session 05の解答に、処理内で生成する時刻とevent ID、予約状態と監査記録の二重書き込みが残るstarterです。 | `src/useCase` の3ファイルを変更します。 | Session 07がsolutionです。1回分の時刻とevent IDから診察開始eventを作り、予約状態と監査記録を一つの保存処理へ渡します。 | Session 06自身のportとDB adapterを使います。solutionではsnapshot内のDrizzle transactionで両方を保存します。 |
| Session 07 | Session 06の全解答が入った非公開snapshotです。 | 変更しません。Finalとの比較に使います。 | 診察開始の入力、業務エラー、event、保存、技術的失敗の責任が分かれた状態です。 | Session 07自身のDB adapterがfile SQLite transactionで予約状態と監査記録を保存します。 |
| Final | Session 07の診察開始に、認証、認可、actor、projection、他集約を加えた参照実装です。 | 変更しません。講師がSession 07との対応とFinal固有の拡張を案内します。 | Session 07と同じ業務結果と原子性を保ちます。認証や他集約は途中セッションへ戻しません。 | Final固有のschema、migration、DB adapter、Drizzle transactionを維持します。 |

## 事故ごとの解消確認

各事故で必要な確認だけを行います。すべてのsnapshotで同じassertionを繰り返しません。

| Session 00の未改善点 | 解消を確認する最初のsnapshot | 入力または失敗条件 | 確認する内容 |
| --- | --- | --- | --- |
| 会計済みの予約から診察を開始できる | Session 03 | 共通fixtureの予約を会計済みにして診察開始を依頼します。 | 診察開始が状態不正として失敗し、予約は会計済みのままで、新しい監査記録が保存されません。 |
| 用途の異なるIDをコード上で取り違えられる | Session 04 | 予約IDと獣医師IDを入れ替えたコードをコンパイルします。正常系では共通fixtureの両IDで診察を開始します。 | 取り違えたコードがコンパイルに失敗します。正常系では診察開始が成功し、実行後の予約状態とSQLiteの監査記録に共通fixtureの予約IDと獣医師IDが残ります。実行時に同じ形式のUUIDの用途を判定できるとは主張しません。 |
| 不正な外部入力を診察開始へ渡せる | Session 05 | UUIDではない予約IDまたは獣医師IDで診察開始を依頼します。 | 入力エラーとして失敗し、予約状態と監査記録が変わりません。 |
| 監査payloadへ飼い主の連絡先を保存する | Session 05 | 共通fixtureで診察開始を成功させます。 | SQLiteに保存された監査記録に、飼い主の氏名、メールアドレス、電話番号が含まれません。 |
| 予約なしと状態不正を例外文言で分類する | Session 06 | 存在しない予約IDと、受付前の予約を別々に使います。 | 診察開始の実行結果が予約なしと状態不正を区別します。どちらの場合も予約状態と監査記録を変更しません。SQLite障害は業務エラーとして返しません。 |
| 時刻とevent IDを処理内で生成する | Session 07 | テスト内で固定した診察開始日時とevent IDを使います。 | SQLiteに保存された監査記録へ、1回の処理で渡した日時とevent IDがそのまま残ります。 |
| 予約状態と監査記録を別々に保存する | Session 07 | 監査記録を保存する段階で失敗させます。 | 診察開始前の予約状態が残り、失敗した診察開始の監査記録は残りません。予約状態だけが診察中になることを許しません。 |
| Session 07とFinalの対応がコード形状だけに依存する | Final | Session 07と同じfixtureで成功、状態不正、保存失敗を実行します。 | 診察開始の実行結果、実行後の予約状態、SQLiteに保存された監査記録、保存失敗時に残ったデータがSession 07と一致します。Final固有の認可失敗は別に確認します。 |

## テストの所有者

### 学習契約

starterでREDになり、直後のsolutionでGREENになる条件は #114 が一か所へ集約します。状態型、ID、入力境界、業務エラー、effectの各学習内容を対象にします。SQLiteのschemaやSQL呼び出し順は固定しません。

過去セッションの学習テストを後続snapshotへ累積コピーしません。ある学習内容は、starterと直後のsolutionの一組だけで実行します。

### 診察開始の利用者操作とSQLite結果

#111 がSession 00〜04を比較する横断テストを最初に置きます。#112 は同じテスト群へSession 05〜07を追加し、#113 はFinalを追加します。各Issueがsnapshotごとに別の横断テスト基盤を作ることはしません。

このテスト群は共通fixtureを使い、必要なsnapshotだけで次を確認します。

- 診察開始の実行結果
- 実行後の予約状態
- SQLiteに保存された監査記録
- 保存失敗時に残ったデータ

HTTPのstatus、redirect先、画面へ返す業務エラーが必要な事故は、snapshotのHono appへ診察開始を依頼して確認します。DB adapterの関数名、portの関数名、Drizzleの呼び出し順は固定しません。

### 教材サイトの操作

#107 はS2〜S6のブラウザ上でREDを確認し、編集し、同じコマンドでGREENを確認する利用者フローを所有します。このテストはSQLiteの保存内容を検査しません。横断テストはCode Explorerの配置や画面構造を検査しません。

### セキュリティ

Session 05で初めて監査記録から連絡先が除外されることは、#111が追加する横断テストが所有します。後続snapshotは同じassertionをコピーしません。Final固有の認証、認可、secret、HTTP応答、ログの非公開はFinalのテストに残し、#115が重複を整理します。

### データ整合性とmigration

Session 07で予約状態と監査記録が同じtransactionに入ることは、#112が追加するfile SQLiteテストが所有します。Finalが同じ保存失敗条件を満たすことは、#113が同じ横断テスト群へ追加します。Final固有のmigration互換性と競合処理はFinalのテストに残し、#115が重複を整理します。

## 後続Issueが守る境界

- #107は教材サイトの操作を変更しても、snapshotのruntime境界を決めません。
- #110は各snapshot内でIDの所有概念と公開APIを整理します。snapshotをまたぐ共通portや共通ドメイン型は作りません。
- #111はSession 00〜04へsnapshotごとのDB adapterを配置し、最初の横断テスト群を作ります。
- #112はSession 05〜07で各回のapplication portとtransactionを段階的に作り、既存の横断テスト群を拡張します。
- #113はFinal固有のDB adapterを維持したまま、Session 07と同じfixtureと確認内容を横断テスト群へ追加します。
- #114はstarterと直後のsolutionの学習契約を一か所へ集約します。runtimeの横断テストを移動または複製しません。
- #115はFinal固有のセキュリティ、migration、transaction、競合処理へテストを絞ります。Session 00〜07との横断テストは削除しません。

後続Issueで共通化を提案する場合は、複数snapshotで実際に重複したデータまたはテスト配線を示し、教材として残す実装を隠さないことを確認します。名前を先に決めて実装を合わせることはしません。
