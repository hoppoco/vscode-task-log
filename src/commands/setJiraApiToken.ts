import * as vscode from 'vscode';
import { JIRA_API_TOKEN_SECRET_KEY } from './getJiraClient';

export function registerSetJiraApiToken(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('taskLog.setJiraApiToken', async () => {
    const token = await vscode.window.showInputBox({
      prompt: 'Jira APIトークンを入力してください',
      password: true,
      ignoreFocusOut: true,
    });
    if (!token) {
      return;
    }

    await context.secrets.store(JIRA_API_TOKEN_SECRET_KEY, token);
    vscode.window.showInformationMessage('Jira APIトークンを保存しました');
  });
}
