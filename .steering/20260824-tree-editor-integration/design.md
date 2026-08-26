# タスクツリー・エディタ連携強化 設計

## 実装アプローチ

- カーソル位置から「対応するタスク(最も内側のマーカー範囲を持つタスク)」を求める処理は、ツリーのハイライト・カーソル位置でのステータス切替・作成時の親デフォルト決定の3箇所で共通して必要になる。`vscode`に依存しない純粋ロジックとして`src/services/`に切り出し、1箇所で実装・テストする
- `development-guidelines.md`のDIパターンを踏襲し、`services`層はテキストと行範囲・候補タスクの配列を受け取るだけの純粋関数にする(`vscode.TextDocument`や`vscode.Position`は直接扱わない)
- ドラッグ&ドロップ、行クリック、インラインボタンは、いずれもVSCode Extension APIの標準的な仕組み(`TreeDragAndDropController`、`TreeItem.command`、`contributes.menus`の`inline`グループ)で実現し、独自のクリックハンドリングは行わない

## 変更するコンポーネント

### 新規作成

| ファイル | 内容 |
|---|---|
| `src/services/taskLocator.ts` | 指定した行範囲を完全に含む、最も内側(範囲が最小)のタスクをログテキストと候補タスク一覧から求める純粋関数(`findInnermostContainingTask`)。カーソル位置の探索は`{ startLine: line, endLine: line }`として同じ関数を使う。マーカーが正しく入れ子になっている場合、範囲が最小のものが必ず最も内側のタスクと一致するため、この基準で正しく決まる。一方、マーカー同士が入れ子にならず一部だけ重なっている場合(例:A開始→B開始→A終了→B終了)は、範囲最小優先というルールは「入れ子構造」としての意味を持たない機械的な決着になる。これは既知の割り切りとし、重なりを検知して防止する処理は設けない(通常の入れ子で使う分には問題にならないため) |
| `src/views/taskTreeDragAndDropController.ts` | `vscode.TreeDragAndDropController<Task>`の実装。ドロップ先タスクを新しい親として`TaskStore.setParent`を呼ぶ。兄弟順序は扱わない |
| `src/views/cursorSyncController.ts` | `vscode.window.onDidChangeTextEditorSelection`を購読し、`taskLocator`でカーソル位置のタスクを求めて`TreeView.reveal()`を呼ぶ。フォーカス(`StatusBarController`)には触れない。連続的なカーソル移動でのパフォーマンス低下を避けるため、軽くデバウンスする |
| `src/commands/revealTaskInEditor.ts` | タスクツリーの項目クリック(`TreeItem.command`)で呼ばれる。タスクのログファイルを開き、アンカー範囲の先頭にカーソルを移動する |
| `src/commands/toggleStatusAtCursor.ts` | カーソル位置に対応するタスクのステータスをオープン⇔クローズで切り替える |
| `src/test/unit/services/taskLocator.test.ts` | `taskLocator`の単体テスト(Vitest) |

### 変更

| ファイル | 変更内容 |
|---|---|
| `src/views/taskTreeViewProvider.ts` | `TaskTreeItem`に`command`(クリックで`revealTaskInEditor`を実行)を設定。`contextValue`をステータスに応じて`taskLog.task.open` / `taskLog.task.done`に分け、インラインボタンの`when`句で使えるようにする。`description`にログファイル名(`path.basename`)を追加 |
| `src/commands/markerEditing.ts` | `selectionToLineRange`が空選択の場合、エラーにせず現在のカーソル行を1行の範囲として返すようにする(`createTaskFromSelection`・`reanchorTask`の両方に影響) |
| `src/commands/createTaskFromSelection.ts` | 新規タスクの親のデフォルトを、(1)選択範囲を包含する既存タスクがあればそれ、(2)無ければ現在のフォーカス、(3)どちらも無ければルート、という優先順位で決定する。`taskLocator`を使う。「包含」は選択範囲を完全に囲んでいることを条件とするため、既存タスクと一部だけ重なる選択(入れ子になっていない)は包含とみなされず、この判定では対象にならない |
| `src/extension.ts` | `vscode.window.registerTreeDataProvider`を`vscode.window.createTreeView`に変更し、`dragAndDropController`を指定。`TreeView`インスタンスを`CursorSyncController`に渡す。新コマンド・`onDidChangeTextEditorSelection`購読を登録 |
| `package.json` | `taskLog.toggleStatusAtCursor`・`taskLog.revealTaskInEditor`コマンドを追加。`contributes.menus.view/item/context`に、`taskLog.markDone`/`taskLog.markOpen`をステータス別`when`句で`inline`グループとして登録 |

## データ構造の変更

なし。`Task`型・`TaskStorage`インターフェースの変更は不要(表示・操作系の変更のみで、永続化データの形は変わらない)。

## 影響範囲の分析

- Phase 1で実装済みの機能(タスク化、親変更、フォーカス、CodeLens、アンカー再設定、削除)への破壊的変更はない。`createTaskFromSelection`の親決定ロジックのみ、優先順位が変わる(既存タスクへの包含判定が最優先になる)
- `vscode.window.registerTreeDataProvider` → `createTreeView`への変更は、`TreeDataProvider`としての振る舞いに影響しない(`createTreeView`は`TreeView`ハンドルを追加で返す上位互換のAPI)
- 実装後、`docs/functional-design.md`(コンポーネント設計・コマンド一覧・システム構成図)、`docs/repository-structure.md`(新規ファイル)、`docs/glossary.md`(新しい用語があれば)への反映が必要になる見込み。Phase 1と同様、実装・実機確認を経てから該当ドキュメントを更新する
- テストは`development-guidelines.md`の規約通り、`taskLocator.ts`はVitestでの単体テストを必須とする。ツリー・カーソル連携・D&Dは結合テストで主要フローをカバーする(D&Dの結合テストは`@vscode/test-electron`環境での再現がやや難しいため、可能な範囲で行う)
