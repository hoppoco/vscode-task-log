import * as vscode from 'vscode';
import type { Task, TaskStatus } from '../models/task';
import { TaskNotFoundError, type TaskStore } from '../services/taskStore';
import type { TaskCodeLensProvider } from '../views/taskCodeLensProvider';
import type { TaskTreeViewProvider } from '../views/taskTreeViewProvider';
import { pickTask } from './pickTask';

export function registerMarkStatus(
  taskStore: TaskStore,
  treeProvider: TaskTreeViewProvider,
  codeLensProvider: TaskCodeLensProvider,
): vscode.Disposable[] {
  const markDone = vscode.commands.registerCommand(
    'taskLog.markDone',
    async (preselected?: Task) => {
      await applyStatus(taskStore, treeProvider, codeLensProvider, preselected, 'done');
    },
  );

  const markOpen = vscode.commands.registerCommand(
    'taskLog.markOpen',
    async (preselected?: Task) => {
      await applyStatus(taskStore, treeProvider, codeLensProvider, preselected, 'open');
    },
  );

  return [markDone, markOpen];
}

async function applyStatus(
  taskStore: TaskStore,
  treeProvider: TaskTreeViewProvider,
  codeLensProvider: TaskCodeLensProvider,
  preselected: Task | undefined,
  status: TaskStatus,
): Promise<void> {
  const target =
    preselected ??
    (await pickTask(taskStore, { placeHolder: vscode.l10n.t('Select the target task') }));
  if (!target) {
    return;
  }

  try {
    await taskStore.setStatus(target.id, status);
    treeProvider.refresh();
    codeLensProvider.refresh();
  } catch (error) {
    if (error instanceof TaskNotFoundError) {
      vscode.window.showErrorMessage(
        vscode.l10n.t('Failed to change the status: the task no longer exists.'),
      );
    } else {
      vscode.window.showErrorMessage(
        vscode.l10n.t('Failed to change the status: {0}', (error as Error).message),
      );
    }
  }
}
