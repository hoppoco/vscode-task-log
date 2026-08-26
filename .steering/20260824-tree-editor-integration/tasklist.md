# タスクツリー・エディタ連携強化 タスクリスト

`design.md`の実装アプローチ(共通ロジックの`taskLocator`から着手)に沿って並べている。

## 1. 共通ロジック(`vscode`非依存、Vitestテスト必須)

- [x] `src/services/taskLocator.ts`実装(`findInnermostContainingTask`:行範囲を完全に含む最も内側のタスクを求める)
- [x] `taskLocator.test.ts`作成(単一マーカー・入れ子マーカー・該当なし・重なり・アンカー未解決の候補を無視、の5テスト。全て成功)

## 2. カーソル位置に簡単にタスクを作成できるようにする

- [x] `src/commands/markerEditing.ts`の`selectionToLineRange`を変更(空選択時はエラーにせず現在行を返す)。戻り値もエラーケースが無くなったため`LineRange | undefined`から`LineRange`に変更
- [x] 呼び出し元(`createTaskFromSelection`・`reanchorTask`)の不要になったnullチェックを削除

## 3. 作成時の親デフォルトを、包含する既存タスク優先にする

- [x] `src/commands/createTaskFromSelection.ts`を変更(`taskLocator`で包含タスクを検索し、あれば最優先で親にする。無ければ従来通りフォーカスを使う)

## 4. タスクツリーの表示強化

- [x] `src/views/taskTreeViewProvider.ts`変更:`TaskTreeItem`にログファイル名を`description`に追加
- [x] `src/views/taskTreeViewProvider.ts`変更:`contextValue`をステータス別(`taskLog.task.open` / `taskLog.task.done`)に分ける

## 5. ツリー項目クリックでエディタを開く

- [x] `src/commands/revealTaskInEditor.ts`実装(ログを開き、アンカー範囲先頭にカーソル移動)
- [x] `TaskTreeItem.command`に設定

## 6. インラインボタンでのステータス切替

- [x] `package.json`の既存`markDone`/`markOpen`コマンド定義に`icon`を追加(新規コマンドは増やさず、同じコマンドIDを再利用)
- [x] `package.json`の`contributes.menus.view/item/context`に、ステータス別`when`句で`inline`グループとして追加

## 7. ドラッグ&ドロップでの親変更

- [x] `src/views/taskTreeDragAndDropController.ts`実装
- [x] `src/extension.ts`で`registerTreeDataProvider`を`createTreeView`に変更し、`dragAndDropController`を指定

## 8. カーソル位置に対応するタスクツリー項目のハイライト

- [x] `src/views/cursorSyncController.ts`実装(`taskLocator`使用、150msデバウンス込み)
- [x] `src/extension.ts`で`onDidChangeTextEditorSelection`・`onDidChangeActiveTextEditor`を購読し登録

## 9. カーソル位置のタスクのステータス切替コマンド

- [x] `src/commands/toggleStatusAtCursor.ts`実装
- [x] `package.json`の`contributes.commands`に追加

## 10. 結合テスト・動作確認

- [x] 結合テストを追加(タスク化、選択無しでのタスク化、既存マーカー内での自動親設定、ツリークリック相当のエディタジャンプ、カーソル位置でのステータス切替、アンカー再設定、削除の7テスト)。D&Dは`vscode.DataTransfer`等の実行時APIに依存するため、結合テストでの自動検証は行わず実機確認のみとする(design.mdで事前に想定していた制約)
- [x] 型チェック・Lint・単体テスト(27件)・esbuildバンドル・`tsc`での結合テストコンパイルが全て成功
- [x] `.vsix`を作成(`tasklog-0.0.1.vsix`)
- [x] 実機での一通りの確認(ユーザーにより確認済み)

## 11. ドキュメント反映

- [x] `docs/functional-design.md`(コンポーネント設計・コマンド一覧・システム構成図・ユースケース図)を更新
- [x] `docs/repository-structure.md`(新規ファイル)を更新

## 完了条件

`requirements.md`の受け入れ条件をすべて満たしている(ユーザーによる実機確認済み)。

- [x] インラインボタンでのステータス切替
- [x] ツリークリックでのエディタジャンプ
- [x] ドラッグ&ドロップでの親変更
- [x] カーソル移動によるツリーハイライト(フォーカスに影響しないことも含めて)
- [x] カーソル位置でのステータス切替コマンド
- [x] 選択無しでのタスク化(現在行が対象になること)
- [x] 既存マーカー内での新規作成時に、自動的に親が設定されること
