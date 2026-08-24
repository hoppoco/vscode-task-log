import * as vscode from 'vscode';
import type { Task } from '../models/task';
import type { TaskStore } from '../services/taskStore';
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
      (await pickTask(taskStore, { placeHolder: '削除するタスクを選択してください' }));
    if (!target) {
      return;
    }

    const descendantCount = taskStore.getDescendantIds(target.id).length;
    let cascade = false;
    if (descendantCount > 0) {
      const choice = await vscode.window.showQuickPick(
        [
          { label: '子タスクを昇格させる(このタスクの親の下に移動)', cascade: false },
          { label: `子タスクも含めて${descendantCount}件すべて削除する`, cascade: true },
        ],
        { placeHolder: `「${target.title}」には子タスクがあります。どうしますか?` },
      );
      if (!choice) {
        return;
      }
      cascade = choice.cascade;
    }

    const confirmMessage = cascade
      ? `「${target.title}」と子タスク${descendantCount}件を削除します。ログ本文(マーカーを含む)は変更されません。`
      : `「${target.title}」を削除します。ログ本文(マーカーを含む)は変更されません。`;
    const confirmed = await vscode.window.showWarningMessage(
      confirmMessage,
      { modal: true },
      '削除',
    );
    if (confirmed !== '削除') {
      return;
    }

    try {
      await taskStore.delete(target.id, { cascade });
      treeProvider.refresh();
      codeLensProvider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`タスクの削除に失敗しました: ${(error as Error).message}`);
    }
  });
}
