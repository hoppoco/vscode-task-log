import * as vscode from 'vscode';
import { findInnermostContainingTask } from '../services/taskLocator';
import type { TaskStore } from '../services/taskStore';
import type { TaskCodeLensProvider } from '../views/taskCodeLensProvider';
import type { TaskTreeViewProvider } from '../views/taskTreeViewProvider';

export function registerToggleStatusAtCursor(
  taskStore: TaskStore,
  treeProvider: TaskTreeViewProvider,
  codeLensProvider: TaskCodeLensProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand('taskLog.toggleStatusAtCursor', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(vscode.l10n.t('No active editor.'));
      return;
    }

    const candidates = taskStore
      .getAll()
      .filter((task) => task.logFilePath === editor.document.uri.fsPath);
    const line = editor.selection.active.line;
    const task = findInnermostContainingTask(
      editor.document.getText(),
      { startLine: line, endLine: line },
      candidates,
    );
    if (!task) {
      vscode.window.showInformationMessage(
        vscode.l10n.t('No task was found at the cursor position.'),
      );
      return;
    }

    const newStatus = task.status === 'done' ? 'open' : 'done';
    try {
      await taskStore.setStatus(task.id, newStatus);
      treeProvider.refresh();
      codeLensProvider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(
        vscode.l10n.t('Failed to change the status: {0}', (error as Error).message),
      );
    }
  });
}
