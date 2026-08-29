import * as vscode from 'vscode';
import type { Task } from '../models/task';
import { TaskNotFoundError, type TaskStore } from '../services/taskStore';
import type { TaskCodeLensProvider } from '../views/taskCodeLensProvider';
import type { TaskTreeViewProvider } from '../views/taskTreeViewProvider';
import { pickTask } from './pickTask';

export function registerDeleteTask(
  taskStore: TaskStore,
  treeProvider: TaskTreeViewProvider,
  codeLensProvider: TaskCodeLensProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand('taskLog.deleteTask', async (preselected?: Task) => {
    const target =
      preselected ??
      (await pickTask(taskStore, { placeHolder: vscode.l10n.t('Select the task to delete') }));
    if (!target) {
      return;
    }

    const descendantCount = taskStore.getDescendantIds(target.id).length;
    let cascade = false;
    if (descendantCount > 0) {
      const choice = await vscode.window.showQuickPick(
        [
          {
            label: vscode.l10n.t("Promote child tasks (move under this task's parent)"),
            cascade: false,
          },
          {
            label: vscode.l10n.t('Delete all {0} child task(s) too', descendantCount),
            cascade: true,
          },
        ],
        {
          placeHolder: vscode.l10n.t(
            '"{0}" has child tasks. What would you like to do?',
            target.title,
          ),
        },
      );
      if (!choice) {
        return;
      }
      cascade = choice.cascade;
    }

    const confirmMessage = cascade
      ? vscode.l10n.t(
          'This will delete "{0}" and {1} child task(s). The log text (including markers) will not be changed.',
          target.title,
          descendantCount,
        )
      : vscode.l10n.t(
          'This will delete "{0}". The log text (including markers) will not be changed.',
          target.title,
        );
    const deleteLabel = vscode.l10n.t('Delete');
    const confirmed = await vscode.window.showWarningMessage(
      confirmMessage,
      { modal: true },
      deleteLabel,
    );
    if (confirmed !== deleteLabel) {
      return;
    }

    try {
      await taskStore.delete(target.id, { cascade });
      treeProvider.refresh();
      codeLensProvider.refresh();
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to delete the task: the task no longer exists.'),
        );
      } else {
        vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to delete the task: {0}', (error as Error).message),
        );
      }
    }
  });
}
