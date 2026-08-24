# リポジトリ構造定義書

## 1. フォルダ・ディレクトリ構成

```
(リポジトリルート)/
├── .steering/                      # 作業単位のステアリングドキュメント
├── docs/                           # 永続的ドキュメント
├── .vscode/
│   ├── launch.json                 # F5での拡張機能デバッグ起動設定
│   ├── tasks.json                  # デバッグ起動前のビルドタスク
│   └── extensions.json             # 開発時の推奨拡張機能
├── src/
│   ├── extension.ts                # 拡張のエントリポイント(activate/deactivate)
│   ├── models/
│   │   └── task.ts                 # Taskの型定義
│   ├── services/                   # VSCode APIに依存しない純粋ロジック中心
│   │   ├── markerAnchorService.ts  # マーカーの挿入・解決ロジック
│   │   ├── taskStore.ts            # タスクの永続化・CRUD・親子操作・アンカー再設定
│   │   ├── stallDetector.ts        # 停滞判定ロジック(Phase 2)
│   │   ├── summaryGenerator.ts     # 要約テキストの組み立て(Phase 2)
│   │   └── jiraClient.ts           # Jira REST APIクライアント(Phase 2)
│   ├── views/                      # VSCode APIに依存するUI層
│   │   ├── taskTreeViewProvider.ts
│   │   ├── statusBarController.ts
│   │   └── taskCodeLensProvider.ts # ログ編集中、マーカー範囲直上へのタスク名表示
│   ├── commands/                   # コマンドハンドラ(servicesを呼び出す薄い層)
│   │   ├── createTaskFromSelection.ts
│   │   ├── setParent.ts
│   │   ├── setFocus.ts
│   │   ├── markStatus.ts
│   │   ├── reanchorTask.ts
│   │   ├── deleteTask.ts
│   │   ├── linkJiraIssue.ts        # Phase 2
│   │   ├── pushSummaryToJira.ts    # Phase 2
│   │   ├── pickTask.ts             # タスク選択QuickPickの共通処理
│   │   └── markerEditing.ts        # 選択範囲へのマーカー挿入の共通処理
│   └── test/
│       ├── unit/                   # Vitestによる純粋ロジックの単体テスト
│       └── integration/            # @vscode/test-electronによる結合テスト
├── esbuild.js                      # バンドル設定
├── package.json                    # 拡張マニフェスト(contributes, activationEvents等を含む)
├── package-lock.json
├── tsconfig.json
├── eslint.config.js
├── .prettierrc
├── .gitignore
└── .vscodeignore                   # .vsix化時の除外設定
```

## 2. ディレクトリの役割

| ディレクトリ | 役割 |
|---|---|
| `docs/` | アプリケーション全体の恒久的な設計文書 |
| `.steering/` | 作業単位の要求・設計・タスクリスト |
| `src/models/` | データ構造の型定義のみを置く。ロジックは持たない |
| `src/services/` | `vscode`モジュールへの依存を極力避け、単体テストしやすい形でビジネスロジックを実装する層。マーカー解決、停滞判定、要約組み立てなど、`functional-design.md`のコンポーネント設計に対応する |
| `src/views/` | TreeView・StatusBarなど、`vscode` APIに直接依存するUI表示層 |
| `src/commands/` | `package.json`の`contributes.commands`に対応するハンドラ。基本的に`services`を呼び出すだけの薄い層とし、ロジックを持たせない。複数のコマンドハンドラから共通で使う処理(タスク選択QuickPick、マーカー挿入など)も、コマンド登録は持たないヘルパーとしてこの配下に置く |
| `src/test/unit/` | `services`配下の純粋ロジックを対象としたVitestテスト。VSCode拡張ホストを起動せず高速に実行する |
| `src/test/integration/` | コマンド実行やTreeView表示など、VSCode API込みの結合テスト |

## 3. ファイル配置ルール

- 1ファイルにつき1つの主要なクラス・モジュールを置く(`taskStore.ts`にはTaskStoreクラスのみ、など)
- `services/`配下のファイルは`vscode`モジュールを直接importしない。VSCode APIが必要な処理(ファイルシステムアクセスの一部、SecretStorageなど)は、呼び出し元の`commands/`または`views/`から関数引数・コンストラクタ経由で渡す
- 新しいコマンドを追加する場合、`src/commands/`に1ファイル追加し、`package.json`の`contributes.commands`および`src/extension.ts`での登録をあわせて更新する
- テストファイルは対象ファイルと同じ相対構造で`src/test/unit/`または`src/test/integration/`配下に配置する(例:`src/services/taskStore.ts` → `src/test/unit/services/taskStore.test.ts`)
