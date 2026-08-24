import * as vscode from 'vscode';
import type { Task } from '../models/task';
import type { TaskStore } from '../services/taskStore';
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
      const proceed = await vscode.window.showWarningMessage(
        `「${target.title}」は既にアンカーが接続されています。新しい範囲に張り替えますか?(元の範囲への参照は失われます)`,
        { modal: true },
        '張り替える',
      );
      if (proceed !== '張り替える') {
        return;
      }
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('アクティブなエディタがありません');
      return;
    }

    const lineRange = selectionToLineRange(editor);
    if (!lineRange) {
      return;
    }

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
      vscode.window.showErrorMessage(`アンカーの再設定に失敗しました: ${(error as Error).message}`);
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
    vscode.window.showInformationMessage('アンカー未接続のタスクはありません');
    return undefined;
  }

  return pickTask(taskStore, {
    placeHolder: 'アンカーを再設定するタスクを選択してください',
    filter: (task) => unanchoredIds.has(task.id),
  });
}
