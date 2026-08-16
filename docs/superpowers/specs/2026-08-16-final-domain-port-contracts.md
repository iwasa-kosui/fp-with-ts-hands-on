# final の domain port 契約配置

## 目的

`examples/final/src/useCase/query` と `examples/final/src/useCase/persistence` に置かれた port 契約を、対応する domain module へ移します。ユースケースは domain の契約を依存として受け取り、SQLite adapter はその契約を実装します。

## 対象と配置

- `FollowUpRequestReader` は `domain/followUp/followUpRequestReader.ts` に移します。
- `InstallationStatus` と `InstallationStatusQuery` は `domain/installation/installationStatusQuery.ts` に移します。
- `InitialAdminAlreadyExists` と `InitialAdminSetupStore` は `domain/installation/initialAdminSetupStore.ts` に移します。
- `SanitizedAuditValue`、`SanitizedAuditRecord`、`EventHistoryReader` は `domain/audit/eventHistoryReader.ts` に移します。

`adaptor/secondary/sqlite/query` と `adaptor/secondary/sqlite/store` は具象実装として維持します。`useCase/query` と `useCase/persistence` の旧ファイルは削除します。

## 依存方向

use case と primary/secondary adapter は domain の port 契約を import します。domain は adapter、Drizzle、Hono、React を import しません。SQLite adapter は port を実装しますが、port の型や error union を再定義しません。

## 互換性

移動前後で次を変更しません。

- `InstallationStatus` の `InitialSetupAvailable` と `Installed`
- `InitialAdminSetupStore.store` の引数、戻り値、`InitialAdminAlreadyExists`
- `FollowUpRequestReader.listRequestedAppointmentIds` の戻り値
- `EventHistoryReader.list` と監査履歴 DTO の PII 非露出契約

これは import path と責務配置だけの変更です。HTTP 応答、SQLite クエリ、業務ルール、Promise rejection の境界を変更しません。

## 検証

既存の web、use case、SQLite adapter テストを維持します。型専用契約の移動なので、振る舞いを持たない配置専用テストは追加せず、型検査と既存の回帰テストで参照の整合性と実行時の振る舞いを確認します。
