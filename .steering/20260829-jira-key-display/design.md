# タスクツリーへのJiraキー表示 設計

## 実装アプローチ

`src/views/taskTreeViewProvider.ts`の`TaskTreeItem.buildDescription`のみを変更する。`jiraIssueKey`は既に`Task`モデルに存在し、`TaskTreeItem`のコンストラクタには`task`(=`jiraIssueKey`込み)がそのまま渡ってきているため、新たな引数追加・データ取得は不要。

```ts
private buildDescription(task: Task): string {
  const fileName = path.basename(task.logFilePath);
  const parts: string[] = [];
  if (task.jiraIssueKey) {
    parts.push(task.jiraIssueKey);
  }
  if (task.status === 'done') {
    parts.push(vscode.l10n.t('Done'));
  }
  parts.push(fileName);
  return parts.join(' · ');
}
```

- `jiraIssueKey`が`null`の場合は`parts`に追加されないため、既存の表示(「完了 · ファイル名」または「ファイル名」)は変化しない
- `jiraIssueKey`はJira側のチケットキーそのもの(例:`JIRA-123`)であり、翻訳対象の文言ではないため`vscode.l10n.t()`で包まない(`docs/development-guidelines.md` 8章の「ユーザーが入力したコンテンツは対象外」に相当する扱い)

## 変更するコンポーネント

| ファイル | 変更内容 |
|---|---|
| `src/views/taskTreeViewProvider.ts` | `TaskTreeItem.buildDescription`を、配列に要素を積んで`' · '`で結合する形に変更し、`jiraIssueKey`を先頭要素として追加 |

`src/services/`・`src/commands/`・`src/models/`の変更はない。

## データ構造の変更

なし。`Task.jiraIssueKey`(`src/models/task.ts`)を読み取るのみ。

## 影響範囲の分析

- **既存表示への影響**:`jiraIssueKey`を持たない大多数の既存タスクの表示は変わらない(`parts`に追加される要素が増えないため)
- **テスト**:`TaskTreeItem`の`description`組み立てを直接検証する既存テストは無い(結合テストでも本文言をアサートしている箇所は無いことを確認済み)。今回新たに、`src/test/unit/`ではなく結合テスト側で軽く確認する方法を検討したが、`TaskTreeItem`は`vscode.TreeItem`を継承しコンストラクタ内でロジックが完結する薄いクラスであり、`docs/development-guidelines.md` 4章の「`commands/`・`views/`は主要な操作フローのみを結合テストでカバーする」方針に照らすと、新規の自動テスト追加は見送り、実装後に実機で目視確認する(タスクリストに確認項目として明記する)
- **他機能との組み合わせ**:アンカー未接続時の`iconPath`/`tooltip`設定や、完了時の`iconPath`設定とは独立した領域(`description`)への変更であり、干渉しない
- **`docs/`への影響**:`docs/functional-design.md`のワイヤーフレーム(6章)が元々想定していた見た目に近づく変更であり、恒久ドキュメントの記述内容とは矛盾しないため、`docs/`側の更新は不要と判断する
