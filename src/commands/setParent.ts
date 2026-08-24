import * as vscode from 'vscode';
import type { Task } from '../models/task';
import type { TaskStore } from '../services/taskStore';
import type { TaskTreeViewProvider } from '../views/taskTreeViewProvider';
import { formatTaskLabel, pickTask } from './pickTask';

export function registerSetParent(
  taskStore: TaskStore,
  treeProvider: TaskTreeViewProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand('taskLog.setParent', async (preselected?: Task) => {
    const target =
      preselected ?? (await pickTask(taskStore, { placeHolder: 'どのタスクの親を変更しますか?' }));
    if (!target) {
      return;
    }

    const candidates = taskStore.getAll().filter((task) => task.id !== target.id);
    const items: (vscode.QuickPickItem & { taskId: string | null })[] = [
      { label: '(ルートに移動)', taskId: null },
      ...candidates.map((task) => ({ label: formatTaskLabel(task), taskId: task.id })),
    ];

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: '新しい親タスクを選択してください',
    });
    if (!picked) {
      return;
    }

    try {
      await taskStore.setParent(target.id, picked.taskId);
      treeProvider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`親タスクの変更に失敗しました: ${(error as Error).message}`);
    }
  });
}
