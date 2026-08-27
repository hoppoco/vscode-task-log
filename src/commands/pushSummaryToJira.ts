import * as vscode from 'vscode';
import type { Task } from '../models/task';
import { buildSummary } from '../services/summaryGenerator';
import type { TaskStore } from '../services/taskStore';
import { getJiraClient } from './getJiraClient';
import { pickTask } from './pickTask';

export function registerPushSummaryToJira(
  taskStore: TaskStore,
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'taskLog.pushSummaryToJira',
    async (preselected?: Task) => {
      const target =
        preselected ??
        (await pickTask(taskStore, { placeHolder: '要約するタスクを選択してください' }));
      if (!target) {
        return;
      }

      const linkedRoot = taskStore.findNearestJiraLinkedTask(target.id);
      if (!linkedRoot || !linkedRoot.jiraIssueKey) {
        vscode.window.showErrorMessage(
          'このタスクの自身または祖先に、Jiraチケットへの紐付けが見つかりません。先に「Task Log: Jiraチケットに紐付け」を実行してください。',
        );
        return;
      }

      const summaryText = buildSummary(linkedRoot.id, taskStore.getAll());
      const previewDocument = await vscode.workspace.openTextDocument({
        content: summaryText,
        language: 'plaintext',
      });
      await vscode.window.showTextDocument(previewDocument);

      // モーダルにすると編集できなくなるため、あえて非モーダルの確認にする
      const choice = await vscode.window.showInformationMessage(
        `「${linkedRoot.jiraIssueKey}」へ投稿します。内容を確認・必要なら編集してから選んでください。`,
        '投稿する',
        'キャンセル',
      );
      if (choice !== '投稿する') {
        return;
      }

      const client = await getJiraClient(context);
      if (!client) {
        return;
      }

      try {
        await client.postComment(linkedRoot.jiraIssueKey, previewDocument.getText());
        vscode.window.showInformationMessage('Jiraへ投稿しました');
      } catch (error) {
        vscode.window.showErrorMessage(`投稿に失敗しました: ${(error as Error).message}`);
      }
    },
  );
}
