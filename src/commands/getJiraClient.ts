import * as vscode from 'vscode';
import { JiraClient } from '../services/jiraClient';

export const JIRA_API_TOKEN_SECRET_KEY = 'taskLog.jiraApiToken';

/**
 * 拡張設定(taskLog.jira.baseUrl / taskLog.jira.email)とSecretStorageのAPIトークンから
 * JiraClientを組み立てる。呼ぶたびに現在の設定・トークンを読み直すため、設定変更後も
 * 次回呼び出しからすぐ反映される。いずれか未設定の場合はエラーメッセージを表示しundefinedを返す。
 */
export async function getJiraClient(
  context: vscode.ExtensionContext,
): Promise<JiraClient | undefined> {
  const config = vscode.workspace.getConfiguration('taskLog.jira');
  const baseUrl = config.get<string>('baseUrl');
  const email = config.get<string>('email');
  const apiToken = await context.secrets.get(JIRA_API_TOKEN_SECRET_KEY);

  if (!baseUrl || !email || !apiToken) {
    vscode.window.showErrorMessage(
      'Jira接続設定が未完了です。設定でURL・メールアドレスを入力し、' +
        '「Task Log: Jira APIトークンを設定」を実行してください。',
    );
    return undefined;
  }

  return new JiraClient({ baseUrl, email, apiToken });
}
