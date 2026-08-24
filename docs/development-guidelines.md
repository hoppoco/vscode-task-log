# 開発ガイドライン

## 1. コーディング規約

- TypeScriptの`strict`モードを有効にする
- `src/services/`配下のモジュールは`vscode`を直接importしない。VSCode APIが必要な処理は、`repository-structure.md`で定めた依存性の注入(値を渡す、または小さなインターフェースを定義して実装を注入する)によって解決する
  - インターフェースは、それを利用する`services`側の都合だけで設計する。実装に使うライブラリ(VSCode API等)の関数シグネチャをそのまま引き写さない
  - インターフェースは、利用側が実際に呼び出すメソッドだけを持つ、可能な限り小さいものにする
- 1ファイルにつき1つの主要なクラス・モジュールとする
- コメントは「なぜそう書いたか」が非自明な箇所にのみ最小限記述する。コードを読めば分かることは書かない
- 例外処理は外部境界(Jira API呼び出し、ファイルI/O)でのみ行う。発生しえない状況に対する防御的なチェックは書かない

## 2. 命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| ファイル名 | camelCase | `taskStore.ts` |
| クラス名 | PascalCase | `TaskStore` |
| インターフェース名 | PascalCase(`I`等の接頭辞は付けない) | `TaskStorage` |
| 変数・関数 | camelCase | `createTaskFromSelection` |
| モジュールレベル定数 | UPPER_SNAKE_CASE | `DEFAULT_STALL_THRESHOLD_MS` |
| コマンドID | `taskLog.`で始まるドット区切り | `taskLog.createTaskFromSelection` |
| テストファイル | 対象ファイル名 + `.test.ts` | `taskStore.test.ts` |

## 3. スタイリング規約

- コードフォーマットはPrettierに従う。個別のスタイルルールを議論せず、フォーマッタの出力を正とする
- Lintは`ESLint` + `typescript-eslint`のrecommended設定をベースとする
- `src/services/`から`vscode`をimportしていないかをLintルール(`no-restricted-imports`等)で機械的に検知できるようにする。目視レビューに頼らない
- 共通のデザインシステムは使用しない(本ツールはVSCode標準UIコンポーネント(TreeView、StatusBar、QuickInput等)のみで構成され、独自UIを持たないため)

## 4. テスト規約

- `src/services/`配下のロジックは、Vitestによる単体テストを必須とする(マーカー解決、要約生成、停滞判定、タスクの親子関係操作など)
- `src/commands/`・`src/views/`は、`@vscode/test-electron`による結合テストで主要な操作フロー(タスク化、フォーカス切り替え、Jira連携など)のみをカバーする。全パターンの網羅は求めない
- テストは Arrange(準備) → Act(実行) → Assert(検証) の構成で書く
- 依存性を注入する形で設計したインターフェースは、モックライブラリではなく、メモリ上で完結する簡易な実装(フェイク)をテスト用に用意して差し替える

## 5. Git規約

- 個人開発のため、`main`ブランチを中心としたシンプルな運用とする。複雑なブランチ戦略・レビュープロセスは導入しない
- コミットメッセージはConventional Commits相当の接頭辞を用いる(`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`)
- 1コミットは1つの目的に対応させる(機能追加とリファクタリングを同一コミットに混在させない)

## 6. エラー・失敗時の扱い

失敗は性質によって3種類に分け、扱いを分ける。Result型のような追加の抽象化は導入せず、通常の例外(`throw`/`try-catch`)で統一する。

- **想定内のユーザー操作エラー**(無効なJiraキーの入力、ネットワーク切断時のpush失敗など):`services`側は例外を`throw`し、呼び出し元の`commands/`が`catch`して`vscode.window.showErrorMessage`でユーザーに通知する。`services`の内部で握りつぶさない
  - メッセージは「何が起きたか」だけでなく「次に何をすればよいか」が分かる文言にする(例:「Jiraへの投稿に失敗しました。ネットワーク接続を確認してください」)
- **内部的な状態の不整合**(マーカーが見つからずアンカーが解決できない等):例外として扱わず、`functional-design.md`で定義した「アンカー未接続」のようなタスクの状態としてモデル化し、ツリービュー上で表現する
- **予期しない例外(バグ)**:`vscode.window.showErrorMessage`での通知に加え、VSCodeの`OutputChannel`(拡張専用のログ出力先)にスタックトレースを記録する。`console.log`への直接出力は行わない

## 7. 破壊的操作・元に戻せない操作の扱い

タスクの削除など、実行すると元に戻せない操作を実装する際は、以下の2点を徹底する。

- **対象の絞り込み**:操作対象をQuickPick等で選ばせる場合、意味のある対象だけに一覧を絞り込む(例:`taskLog.reanchorTask`はアンカー未接続のタスクのみを選択肢に出す)。誤操作の機会自体を減らすことを、確認ダイアログより優先する
- **実行前の確認**:絞り込みをすり抜けて対象が渡された場合(将来のコンテキストメニュー経由など)や、操作自体が常に破壊的な場合(タスク削除)は、`vscode.window.showWarningMessage`の`modal: true`オプションで確認ダイアログを挟み、明示的な同意を得てから実行する
