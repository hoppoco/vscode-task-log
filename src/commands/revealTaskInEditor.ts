import * as vscode from 'vscode';
import type { Task } from '../models/task';
import { resolveAnchor } from '../services/markerAnchorService';

export function registerRevealTaskInEditor(): vscode.Disposable {
  return vscode.commands.registerCommand('taskLog.revealTaskInEditor', async (task?: Task) => {
    if (!task) {
      return;
    }

    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(task.logFilePath));
      const editor = await vscode.window.showTextDocument(document);

      const resolved = resolveAnchor(
        document.getText(),
        task.anchorStartMarkerId,
        task.anchorEndMarkerId,
      );
      if (!resolved) {
        vscode.window.showWarningMessage(
          vscode.l10n.t(
            'Cannot locate this task because it is unanchored. Consider reanchoring it.',
          ),
        );
        return;
      }

      const position = new vscode.Position(resolved.startLine, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter,
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        vscode.l10n.t('Could not open the log: {0}', (error as Error).message),
      );
    }
  });
}
