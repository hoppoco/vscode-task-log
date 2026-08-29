# 多言語対応(i18n) タスクリスト

`design.md`の実装アプローチ(services層の型付き例外・構造化データ化から着手)に沿って並べている。

## 1. services層:型付き例外・構造化データへの変更

- [x] `src/services/taskStore.ts`に`ParentTaskNotFoundError`・`TaskNotFoundError`・`CannotMoveUnderOwnDescendantError`を追加し、該当箇所で使う
- [x] `taskStore.test.ts`の該当テストを、投げられる例外の型を検証する形に更新
- [x] `src/services/jiraClient.ts`に`JiraIssueFetchError`・`JiraCommentPostError`を追加し、該当箇所で使う
- [x] `jiraClient.test.ts`の該当テストを、例外の型を検証する形に更新
- [x] `src/services/summaryGenerator.ts`の`buildSummary`を`buildSummaryTree`(`SummaryNode[]`を返す)に変更
- [x] `summaryGenerator.test.ts`を、構造化データを検証する形に書き直す
- [x] 型チェック・Lint・単体テスト(42件)が通ることを確認

## 2. l10nインフラ整備

- [x] `@vscode/l10n-dev`をdevDependencyに追加
- [x] `package.json`に`"l10n": "./l10n"`を追加、`l10n:export`スクリプトを追加
- [x] `l10n/bundle.l10n.ja.json`を作成

## 3. package.jsonの文字列をプレースホルダー化

- [x] 全13コマンドの`title`を`%キー%`に置き換え
- [x] `taskLog.jira.baseUrl`・`taskLog.jira.email`の`description`を置き換え
- [x] Viewの`name`、拡張自体の`displayName`・`description`を置き換え(`displayName`は製品名としてそのまま、`description`のみ置き換え)
- [x] `package.nls.json`(英語)・`package.nls.ja.json`(日本語)を作成

## 4. commands/配下のl10n化

- [x] `createTaskFromSelection.ts`
- [x] `markerEditing.ts`
- [x] `setParent.ts`
- [x] `setFocus.ts`
- [x] `markStatus.ts`
- [x] `deleteTask.ts`
- [x] `reanchorTask.ts`
- [x] `revealTaskInEditor.ts`
- [x] `toggleStatusAtCursor.ts`
- [x] `getJiraClient.ts`
- [x] `setJiraApiToken.ts`
- [x] `linkJiraIssue.ts`
- [x] `pushSummaryToJira.ts`(`renderSummaryText`関数の新設を含む)
- [x] `taskTreeDragAndDropController.ts`

`l10n/bundle.l10n.ja.json`に60キー全ての日本語訳を追加済み(抽出ツールで英語側と1:1対応していることを確認済み)。

## 5. views/配下のl10n化

- [x] `taskTreeViewProvider.ts`(ステータスラベル「完了」、アンカー未接続のtooltip、TreeItem.commandのtitle)
- [x] `taskCodeLensProvider.ts`(「タスク: 」プレフィックス、「(完了)」サフィックス)

## 6. 検証

- [x] `npm run l10n:export`でキーを抽出し、`l10n/bundle.l10n.ja.json`との突き合わせを確認(60/60キー一致、過不足なし)
- [x] 型チェック・Lint・単体テスト・esbuildバンドル・結合テストコンパイルが全て成功
- [x] `src/services/`が`vscode`をimportしていないことをLintで再確認
- [x] 結合テストのボタンラベル比較(`showWarningMessage`/`showInformationMessage`のスタブ)が、l10n化後の英語デフォルト文言と一致するよう修正(3箇所:reanchorTask・deleteTask・pushSummaryToJira)
- [x] `.vsix`を作成(`package.nls.json`・`package.nls.ja.json`・`l10n/bundle.l10n.ja.json`が同梱され、開発用の`l10n/bundle.l10n.json`は除外されていることを確認)
- [x] 実機での確認(ユーザーにより確認済み)

## 7. ドキュメント反映

- [x] `docs/development-guidelines.md`に、型付き例外を使うルール(6章)と、多言語対応のルール(8章、新設)を追記
- [x] `docs/repository-structure.md`に`l10n/`・`package.nls*.json`を反映

## 完了条件

`requirements.md`の受け入れ条件のうち、コードレベルで検証できるものは満たしている。以下は実機での確認が必須:

- [x] 日本語表示のとき、既存のメッセージ・コマンド名等が今まで通り日本語で表示される(ユーザーにより確認済み)
- [x] 英語表示のとき、それらが英語で表示される(ユーザーにより確認済み)
- [x] タスクツリー・CodeLensの表示文言も切り替わる(ユーザーにより確認済み)
- [x] `taskStore.ts`・`jiraClient.ts`起因のエラーメッセージも切り替わる(ユーザーにより確認済み)
- [x] タスクタイトル等のユーザー入力コンテンツは翻訳されない(ユーザーにより確認済み)
