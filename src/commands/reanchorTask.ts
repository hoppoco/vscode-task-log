import * as vscode from 'vscode';
import type { Task } from '../models/task';
import { TaskNotFoundError, type TaskStore } from '../services/taskStore';
import type { TaskCodeLensProvider } from '../views/taskCodeLensProvider';
import type { TaskTreeViewProvider } from '../views/taskTreeViewProvider';
import { applyMarkerInsertion, selectionToLineRange } from './markerEditing';
import { pickTask } from './pickTask';

export function registerReanchorTask(
  taskStore: TaskStore,
  treeProvider: TaskTreeViewProvider,
  codeLensProvider: TaskCodeLensProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand('taskLog.reanchorTask', async (preselected?: Task) => {
    const target = preselected ?? (await pickUnanchoredTask(taskStore, treeProvider));
    if (!target) {
      return;
    }

    // pickUnanchoredTaskを経由しない呼び出し(例:将来のツリー右クリックメニュー等)に備え、
    // 既に接続済みのタスクが渡された場合は張り替える前に確認する
    if (await treeProvider.isAnchorConnected(target)) {
      const reanchorLabel = vscode.l10n.t('Reanchor');
      const proceed = await vscode.window.showWarningMessage(
        vscode.l10n.t(
          '"{0}" is already anchored. Reanchor it to the new range? (The reference to the original range will be lost.)',
          target.title,
        ),
        { modal: true },
        reanchorLabel,
      );
      if (proceed !== reanchorLabel) {
        return;
      }
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(vscode.l10n.t('No active editor.'));
      return;
    }

    const lineRange = selectionToLineRange(editor);

    const inserted = await applyMarkerInsertion(editor, lineRange);
    if (!inserted) {
      return;
    }

    try {
      await taskStore.updateAnchor(target.id, {
        logFilePath: editor.document.uri.fsPath,
        anchorStartMarkerId: inserted.anchorStartMarkerId,
        anchorEndMarkerId: inserted.anchorEndMarkerId,
      });
      treeProvider.refresh();
      codeLensProvider.refresh();
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to reanchor the task: the task no longer exists.'),
        );
      } else {
        vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to reanchor the task: {0}', (error as Error).message),
        );
      }
    }
  });
}

async function pickUnanchoredTask(
  taskStore: TaskStore,
  treeProvider: TaskTreeViewProvider,
): Promise<Task | undefined> {
  const allTasks = taskStore.getAll();
  const connectivity = await Promise.all(
    allTasks.map((task) => treeProvider.isAnchorConnected(task)),
  );
  const unanchoredIds = new Set(
    allTasks.filter((_, index) => !connectivity[index]).map((task) => task.id),
  );

  if (unanchoredIds.size === 0) {
    vscode.window.showInformationMessage(vscode.l10n.t('There are no unanchored tasks.'));
    return undefined;
  }

  return pickTask(taskStore, {
    placeHolder: vscode.l10n.t('Select the task to reanchor'),
    filter: (task) => unanchoredIds.has(task.id),
  });
}
