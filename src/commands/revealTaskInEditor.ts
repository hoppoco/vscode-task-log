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
          'アンカー未接続のため、該当箇所を特定できません。アンカーの再設定を検討してください。',
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
      vscode.window.showErrorMessage(`ログを開けませんでした: ${(error as Error).message}`);
    }
  });
}
