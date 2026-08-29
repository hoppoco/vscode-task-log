import * as vscode from 'vscode';
import type { Task } from '../models/task';
import { JiraCommentPostError } from '../services/jiraClient';
import { buildSummaryTree, type SummaryNode } from '../services/summaryGenerator';
import type { TaskStore } from '../services/taskStore';
import { getJiraClient } from './getJiraClient';
import { pickTask } from './pickTask';

/** ステータスラベルの文言化はl10n対応のためcommands層で行う(services層はvscodeに依存しない) */
function renderSummaryText(nodes: SummaryNode[]): string {
  return nodes
    .map((node) => {
      const statusLabel = node.status === 'done' ? vscode.l10n.t('Done') : vscode.l10n.t('Open');
      return `${'  '.repeat(node.depth)}- [${statusLabel}] ${node.title}`;
    })
    .join('\n');
}

export function registerPushSummaryToJira(
  taskStore: TaskStore,
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'taskLog.pushSummaryToJira',
    async (preselected?: Task) => {
      const target =
        preselected ??
        (await pickTask(taskStore, { placeHolder: vscode.l10n.t('Select the task to summarize') }));
      if (!target) {
        return;
      }

      const linkedRoot = taskStore.findNearestJiraLinkedTask(target.id);
      if (!linkedRoot || !linkedRoot.jiraIssueKey) {
        vscode.window.showErrorMessage(
          vscode.l10n.t(
            'No Jira link was found on this task or its ancestors. Run "Task Log: Link to Jira Issue" first.',
          ),
        );
        return;
      }

      const summaryText = renderSummaryText(buildSummaryTree(linkedRoot.id, taskStore.getAll()));
      const previewDocument = await vscode.workspace.openTextDocument({
        content: summaryText,
        language: 'plaintext',
      });
      await vscode.window.showTextDocument(previewDocument);

      // モーダルにすると編集できなくなるため、あえて非モーダルの確認にする
      const postLabel = vscode.l10n.t('Post');
      const choice = await vscode.window.showInformationMessage(
        vscode.l10n.t(
          'This will post to "{0}". Review or edit the content, then choose whether to post.',
          linkedRoot.jiraIssueKey,
        ),
        postLabel,
        vscode.l10n.t('Cancel'),
      );
      if (choice !== postLabel) {
        return;
      }

      const client = await getJiraClient(context);
      if (!client) {
        return;
      }

      try {
        await client.postComment(linkedRoot.jiraIssueKey, previewDocument.getText());
        vscode.window.showInformationMessage(vscode.l10n.t('Posted to Jira.'));
      } catch (error) {
        if (error instanceof JiraCommentPostError) {
          vscode.window.showErrorMessage(
            vscode.l10n.t('Failed to post to Jira (status {0}).', error.status),
          );
        } else {
          vscode.window.showErrorMessage(
            vscode.l10n.t('Failed to post to Jira: {0}', (error as Error).message),
          );
        }
      }
    },
  );
}
