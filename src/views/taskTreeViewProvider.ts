import * as path from 'node:path';
import * as vscode from 'vscode';
import type { Task } from '../models/task';
import type { TaskStore } from '../services/taskStore';
import { resolveAnchor } from '../services/markerAnchorService';

export interface TaskLogFileReader {
  readText(logFilePath: string): Promise<string | undefined>;
}

export class TaskTreeItem extends vscode.TreeItem {
  constructor(
    public readonly task: Task,
    hasChildren: boolean,
    isAnchorConnected: boolean,
  ) {
    super(
      task.title,
      hasChildren ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
    );
    this.id = task.id;
    // ステータス別に分けることで、package.jsonのmenus.view/item/contextのwhen句から
    // 「完了/未完了それぞれの場合だけインラインボタンを出す」といった出し分けができる
    this.contextValue = task.status === 'done' ? 'taskLog.task.done' : 'taskLog.task.open';
    this.description = this.buildDescription(task);
    this.command = {
      command: 'taskLog.revealTaskInEditor',
      title: vscode.l10n.t('Reveal task in editor'),
      arguments: [task],
    };
    if (!isAnchorConnected) {
      this.iconPath = new vscode.ThemeIcon(
        'warning',
        new vscode.ThemeColor('problemsWarningIcon.foreground'),
      );
      this.tooltip = vscode.l10n.t('Unanchored: the marker could not be found in the log.');
    } else if (task.status === 'done') {
      this.iconPath = new vscode.ThemeIcon('pass');
    } else {
      this.iconPath = new vscode.ThemeIcon('circle-outline');
    }
  }

  private buildDescription(task: Task): string {
    const fileName = path.basename(task.logFilePath);
    return task.status === 'done' ? `${vscode.l10n.t('Done')} · ${fileName}` : fileName;
  }
}

export class TaskTreeViewProvider implements vscode.TreeDataProvider<Task> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<Task | undefined | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(
    private readonly taskStore: TaskStore,
    private readonly fileReader: TaskLogFileReader,
  ) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  async getTreeItem(task: Task): Promise<vscode.TreeItem> {
    const hasChildren = this.taskStore.getChildren(task.id).length > 0;
    const isAnchorConnected = await this.isAnchorConnected(task);
    return new TaskTreeItem(task, hasChildren, isAnchorConnected);
  }

  getChildren(parent?: Task): vscode.ProviderResult<Task[]> {
    return this.taskStore.getChildren(parent ? parent.id : null);
  }

  getParent(task: Task): vscode.ProviderResult<Task> {
    if (!task.parentTaskId) {
      return undefined;
    }
    return this.taskStore.getById(task.parentTaskId);
  }

  /** タスクのアンカーが実際に解決できるかを確認する(ログファイルを読み込んで判定) */
  async isAnchorConnected(task: Task): Promise<boolean> {
    const text = await this.fileReader.readText(task.logFilePath);
    if (text === undefined) {
      return false;
    }
    return resolveAnchor(text, task.anchorStartMarkerId, task.anchorEndMarkerId) !== null;
  }
}
