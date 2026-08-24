# 初回実装(Phase 1)設計

## 実装アプローチ

- `development-guidelines.md`のDIパターン(servicesは`vscode`をimportしない)を最初から徹底する
- 依存関係の少ない層から実装する:①プロジェクトセットアップ →②`models`/`services`(VSCode非依存、Vitestで検証しながら)→③`views`/`commands`(VSCode API層、実機で動作確認)
- Phase 2で追加する`StallDetector`・`SummaryGenerator`・`JiraClient`は今回作成しない。ただし、後から追加する際にモデルの破壊的変更が発生しないよう、`Task`型には`jiraIssueKey`・`includeInAncestorSummary`フィールドをあらかじめ用意しておく(値は未使用のままにする)

## 変更するコンポーネント(新規作成)

`repository-structure.md`のうち、Phase 1で作成する範囲は以下の通り。

| ファイル                                                                             | 内容                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json` / `tsconfig.json` / `esbuild.js` / `eslint.config.js` / `.prettierrc` | プロジェクトセットアップ一式                                                                                                                                                                                                                     |
| `src/extension.ts`                                                                   | 拡張エントリポイント。Phase 1のコマンド・View登録                                                                                                                                                                                                |
| `src/models/task.ts`                                                                 | `Task`型定義                                                                                                                                                                                                                                     |
| `src/services/markerAnchorService.ts`                                                | 開始・終了マーカーの挿入・範囲解決                                                                                                                                                                                                               |
| `src/services/taskStore.ts`                                                          | タスクのCRUD、拡張専用ストレージへの永続化(`TaskStorage`インターフェース経由)                                                                                                                                                                    |
| `src/views/taskTreeViewProvider.ts`                                                  | タスクツリーのサイドバー表示                                                                                                                                                                                                                     |
| `src/views/statusBarController.ts`                                                   | フォーカス中タスクのパンくず表示                                                                                                                                                                                                                 |
| `src/views/taskCodeLensProvider.ts`                                                  | ログ編集中、マーカー範囲の直上に対応するタスク名をCodeLensで表示(クリックでフォーカス)。実機確認時に「編集中どのマーカーがどのタスクか分からない」というギャップが見つかり、`functional-design.md`のコンポーネント設計には無かったものを追加した |
| `src/commands/createTaskFromSelection.ts`                                            | 選択範囲からのタスク化、インラインタイトル入力                                                                                                                                                                                                   |
| `src/commands/setParent.ts`                                                          | タスクの親変更                                                                                                                                                                                                                                   |
| `src/commands/setFocus.ts`                                                           | フォーカスの設定・解除                                                                                                                                                                                                                           |
| `src/commands/markStatus.ts`                                                         | ステータス変更(未完了 / 完了)                                                                                                                                                                                                                    |
| `src/commands/pickTask.ts`                                                           | タスク選択QuickPickの共通処理(短縮ID付きラベル整形)。5コマンドで同じ整形ロジックが必要になったため共通化                                                                                                                                         |
| `src/commands/markerEditing.ts`                                                      | 選択範囲→行範囲変換、マーカー挿入の適用という、タスク化・再アンカーの両方で必要な処理の共通化                                                                                                                                                    |
| `src/commands/reanchorTask.ts`                                                       | アンカー未接続タスクの参照先を新しい範囲に張り替える                                                                                                                                                                                             |
| `src/commands/deleteTask.ts`                                                         | タスクの削除。子タスクの昇格/再帰削除の選択、削除確認ダイアログを含む                                                                                                                                                                            |

以下はPhase 2以降で作成し、今回は作成しない。

- `src/services/stallDetector.ts`
- `src/services/summaryGenerator.ts`
- `src/services/jiraClient.ts`
- `src/commands/linkJiraIssue.ts`
- `src/commands/pushSummaryToJira.ts`

## データ構造の変更

`functional-design.md`のER図に対し、Phase 1では以下の通り実装範囲を絞る。

- `status`は`'open' | 'done'`の2値のみ実装する(`'stalled'`は`StallDetector`実装時に追加する)
- 「アンカー未接続」は`status`の値としては持たせない。マーカーの解決に失敗したかどうかを`TaskTreeViewProvider`が描画時に都度判定し、UI上の警告表示としてのみ表現する(永続化される状態としては扱わない)
- `jiraIssueKey`・`includeInAncestorSummary`はフィールドとして型定義に含めるが、Phase 1のどのコマンドからも設定・参照しない
- `TaskStore`に`delete(taskId, { cascade })`・`getDescendantIds(taskId)`・`updateAnchor(taskId, anchor)`を追加する。`delete`の子タスク扱いは呼び出し元(コマンド層)が`cascade`で指定し、`TaskStore`自体は昇格/再帰削除どちらのポリシーも受け入れられるようにする

## 影響範囲の分析

- 新規プロジェクトのため、既存コードへの影響はない
- Phase 1の`Task`型・`TaskStorage`インターフェースは、Phase 2で`jiraIssueKey`等を利用する機能を追加する際にそのまま使える設計とし、後方互換性を意識した変更を不要にする
- テストは`development-guidelines.md`の規約通り、`services`配下(`markerAnchorService`・`taskStore`)はVitestでの単体テストを必須とする。`commands`/`views`は主要フロー(タスク化→ツリー表示→親変更→フォーカス)の結合テストを`@vscode/test-electron`で用意する
