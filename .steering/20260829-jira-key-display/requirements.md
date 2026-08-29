# タスクツリーへのJiraキー表示 要求

## 位置づけ

タスクとJiraチケットの紐付け(`taskLog.linkJiraIssue`)は既に実装済みだが、どのタスクがJiraチケットに紐づいているかは、タスクツリーの表示だけでは分からない(`taskLog.pushSummaryToJira`実行時のpush先解決や、`linkJiraIssue`実行時のメッセージでしか確認できない)。`docs/functional-design.md`の画面イメージ(ワイヤーフレーム)は元々「▾ JIRA-123 委託先コード確認」のようにJiraキーを項目に含める形を想定していたが、実装(`taskTreeViewProvider.ts`)では反映されていない。この差分を埋め、タスクツリー上で紐付けの有無とJiraキーを一目で確認できるようにする。

## 事前に決めた設計判断

- **表示対象**:タスク自身が`jiraIssueKey`を持つ場合のみ表示する(祖先から解決される有効スコープの継承表示は行わない)。`jiraIssueKey`は`taskLog.linkJiraIssue`で明示的に紐づけたタスクにのみ設定される値であり、「このタスク自身が紐付け操作の対象になっている」ことをそのまま表せるため
- **表示位置**:既存の`TaskTreeItem.description`(現在は完了状態・ファイル名を表示している領域)にJiraキーを追加する形とする。`label`(タスクタイトル)自体は変更しない。タイトルの可読性を保ちつつ、既存の`description`領域の情報(完了状態・ファイル名)と並べて表示できるため

## 変更・追加する機能の説明

- `src/views/taskTreeViewProvider.ts`の`TaskTreeItem.buildDescription`を変更し、`task.jiraIssueKey`が設定されている場合、Jiraキーを`description`に含める
- 表示順序・区切り文字は、既存の「完了 · ファイル名」という組み立て方に合わせる(例:「JIRA-123 · 完了 · ファイル名」)

## 今回含めない機能

- 祖先から解決される有効なJiraスコープ(`taskStore.ts`の祖先方向探索ロジック)の表示・可視化
- Jiraキー部分のクリックによるJira側チケットへのリンクジャンプ(ブラウザで開く等)
- tooltipへのJira関連情報(サマリ内容等)の追加

## ユーザーストーリー

- 開発者として、タスクツリーを見ただけで、どのタスクがJiraチケットに紐づいているか、どのチケットに紐づいているかを一目で確認したい
- 開発者として、Jiraキーを確認するために`taskLog.linkJiraIssue`を再実行したり、pushしてみたりする必要がないようにしたい

## 受け入れ条件

- `jiraIssueKey`が設定されているタスクのツリー項目に、そのJiraキーが表示されること
- `jiraIssueKey`が設定されていないタスクの表示は、これまでと変わらないこと
- 完了状態・アンカー未接続警告など、既存の表示要素と共存し、崩れないこと
- 日本語表示・英語表示のいずれでも(i18n対応済みの他の文言と同様に)正しく表示されること(Jiraキー自体は翻訳対象外の値であることに注意)

## 制約事項

- データモデル(`src/models/task.ts`の`jiraIssueKey`)の変更は不要。表示層のみの変更とする
- `docs/development-guidelines.md`のDIパターン・エラー処理規約に従う。`src/services/`側の変更は不要な見込み
- 既存の結合テストのdescription文言に対するアサーションがあれば、変更後の文言に合わせて更新する
