# Jira連携 設計

## 実装アプローチ

- `JiraClient`・`SummaryGenerator`は`vscode`非依存のサービスとして実装し、Vitestで単体テストする。`JiraClient`は`fetch`をテストで差し替えられるようにする(グローバル`fetch`をモック)
- Jira接続情報(URL・メールアドレス・APIトークン)の取得は`vscode`APIが必要なため、`services`層には持たせない。`commands`層に「`context`を受け取り、設定と保存済みトークンから`JiraClient`を組み立てる」関数`getJiraClient(context)`を置き、これを必要とする各コマンドは`context`を依存として受け取り、実行のたびにこの関数を呼ぶ
- 破壊的操作の確認パターン(`development-guidelines.md`7章)を踏襲し、Jiraへの投稿は「生成したテキストをエディタで開いて確認・編集してから、非モーダルな確認メッセージで投稿を実行する」という流れにする。モーダルダイアログにすると編集ができなくなるため、あえて非モーダルにする

## 変更するコンポーネント

### 新規作成

| ファイル | 内容 |
|---|---|
| `src/services/jiraClient.ts` | `JiraClient`クラス。コンストラクタで`{ baseUrl, email, apiToken }`を受け取る(値渡し、DIパターンのパターン1)。`getIssueSummary(issueKey)`でチケットの存在確認とタイトル取得、`postComment(issueKey, text)`でコメント投稿。コメント本文はAtlassian Document Format(ADF)が必須のため、テキスト全体を1つの`codeBlock`ノードとして包む(プレビューで見た内容がインデントも含めてそのままJira上に反映されるようにするため) |
| `src/services/summaryGenerator.ts` | `buildSummary(rootTaskId, allTasks)`。指定タスクを起点に、子孫タスクのタイトルとステータスをインデント付きテキストで組み立てる。降りていく途中で、現在の「有効なJiraチケットスコープ」と異なる`jiraIssueKey`を持つタスクに出会ったら、そこが部分木の境界。`includeInAncestorSummary`が偽ならその部分木ごと除外し、真なら含めた上でスコープをそのタスクのキーに更新し、さらに降りる |
| `src/commands/getJiraClient.ts` | `getJiraClient(context)`。拡張設定(`taskLog.jira.baseUrl`・`taskLog.jira.email`)とSecretStorageのAPIトークンから`JiraClient`を組み立てて返す(非同期関数、呼ぶたびに現在の設定・トークンを読み直す)。いずれか未設定ならエラーメッセージを表示し`undefined`を返す。SecretStorageのキー名(`taskLog.jiraApiToken`)もここで定義し、`setJiraApiToken`と共有する |
| `src/commands/setJiraApiToken.ts` | APIトークンをパスワード入力(`password: true`)で受け取り、SecretStorageに保存する |
| `src/commands/linkJiraIssue.ts` | タスクにJiraチケットキーを紐づける。`context`を受け取り、内部で`getJiraClient(context)`を呼ぶ。`JiraClient.getIssueSummary`で存在確認し、取得したサマリをメッセージで示す。親方向に`TaskStore.findNearestJiraLinkedTask`を辿り、既に異なるチケットに紐づく祖先があれば「含める/含めない」を選択させる |
| `src/commands/pushSummaryToJira.ts` | `context`を受け取り、内部で`getJiraClient(context)`を呼ぶ。対象タスクから自身を含めて`findNearestJiraLinkedTask`で紐付け先を解決し、`buildSummary`で要約テキストを生成。Untitledドキュメントとして開いてプレビューし、非モーダルな確認メッセージで投稿を実行する |
| `src/test/unit/services/jiraClient.test.ts` | `JiraClient`の単体テスト(`fetch`をモック) |
| `src/test/unit/services/summaryGenerator.test.ts` | `buildSummary`の単体テスト(通常の階層、除外あり/なしの境界ケースなど) |

### 変更

| ファイル | 変更内容 |
|---|---|
| `src/services/taskStore.ts` | `setJiraLink(taskId, { jiraIssueKey, includeInAncestorSummary })`を追加。`findNearestJiraLinkedTask(taskId)`を追加(自身を含めて`jiraIssueKey`を持つ最も近いタスクを親方向に辿る。`null`が渡された場合は`undefined`を返す) |
| `package.json` | `contributes.configuration`に`taskLog.jira.baseUrl`・`taskLog.jira.email`を追加。`contributes.commands`に`taskLog.setJiraApiToken`・`taskLog.linkJiraIssue`・`taskLog.pushSummaryToJira`を追加 |
| `src/extension.ts` | `context`を`registerLinkJiraIssue`・`registerPushSummaryToJira`・`registerSetJiraApiToken`に渡し、3つの新コマンドを登録する |

## データ構造の変更

`Task`型自体の変更は無い(`jiraIssueKey`・`includeInAncestorSummary`は初回実装時に既に用意済み)。`TaskStore`にJira関連の操作メソッドを追加するのみ。

## 影響範囲の分析

- 既存のPhase 1・タスクツリー連携強化の機能への影響はない(新規コマンド・新規サービスの追加のみ)
- `JiraClient`はテストでは`fetch`をモックして検証する。実際のJira環境に対する結合テストは、認証情報が必要なため自動テストの対象外とし、実機での確認に委ねる
- `docs/functional-design.md`の7〜8章は既にほぼこの設計を反映済みだが、要約の中身(タイトル+ステータスの階層テキストであり、ログ抜粋やAI生成ではないこと)、投稿前プレビュー、認証設定方法(拡張設定+SecretStorage)は実装後に追記が必要
