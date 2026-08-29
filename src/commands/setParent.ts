import * as vscode from 'vscode';
import type { Task } from '../models/task';
import {
  CannotMoveUnderOwnDescendantError,
  TaskNotFoundError,
  type TaskStore,
} from '../services/taskStore';
import type { TaskTreeViewProvider } from '../views/taskTreeViewProvider';
import { formatTaskLabel, pickTask } from './pickTask';

export function registerSetParent(
  taskStore: TaskStore,
  treeProvider: TaskTreeViewProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand('taskLog.setParent', async (preselected?: Task) => {
    const target =
      preselected ??
      (await pickTask(taskStore, {
        placeHolder: vscode.l10n.t('Which task do you want to reparent?'),
      }));
    if (!target) {
      return;
    }

    const candidates = taskStore.getAll().filter((task) => task.id !== target.id);
    const items: (vscode.QuickPickItem & { taskId: string | null })[] = [
      { label: vscode.l10n.t('(Move to root)'), taskId: null },
      ...candidates.map((task) => ({ label: formatTaskLabel(task), taskId: task.id })),
    ];

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: vscode.l10n.t('Select the new parent task'),
    });
    if (!picked) {
      return;
    }

    try {
      await taskStore.setParent(target.id, picked.taskId);
      treeProvider.refresh();
    } catch (error) {
      if (error instanceof CannotMoveUnderOwnDescendantError) {
        vscode.window.showErrorMessage(
          vscode.l10n.t(
            'Failed to change the parent: cannot move a task under its own descendant.',
          ),
        );
      } else if (error instanceof TaskNotFoundError) {
        vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to change the parent: the task no longer exists.'),
        );
      } else {
        vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to change the parent: {0}', (error as Error).message),
        );
      }
    }
  });
}
