# 初回実装(Phase 1)タスクリスト

`design.md`の実装アプローチ(依存の少ない層から順に)に沿って並べている。

## 1. プロジェクトセットアップ

- [x] `package.json`作成(拡張マニフェスト、`activationEvents`、`contributes.commands`等)
- [x] `tsconfig.json`作成(`strict`有効)
- [x] `esbuild.js`作成(バンドル設定)
- [x] `eslint.config.js`作成(typescript-eslint recommended、`src/services/`から`vscode`のimportを禁止するルールを含める)
- [x] `.prettierrc`作成
- [x] Vitest設定
- [x] `.vscode/launch.json`作成(F5での拡張機能デバッグ起動)
- [x] `.vscodeignore`作成

## 2. モデル定義

- [x] `src/models/task.ts`作成(`Task`型。`jiraIssueKey`・`includeInAncestorSummary`はPhase 2用として型に含めるが未使用)

## 3. サービス層(`vscode`非依存、Vitestテスト必須)

- [x] `src/services/markerAnchorService.ts`実装(開始・終了マーカーの挿入、範囲解決)
- [x] `markerAnchorService.test.ts`作成(8テスト、全て成功)
- [x] `src/services/taskStore.ts`実装(`TaskStorage`インターフェース定義を含む、CRUD・親子関係操作・削除・アンカー再設定)
- [x] `taskStore.test.ts`作成(14テスト、全て成功。フェイクの`TaskStorage`実装を用いる)

## 4. VSCode API層(views)

- [x] `src/views/taskTreeViewProvider.ts`実装(親子構造の描画、アンカー未接続の警告表示)
- [x] `src/views/statusBarController.ts`実装(フォーカス中タスクのパンくず表示)

## 5. コマンド層

- [x] `src/commands/createTaskFromSelection.ts`実装(マーカー挿入 + インラインタイトル入力)
- [x] `src/commands/setParent.ts`実装
- [x] `src/commands/setFocus.ts` / `clearFocus`実装
- [x] `src/commands/markStatus.ts`実装(未完了 / 完了の切り替え)
- [x] `src/extension.ts`実装(`activate`内でコマンド・View登録、`TaskStorage`の実VSCode実装を生成して`TaskStore`に注入)

### Phase 1中に追加で見つかった対応

- [x] `src/views/taskCodeLensProvider.ts`実装(実機確認で「編集中にマーカーとタスクの対応が分からない」というギャップが見つかったため追加。マーカー範囲の直上にタスク名をCodeLens表示し、クリックでフォーカス)
- [x] `src/commands/pickTask.ts`実装(タスク選択QuickPickの共通処理、短縮ID付きラベル表示)。既存の`setParent`/`setFocus`/`markStatus`もこちらに寄せて重複を解消
- [x] `src/commands/markerEditing.ts`実装(選択範囲→行範囲変換、マーカー挿入適用の共通処理)。`createTaskFromSelection`をこちらを使う形にリファクタ
- [x] `src/commands/reanchorTask.ts`実装(アンカー未接続タスクの参照先を新しい範囲に張り替え)。当初は全タスクが選択対象になっていたが、ユーザーからのフィードバックでアンカー未接続のタスクのみに絞り込むよう修正し、接続済みタスクが対象になった場合の確認ダイアログも追加
- [x] `src/commands/deleteTask.ts`実装(タスク削除。子タスクの昇格/再帰削除を選択、削除確認ダイアログあり。ログ本文・マーカーには一切触れない)
- [x] `docs/functional-design.md`・`docs/glossary.md`を更新(削除・再アンカーコマンドの追記、「アンカー未接続」の実装との食い違いの修正、タスクID概念の追加)

## 6. 結合テスト

- [x] `@vscode/test-electron`セットアップ
- [x] 主要フロー(タスク化 → ツリー表示 → CodeLens表示 → アンカー再設定 → 削除)の結合テスト作成
- [ ] 実行確認(**未実施のまま据え置き(意図的な判断)**。このコンテナ環境にはElectron実行に必要な共有ライブラリが無く、`sudo`権限も無いため、`npm run test:integration`を実行するとVSCodeの起動自体に失敗する。コード自体はビルド・型チェックを通過しているが、実際にテストが通ることは検証できていない。Phase 1の全機能は実機で人力確認済みのため緊急性は低いと判断し、今回は未実施のまま残す。実行する場合は、ローカルのVSCode開発環境(`npm install` → `npm run test:integration`)またはCI環境で行う)

## 7. 動作確認

- [x] `vsce package`で`.vsix`を作成(`tasklog-0.0.1.vsix`、不要ファイルを`.vscodeignore`で除外済み)
- [x] ローカルインストールし、選択範囲からのタスク化を実機で確認(ユーザーにより確認済み)
- [x] ログ内のマーカーを手動で削除し保存後、「アンカー未接続」表示になることを確認(ユーザーにより確認済み。当初リアルタイムに反映されない不備があり、ログ保存時にツリーを再描画する修正を実施した上で確認)
- [x] 親変更(`setParent`)・フォーカス切り替え・ステータス変更(`markDone`/`markOpen`)の実機確認(ユーザーにより確認済み)
- [x] CodeLens表示・クリックでのフォーカス切り替えの実機確認(ユーザーにより確認済み)
- [x] アンカー再設定(`taskLog.reanchorTask`)の実機確認(ユーザーにより確認済み。当初アンカー未接続以外のタスクも選択できてしまう不備があり、未接続のタスクのみに絞り込む修正を実施した上で確認)
- [x] タスク削除(`taskLog.deleteTask`、昇格/再帰削除の両方)の実機確認(ユーザーにより確認済み)

## 完了条件

`requirements.md`の受け入れ条件のうち、コードレベルで検証できるものは満たしている(型チェック・Lint・単体テスト22件が全て成功)。実機確認の状況:

- [x] タスク化・ツリー表示・アンカー未接続表示・親変更・フォーカス・ステータス変更・CodeLens・アンカー再設定・タスク削除は実機で確認済み
- [ ] 統合テスト(`npm run test:integration`)がライブラリの揃った環境で成功する(このコンテナでは環境制約により未実行。Phase 1の全機能は実機確認済みのため、今回は意図的に未実施のまま据え置く。コード変更時など、必要になったタイミングで改めて実行する)
