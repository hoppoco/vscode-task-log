import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { TaskLogExtensionApi } from '../../../extension';
import type { Task } from '../../../models/task';

const EXTENSION_ID = 'local.tasklog';

let tempDir: string;

suiteSetup(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasklog-integration-'));
});

suiteTeardown(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

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

/**
 * テスト用の実ファイルを開く。revealTaskInEditor等、logFilePathを実際に
 * ファイルシステムから読み直すコマンドを検証するため、Untitledな仮想
 * ドキュメントではなく実ファイルを使う。
 */
async function openLogDocument(
  fileName: string,
  content: string,
): Promise<{ document: vscode.TextDocument; editor: vscode.TextEditor }> {
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, content, 'utf-8');
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  const editor = await vscode.window.showTextDocument(document);
  return { document, editor };
}

/** 実UIを介さず結合テストを完結させるため、この場だけ入力結果を差し替える */
async function withStubbedInputBox<T>(value: string, fn: () => Thenable<T>): Promise<T> {
  const original = vscode.window.showInputBox;
  (vscode.window as unknown as { showInputBox: () => Thenable<string | undefined> }).showInputBox =
    () => Promise.resolve(value);
  try {
    return await fn();
  } finally {
    vscode.window.showInputBox = original;
  }
}

async function withStubbedWarningMessage<T>(response: string, fn: () => Thenable<T>): Promise<T> {
  const original = vscode.window.showWarningMessage;
  (vscode.window as unknown as { showWarningMessage: () => Thenable<string> }).showWarningMessage =
    () => Promise.resolve(response);
  try {
    return await fn();
  } finally {
    vscode.window.showWarningMessage = original;
  }
}

async function withStubbedInformationMessage<T>(
  response: string,
  fn: () => Thenable<T>,
): Promise<T> {
  const original = vscode.window.showInformationMessage;
  (
    vscode.window as unknown as { showInformationMessage: () => Thenable<string> }
  ).showInformationMessage = () => Promise.resolve(response);
  try {
    return await fn();
  } finally {
    vscode.window.showInformationMessage = original;
  }
}

async function createTaskFromCurrentSelection(
  api: TaskLogExtensionApi,
  title: string,
): Promise<Task> {
  await withStubbedInputBox(title, () =>
    vscode.commands.executeCommand('taskLog.createTaskFromSelection'),
  );
  const created = api.taskStore.getAll().find((task) => task.title === title);
  assert.ok(created, `タスク「${title}」が作成されていません`);
  return created;
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
      'taskLog.revealTaskInEditor',
      'taskLog.toggleStatusAtCursor',
      'taskLog.setJiraApiToken',
      'taskLog.linkJiraIssue',
      'taskLog.pushSummaryToJira',
    ]) {
      assert.ok(commands.includes(command), `${command} が登録されていません`);
    }
  });

  test('選択範囲からタスクを作成すると、マーカーが挿入されツリーに反映される', async () => {
    const api = await getApi();
    const { document, editor } = await openLogDocument(
      'create-from-selection.md',
      ['line0', '調査対象の問題を発見', 'line2'].join('\n'),
    );
    editor.selection = new vscode.Selection(1, 0, 1, '調査対象の問題を発見'.length);

    const created = await createTaskFromCurrentSelection(api, 'テストタスク');

    const text = document.getText();
    assert.match(text, /<!-- tasklog:.+:start -->/);
    assert.match(text, /<!-- tasklog:.+:end -->/);
    assert.strictEqual(created.status, 'open');

    const rootTasks = await api.treeProvider.getChildren();
    assert.ok(
      rootTasks?.some((task) => task.id === created.id),
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

  test('選択が空の場合、カーソルのある行を対象にタスクが作成される', async () => {
    const api = await getApi();
    const { document, editor } = await openLogDocument(
      'cursor-only.md',
      ['line0', 'カーソル行のみ', 'line2'].join('\n'),
    );
    editor.selection = new vscode.Selection(1, 3, 1, 3); // line1にカーソルを置くだけ、選択なし

    const created = await createTaskFromCurrentSelection(api, 'カーソル行タスク');

    const lines = document.getText().split('\n');
    const startIndex = lines.findIndex(
      (line) => line.includes('tasklog') && line.includes('start'),
    );
    const endIndex = lines.findIndex((line) => line.includes('tasklog') && line.includes('end'));
    assert.strictEqual(
      endIndex - startIndex,
      2,
      '対象行の前後1行ずつにマーカーが挿入されているはず',
    );
    assert.strictEqual(lines[startIndex + 1], 'カーソル行のみ');
    assert.strictEqual(created.status, 'open');
  });

  test('既存タスクのマーカー範囲内で新規作成すると、そのタスクが親になる', async () => {
    const api = await getApi();
    const { document, editor } = await openLogDocument(
      'nested-creation.md',
      ['line0', '親になる範囲の開始', '内側の行', '親になる範囲の終了', 'line4'].join('\n'),
    );
    editor.selection = new vscode.Selection(1, 0, 3, '親になる範囲の終了'.length);
    const parent = await createTaskFromCurrentSelection(api, '親タスク候補');

    // 親タスク化でマーカーが挿入された後の「内側の行」の位置を、テキストから探し直す
    const innerLineIndex = document.getText().split('\n').indexOf('内側の行');
    editor.selection = new vscode.Selection(innerLineIndex, 0, innerLineIndex, '内側の行'.length);
    const child = await createTaskFromCurrentSelection(api, '内側の子タスク候補');

    assert.strictEqual(child.parentTaskId, parent.id);
  });

  test('タスクツリー項目のクリック相当のコマンドで、該当箇所にエディタが移動する', async () => {
    const api = await getApi();
    const { document, editor } = await openLogDocument(
      'reveal.md',
      ['line0', 'line1', 'ジャンプ先の行', 'line3'].join('\n'),
    );
    editor.selection = new vscode.Selection(2, 0, 2, 'ジャンプ先の行'.length);
    const task = await createTaskFromCurrentSelection(api, 'ジャンプ対象タスク');

    // 別の場所へカーソルを移動してから、revealTaskInEditorでジャンプし直す
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await vscode.commands.executeCommand('taskLog.revealTaskInEditor', task);

    const markerStartLine = document
      .getText()
      .split('\n')
      .findIndex((line) => line.includes('start'));
    assert.strictEqual(vscode.window.activeTextEditor?.selection.active.line, markerStartLine);
  });

  test('カーソル位置に対応するタスクのステータスを切り替えられる', async () => {
    const api = await getApi();
    const { document, editor } = await openLogDocument(
      'toggle-status.md',
      ['line0', 'ステータス切替対象', 'line2'].join('\n'),
    );
    editor.selection = new vscode.Selection(1, 0, 1, 'ステータス切替対象'.length);
    const task = await createTaskFromCurrentSelection(api, 'ステータス切替タスク');
    assert.strictEqual(task.status, 'open');

    // タスク化直後のマーカー内にカーソルを置いた状態で切り替える
    const contentLine = document.getText().split('\n').indexOf('ステータス切替対象');
    editor.selection = new vscode.Selection(contentLine, 0, contentLine, 0);
    await vscode.commands.executeCommand('taskLog.toggleStatusAtCursor');

    assert.strictEqual(api.taskStore.getById(task.id)?.status, 'done');
  });

  test('アンカーを再設定すると、新しい範囲に紐づく', async () => {
    const api = await getApi();
    const { document, editor } = await openLogDocument(
      'reanchor.md',
      ['line0', '元の範囲', 'line2', '新しい範囲', 'line4'].join('\n'),
    );
    editor.selection = new vscode.Selection(1, 0, 1, '元の範囲'.length);
    const task = await createTaskFromCurrentSelection(api, '再アンカーテスト');
    const originalStartMarkerId = task.anchorStartMarkerId;

    // 「新しい範囲」の行を選択し直してからアンカーを再設定する
    const newRangeLine = document.getText().split('\n').indexOf('新しい範囲');
    editor.selection = new vscode.Selection(newRangeLine, 0, newRangeLine, '新しい範囲'.length);

    // このタスクは既に接続済みのため、張り替え確認ダイアログが出る。テストでは自動承認する
    await withStubbedWarningMessage('張り替える', () =>
      vscode.commands.executeCommand('taskLog.reanchorTask', task),
    );

    const updated = api.taskStore.getById(task.id);
    assert.ok(updated);
    assert.notStrictEqual(updated?.anchorStartMarkerId, originalStartMarkerId);
  });

  test('タスクを削除すると一覧から消える', async () => {
    const api = await getApi();
    const { editor } = await openLogDocument(
      'delete.md',
      ['line0', '削除対象', 'line2'].join('\n'),
    );
    editor.selection = new vscode.Selection(1, 0, 1, '削除対象'.length);
    const task = await createTaskFromCurrentSelection(api, '削除テスト');

    await withStubbedWarningMessage('削除', () =>
      vscode.commands.executeCommand('taskLog.deleteTask', task),
    );

    assert.strictEqual(api.taskStore.getById(task.id), undefined);
  });

  test('Jira未設定の状態でlinkJiraIssueを実行しても、クラッシュせず紐付けは行われない', async () => {
    const api = await getApi();
    const { editor } = await openLogDocument(
      'jira-link-unconfigured.md',
      ['line0', 'Jira紐付けテスト対象', 'line2'].join('\n'),
    );
    editor.selection = new vscode.Selection(1, 0, 1, 'Jira紐付けテスト対象'.length);
    const task = await createTaskFromCurrentSelection(api, 'Jira紐付けテスト');

    await withStubbedInputBox('PROJ-999', () =>
      vscode.commands.executeCommand('taskLog.linkJiraIssue', task),
    );

    assert.strictEqual(api.taskStore.getById(task.id)?.jiraIssueKey, null);
  });

  test('Jira未設定の状態でpushSummaryToJiraを実行しても、クラッシュしない', async () => {
    const api = await getApi();
    const { editor } = await openLogDocument(
      'jira-push-unconfigured.md',
      ['line0', 'Jira投稿テスト対象', 'line2'].join('\n'),
    );
    editor.selection = new vscode.Selection(1, 0, 1, 'Jira投稿テスト対象'.length);
    const task = await createTaskFromCurrentSelection(api, 'Jira投稿テスト');

    // 紐付け済みの状態を直接作る(linkJiraIssueコマンド自体はここでは検証しない)
    await api.taskStore.setJiraLink(task.id, {
      jiraIssueKey: 'PROJ-1',
      includeInAncestorSummary: false,
    });

    await withStubbedInformationMessage('投稿する', () =>
      vscode.commands.executeCommand('taskLog.pushSummaryToJira', task),
    );

    // Jira未設定のため実際には投稿されないが、例外を投げずに完了することを確認する
  });
});
