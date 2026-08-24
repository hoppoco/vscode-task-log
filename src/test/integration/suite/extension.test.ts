import * as assert from 'node:assert';
import * as vscode from 'vscode';
import type { TaskLogExtensionApi } from '../../../extension';
import type { Task } from '../../../models/task';

const EXTENSION_ID = 'local.tasklog';

async function getApi(): Promise<TaskLogExtensionApi> {
  const extension = vscode.extensions.getExtension<TaskLogExtensionApi>(EXTENSION_ID);
  assert.ok(extension, '拡張機能が見つかりません');
  const api = await extension.activate();
  assert.ok(
    api,
    '拡張機能のAPIが取得できませんでした(ワークスペースが開かれていない可能性があります)',
  );
  return api;
}

suite('Task Log 結合テスト', () => {
  test('主要コマンドが登録されている', async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const command of [
      'taskLog.createTaskFromSelection',
      'taskLog.setParent',
      'taskLog.setFocus',
      'taskLog.clearFocus',
      'taskLog.markDone',
      'taskLog.markOpen',
      'taskLog.deleteTask',
      'taskLog.reanchorTask',
    ]) {
      assert.ok(commands.includes(command), `${command} が登録されていません`);
    }
  });

  test('選択範囲からタスクを作成すると、マーカーが挿入されツリーに反映される', async () => {
    const api = await getApi();

    const document = await vscode.workspace.openTextDocument({
      content: ['line0', '調査対象の問題を発見', 'line2'].join('\n'),
      language: 'markdown',
    });
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(1, 0, 1, '調査対象の問題を発見'.length);

    const originalShowInputBox = vscode.window.showInputBox;
    // 実UIを介さず結合テストを完結させるため、この場だけ入力結果を差し替える
    (
      vscode.window as unknown as { showInputBox: () => Thenable<string | undefined> }
    ).showInputBox = () => Promise.resolve('テストタスク');

    try {
      await vscode.commands.executeCommand('taskLog.createTaskFromSelection');
    } finally {
      vscode.window.showInputBox = originalShowInputBox;
    }

    const text = document.getText();
    assert.match(text, /<!-- tasklog:.+:start -->/);
    assert.match(text, /<!-- tasklog:.+:end -->/);

    const created = api.taskStore.getAll().find((task) => task.title === 'テストタスク');
    assert.ok(created, 'タスクが作成されていません');
    assert.strictEqual(created?.status, 'open');

    const rootTasks = await api.treeProvider.getChildren();
    assert.ok(
      rootTasks?.some((task) => task.id === created?.id),
      'ツリーに反映されていません',
    );

    const codeLenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      'vscode.executeCodeLensProvider',
      document.uri,
    );
    assert.ok(
      codeLenses?.some((lens) => lens.command?.title.includes('テストタスク')),
      'マーカー範囲にCodeLensが表示されていません',
    );
  });

  test('アンカーを再設定すると、新しい範囲に紐づく', async () => {
    const api = await getApi();

    const document = await vscode.workspace.openTextDocument({
      content: ['line0', '元の範囲', 'line2', '新しい範囲', 'line4'].join('\n'),
      language: 'markdown',
    });
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(1, 0, 1, '元の範囲'.length);

    const originalShowInputBox = vscode.window.showInputBox;
    (
      vscode.window as unknown as { showInputBox: () => Thenable<string | undefined> }
    ).showInputBox = () => Promise.resolve('再アンカーテスト');
    let task: Task | undefined;
    try {
      await vscode.commands.executeCommand('taskLog.createTaskFromSelection');
      task = api.taskStore.getAll().find((t) => t.title === '再アンカーテスト');
    } finally {
      vscode.window.showInputBox = originalShowInputBox;
    }
    assert.ok(task, 'タスクが作成されていません');

    const originalStartMarkerId = task.anchorStartMarkerId;

    // 「新しい範囲」の行を選択し直してからアンカーを再設定する
    const newRangeLine = document.getText().split('\n').indexOf('新しい範囲');
    editor.selection = new vscode.Selection(newRangeLine, 0, newRangeLine, '新しい範囲'.length);

    const originalShowWarningMessage = vscode.window.showWarningMessage;
    // このタスクは既に接続済みのため、張り替え確認ダイアログが出る。テストでは自動承認する
    (
      vscode.window as unknown as { showWarningMessage: () => Thenable<string> }
    ).showWarningMessage = () => Promise.resolve('張り替える');
    try {
      await vscode.commands.executeCommand('taskLog.reanchorTask', task);
    } finally {
      vscode.window.showWarningMessage = originalShowWarningMessage;
    }

    const updated = api.taskStore.getById(task.id);
    assert.ok(updated);
    assert.notStrictEqual(updated?.anchorStartMarkerId, originalStartMarkerId);
  });

  test('タスクを削除すると一覧から消える', async () => {
    const api = await getApi();

    const document = await vscode.workspace.openTextDocument({
      content: ['line0', '削除対象', 'line2'].join('\n'),
      language: 'markdown',
    });
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(1, 0, 1, '削除対象'.length);

    const originalShowInputBox = vscode.window.showInputBox;
    (
      vscode.window as unknown as { showInputBox: () => Thenable<string | undefined> }
    ).showInputBox = () => Promise.resolve('削除テスト');
    let task: Task | undefined;
    try {
      await vscode.commands.executeCommand('taskLog.createTaskFromSelection');
      task = api.taskStore.getAll().find((t) => t.title === '削除テスト');
    } finally {
      vscode.window.showInputBox = originalShowInputBox;
    }
    assert.ok(task, 'タスクが作成されていません');

    const originalShowWarningMessage = vscode.window.showWarningMessage;
    (
      vscode.window as unknown as { showWarningMessage: () => Thenable<string> }
    ).showWarningMessage = () => Promise.resolve('削除');
    try {
      await vscode.commands.executeCommand('taskLog.deleteTask', task);
    } finally {
      vscode.window.showWarningMessage = originalShowWarningMessage;
    }

    assert.strictEqual(api.taskStore.getById(task.id), undefined);
  });
});
