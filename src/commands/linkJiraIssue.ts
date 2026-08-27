import * as vscode from 'vscode';
import type { Task } from '../models/task';
import type { TaskStore } from '../services/taskStore';
import { getJiraClient } from './getJiraClient';
import { pickTask } from './pickTask';

export function registerLinkJiraIssue(
  taskStore: TaskStore,
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand('taskLog.linkJiraIssue', async (preselected?: Task) => {
    const target =
      preselected ??
      (await pickTask(taskStore, { placeHolder: '紐づけるタスクを選択してください' }));
    if (!target) {
      return;
    }

    const issueKey = await vscode.window.showInputBox({
      prompt: 'Jiraチケットキーを入力してください(例: PROJ-123)',
    });
    if (!issueKey) {
      return;
    }

    const client = await getJiraClient(context);
    if (!client) {
      return;
    }

    let issue;
    try {
      issue = await client.getIssueSummary(issueKey);
    } catch (error) {
      vscode.window.showErrorMessage(`チケットの確認に失敗しました: ${(error as Error).message}`);
      return;
    }

    let includeInAncestorSummary = false;
    const ancestorLink = taskStore.findNearestJiraLinkedTask(target.parentTaskId);
    if (ancestorLink && ancestorLink.jiraIssueKey !== issue.key) {
      const choice = await vscode.window.showQuickPick(
        [
          { label: '独立させる(祖先の要約には含めない)', include: false },
          { label: '祖先の要約にも含める', include: true },
        ],
        {
          placeHolder: `祖先が既に${ancestorLink.jiraIssueKey}に紐づいています。この部分木の扱いは?`,
        },
      );
      if (!choice) {
        return;
      }
      includeInAncestorSummary = choice.include;
    }

    await taskStore.setJiraLink(target.id, { jiraIssueKey: issue.key, includeInAncestorSummary });
    vscode.window.showInformationMessage(`「${issue.key}: ${issue.summary}」に紐付けました`);
  });
}
