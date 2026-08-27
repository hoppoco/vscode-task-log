import * as vscode from 'vscode';
import type { Task } from './models/task';
import { TaskStore, type TaskStorage } from './services/taskStore';
import { TaskTreeViewProvider, type TaskLogFileReader } from './views/taskTreeViewProvider';
import { TaskTreeDragAndDropController } from './views/taskTreeDragAndDropController';
import { CursorSyncController } from './views/cursorSyncController';
import { StatusBarController } from './views/statusBarController';
import { TaskCodeLensProvider } from './views/taskCodeLensProvider';
import { registerCreateTaskFromSelection } from './commands/createTaskFromSelection';
import { registerSetParent } from './commands/setParent';
import { registerSetFocus } from './commands/setFocus';
import { registerMarkStatus } from './commands/markStatus';
import { registerDeleteTask } from './commands/deleteTask';
import { registerReanchorTask } from './commands/reanchorTask';
import { registerRevealTaskInEditor } from './commands/revealTaskInEditor';
import { registerToggleStatusAtCursor } from './commands/toggleStatusAtCursor';
import { registerSetJiraApiToken } from './commands/setJiraApiToken';
import { registerLinkJiraIssue } from './commands/linkJiraIssue';
import { registerPushSummaryToJira } from './commands/pushSummaryToJira';

function isFileNotFound(error: unknown): boolean {
  return error instanceof vscode.FileSystemError && error.code === 'FileNotFound';
}

/**
 * ワークスペースのディレクトリ外(拡張専用ストレージ)にタスクを永続化する。
 * 書き込みは一時ファイル経由のアトミックな置き換えとし、クラッシュ時の破損を防ぐ。
 */
function createTaskStorage(storageUri: vscode.Uri): TaskStorage {
  const tasksUri = vscode.Uri.joinPath(storageUri, 'tasks.json');
  const tempUri = vscode.Uri.joinPath(storageUri, 'tasks.json.tmp');

  return {
    async read() {
      try {
        const bytes = await vscode.workspace.fs.readFile(tasksUri);
        return Buffer.from(bytes).toString('utf-8');
      } catch (error) {
        if (isFileNotFound(error)) {
          return undefined;
        }
        throw error;
      }
    },
    async write(content: string) {
      await vscode.workspace.fs.createDirectory(storageUri);
      await vscode.workspace.fs.writeFile(tempUri, Buffer.from(content, 'utf-8'));
      await vscode.workspace.fs.rename(tempUri, tasksUri, { overwrite: true });
    },
  };
}

function createLogFileReader(): TaskLogFileReader {
  return {
    async readText(logFilePath: string) {
      try {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(logFilePath));
        return Buffer.from(bytes).toString('utf-8');
      } catch (error) {
        if (isFileNotFound(error)) {
          return undefined;
        }
        throw error;
      }
    },
  };
}

export interface TaskLogExtensionApi {
  taskStore: TaskStore;
  treeProvider: TaskTreeViewProvider;
  statusBar: StatusBarController;
  codeLensProvider: TaskCodeLensProvider;
}

export async function activate(
  context: vscode.ExtensionContext,
): Promise<TaskLogExtensionApi | undefined> {
  if (!context.storageUri) {
    vscode.window.showErrorMessage(
      'Task Log: フォルダを開いていないワークスペースでは動作しません。フォルダを開いてください。',
    );
    return undefined;
  }

  const taskStore = new TaskStore(createTaskStorage(context.storageUri));
  await taskStore.load();

  const treeProvider = new TaskTreeViewProvider(taskStore, createLogFileReader());
  const statusBar = new StatusBarController(taskStore);
  const codeLensProvider = new TaskCodeLensProvider(taskStore);
  const dragAndDropController = new TaskTreeDragAndDropController(taskStore, () =>
    treeProvider.refresh(),
  );

  const treeView = vscode.window.createTreeView<Task>('taskLog.tree', {
    treeDataProvider: treeProvider,
    dragAndDropController,
  });
  const cursorSync = new CursorSyncController(taskStore, treeView);

  context.subscriptions.push(
    treeView,
    cursorSync,
    vscode.languages.registerCodeLensProvider(
      [{ scheme: 'file' }, { scheme: 'untitled' }],
      codeLensProvider,
    ),
    statusBar,
    registerCreateTaskFromSelection(taskStore, treeProvider, statusBar, codeLensProvider),
    registerSetParent(taskStore, treeProvider),
    ...registerSetFocus(taskStore, statusBar),
    ...registerMarkStatus(taskStore, treeProvider, codeLensProvider),
    registerDeleteTask(taskStore, treeProvider, codeLensProvider),
    registerReanchorTask(taskStore, treeProvider, codeLensProvider),
    registerRevealTaskInEditor(),
    registerToggleStatusAtCursor(taskStore, treeProvider, codeLensProvider),
    registerSetJiraApiToken(context),
    registerLinkJiraIssue(taskStore, context),
    registerPushSummaryToJira(taskStore, context),
    // ログファイル保存のたびにツリーを再描画し、マーカーの手動編集・削除を
    // (キー入力毎ではなく保存単位で)アンカー未接続表示に反映する
    vscode.workspace.onDidSaveTextDocument(() => treeProvider.refresh()),
    // カーソル位置に対応するタスクをツリー上でハイライトする(フォーカスには影響しない)
    vscode.window.onDidChangeTextEditorSelection((event) =>
      cursorSync.handleSelectionChange(event.textEditor),
    ),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        cursorSync.handleSelectionChange(editor);
      }
    }),
  );

  // 結合テストから内部状態を検証できるようにするための公開API
  return { taskStore, treeProvider, statusBar, codeLensProvider };
}

export function deactivate(): void {}
