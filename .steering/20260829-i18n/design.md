# 多言語対応(i18n) 設計

## 実装アプローチ

- `package.json`内の文字列は`%キー%`プレースホルダー化し、`package.nls.json`(英語)・`package.nls.ja.json`(日本語)を用意する
- `src/commands/`・`src/views/`(既に`vscode`に依存している層)は、ハードコードされた文字列を`vscode.l10n.t()`呼び出しに置き換える。デフォルトテキスト(英語)がそのままキーになる
- `src/services/`(`vscode`非依存の層)は、`vscode.l10n.t()`を一切使わない。代わりに:
  - エラーは文言ではなく型付き例外クラスとして投げる。呼び出し元の`commands/`が`instanceof`で例外の種類を判定し、`vscode.l10n.t()`でメッセージを組み立てる
  - `summaryGenerator.ts`は整形済みテキストではなく構造化データ(`SummaryNode[]`:深さ・タイトル・ステータス)を返す。テキストへの変換(ステータスラベルの付与を含む)は呼び出し元の`commands/pushSummaryToJira.ts`が担う
- 翻訳データの整合性確認には`@vscode/l10n-dev`(devDependency)を使う。`npm run l10n:export`でコード中の`vscode.l10n.t()`呼び出しを走査し、`l10n/bundle.l10n.json`(参照用の英語キー一覧)を生成する。これと`l10n/bundle.l10n.ja.json`を目視で突き合わせ、翻訳漏れが無いか確認する(自動テストは設けない、`requirements.md`参照)
- 「プログラマのミスを示すアサーション的な例外」(`TaskStore.ensureLoaded`が投げるもの)は、通常の利用では発生しない・翻訳の優先度が低いと判断し、l10n対応の対象外とする(英語の素のメッセージのまま)

## 変更するコンポーネント

### `package.json`

- 全コマンドの`title`、`taskLog.jira.baseUrl`・`taskLog.jira.email`の`description`、Viewの`name`、拡張自体の`displayName`・`description`を`%キー%`に置き換え
- `"l10n": "./l10n"`を追加
- `package.nls.json`(英語、新規)・`package.nls.ja.json`(日本語、新規)を作成

### `src/services/taskStore.ts`

- 型付き例外を追加(いずれも識別用のプロパティを持つ`Error`のサブクラス):
  - `ParentTaskNotFoundError`(`create`時、指定した親タスクが存在しない)
  - `TaskNotFoundError`(`requireTask`。`setParent`・`setStatus`・`delete`・`updateAnchor`・`setJiraLink`から共通で使われる)
  - `CannotMoveUnderOwnDescendantError`(`setParent`、自分自身の子孫の下に移動しようとした)
- 例外のメッセージ自体(`Error`の`message`)は、ログ・デバッグ用の素の英語文とし、l10nの対象にはしない(表示用の文言は呼び出し元が組み立てる)

### `src/services/jiraClient.ts`

- 型付き例外を追加:`JiraIssueFetchError`(`issueKey`・`status`を保持)、`JiraCommentPostError`(同様)

### `src/services/summaryGenerator.ts`

- `buildSummary(rootTaskId, allTasks): string` を `buildSummaryTree(rootTaskId, allTasks): SummaryNode[]` に変更する
- `SummaryNode`は`{ depth: number; title: string; status: TaskStatus }`。部分木の除外/内包の判定ロジック(`jiraIssueKey`・`includeInAncestorSummary`を使う部分)はそのままservices側に残す。「完了」「未完了」のようなラベル付けだけを呼び出し側に移す

### `src/commands/pushSummaryToJira.ts`

- `buildSummaryTree`の結果を受け取り、`vscode.l10n.t()`でステータスラベルを付けながらテキストに組み立てる`renderSummaryText`関数(このファイル内のプライベートな関数)を追加

### `src/commands/*.ts`・`src/views/*.ts`(既存ファイルの変更)

- ハードコードされた文字列を`vscode.l10n.t()`に置き換える。対象は、エラー/確認/情報メッセージ、QuickPickの選択肢・placeholder、入力ボックスのprompt、確認ボタンのラベル、CodeLens・ツリー項目のステータス表示など
- `commands/*.ts`のcatch節では、`instanceof`で`services`側の型付き例外を判定し、専用の`vscode.l10n.t()`メッセージに変換する。それ以外の予期しない例外は、既存の「予期しない例外(バグ)」の扱い(`development-guidelines.md`6章)に従い、汎用のメッセージ+`error.message`をそのまま添える

### 新規依存

- `@vscode/l10n-dev`(devDependency)。`l10n:export`スクリプトから使う

## データ構造の変更

`Task`型・`TaskStorage`インターフェースの変更は無い。`services`層の一部関数の戻り値・例外の型が変わる(上記参照)。

## 影響範囲の分析

- `summaryGenerator.test.ts`は、戻り値がテキストから構造化データに変わるため、既存のテストをアサーション内容ごと書き直す必要がある
- `taskStore.test.ts`・`jiraClient.test.ts`の「例外を投げる」系のテストは、`.rejects.toThrow()`(何かエラーが投げられればよい)から`.rejects.toThrow(TaskNotFoundError)`のように、投げられる例外の型を検証する形に強化できる。既存のテストの意図は変わらないため、大きな書き直しにはならない
- 結合テスト(`extension.test.ts`)は、メッセージの文言そのものをアサーションしていないため、l10n化による影響は無い見込み(実装時に再確認する)
- 実装後、`docs/development-guidelines.md`に「新しい文字列を追加する際は`vscode.l10n.t()`を使う」「servicesでは型付き例外を使い、文言はcommands側で組み立てる」というルールを追記する
