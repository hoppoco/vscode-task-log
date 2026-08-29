import * as vscode from 'vscode';
import type { Task } from '../models/task';
import { JiraIssueFetchError } from '../services/jiraClient';
import { TaskNotFoundError, type TaskStore } from '../services/taskStore';
import { getJiraClient } from './getJiraClient';
import { pickTask } from './pickTask';

export function registerLinkJiraIssue(
  taskStore: TaskStore,
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand('taskLog.linkJiraIssue', async (preselected?: Task) => {
    const target =
      preselected ??
      (await pickTask(taskStore, { placeHolder: vscode.l10n.t('Select the task to link') }));
    if (!target) {
      return;
    }

    const issueKey = await vscode.window.showInputBox({
      prompt: vscode.l10n.t('Enter the Jira issue key (e.g. PROJ-123)'),
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
      if (error instanceof JiraIssueFetchError) {
        vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to verify the issue (status {0}).', error.status),
        );
      } else {
        vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to verify the issue: {0}', (error as Error).message),
        );
      }
      return;
    }

    let includeInAncestorSummary = false;
    const ancestorLink = taskStore.findNearestJiraLinkedTask(target.parentTaskId);
    const ancestorJiraIssueKey = ancestorLink?.jiraIssueKey;
    if (ancestorJiraIssueKey && ancestorJiraIssueKey !== issue.key) {
      const choice = await vscode.window.showQuickPick(
        [
          {
            label: vscode.l10n.t('Keep it independent (exclude from the ancestor summary)'),
            include: false,
          },
          { label: vscode.l10n.t('Include it in the ancestor summary'), include: true },
        ],
        {
          placeHolder: vscode.l10n.t(
            'An ancestor is already linked to {0}. How should this subtree be treated?',
            ancestorJiraIssueKey,
          ),
        },
      );
      if (!choice) {
        return;
      }
      includeInAncestorSummary = choice.include;
    }

    try {
      await taskStore.setJiraLink(target.id, { jiraIssueKey: issue.key, includeInAncestorSummary });
      vscode.window.showInformationMessage(
        vscode.l10n.t('Linked to "{0}: {1}".', issue.key, issue.summary),
      );
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to link the task: the task no longer exists.'),
        );
      } else {
        vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to link the task: {0}', (error as Error).message),
        );
      }
    }
  });
}
