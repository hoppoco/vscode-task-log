import * as vscode from 'vscode';
import type { Task } from '../models/task';
import type { TaskStore } from '../services/taskStore';
import type { StatusBarController } from '../views/statusBarController';
import { pickTask } from './pickTask';

export function registerSetFocus(
  taskStore: TaskStore,
  statusBar: StatusBarController,
): vscode.Disposable[] {
  const setFocus = vscode.commands.registerCommand(
    'taskLog.setFocus',
    async (preselected?: Task) => {
      const target =
        preselected ??
        (await pickTask(taskStore, { placeHolder: vscode.l10n.t('Select the task to focus') }));
      if (!target) {
        return;
      }
      statusBar.setFocus(target.id);
    },
  );

  const clearFocus = vscode.commands.registerCommand('taskLog.clearFocus', () => {
    statusBar.clearFocus();
  });

  return [setFocus, clearFocus];
}
