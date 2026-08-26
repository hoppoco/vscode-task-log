import * as vscode from 'vscode';
import { findInnermostContainingTask } from '../services/taskLocator';
import type { TaskStore } from '../services/taskStore';
import type { StatusBarController } from '../views/statusBarController';
import type { TaskCodeLensProvider } from '../views/taskCodeLensProvider';
import type { TaskTreeViewProvider } from '../views/taskTreeViewProvider';
import { applyMarkerInsertion, selectionToLineRange } from './markerEditing';

export function registerCreateTaskFromSelection(
  taskStore: TaskStore,
  treeProvider: TaskTreeViewProvider,
  statusBar: StatusBarController,
  codeLensProvider: TaskCodeLensProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand('taskLog.createTaskFromSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('アクティブなエディタがありません');
      return;
    }

    const lineRange = selectionToLineRange(editor);

    const selectedText = editor.document.getText(editor.selection);
    const suggestedTitle = selectedText.trim().split('\n')[0]?.slice(0, 40) || '無題のタスク';

    // ドキュメントを変更する前にタイトルを確定する。キャンセル時にマーカーだけが
    // 挿入されてタスクが存在しない、という不整合を避けるため。
    const title = await vscode.window.showInputBox({
      prompt: 'タスクのタイトル',
      value: suggestedTitle,
    });
    if (title === undefined) {
      return;
    }

    // 親のデフォルトは、(1)選択範囲を包含する既存タスクがあればそれを最優先、
    // (2)無ければ現在のフォーカス、(3)どちらも無ければルートとする。
    const sameFileTasks = taskStore
      .getAll()
      .filter((task) => task.logFilePath === editor.document.uri.fsPath);
    const containingTask = findInnermostContainingTask(
      editor.document.getText(),
      lineRange,
      sameFileTasks,
    );
    const parentTaskId = containingTask
      ? containingTask.id
      : (statusBar.getFocusedTaskId() ?? null);

    const inserted = await applyMarkerInsertion(editor, lineRange);
    if (!inserted) {
      return;
    }

    try {
      const task = await taskStore.create({
        title: title || suggestedTitle,
        parentTaskId,
        logFilePath: editor.document.uri.fsPath,
        anchorStartMarkerId: inserted.anchorStartMarkerId,
        anchorEndMarkerId: inserted.anchorEndMarkerId,
      });
      treeProvider.refresh();
      codeLensProvider.refresh();
      statusBar.setFocus(task.id);
    } catch (error) {
      vscode.window.showErrorMessage(`タスクの作成に失敗しました: ${(error as Error).message}`);
    }
  });
}
