import * as vscode from 'vscode';
import type { Task } from '../models/task';
import { findInnermostContainingTask } from '../services/taskLocator';
import type { TaskStore } from '../services/taskStore';

const DEBOUNCE_MS = 150;

/**
 * カーソル位置に対応するタスクをタスクツリー上でハイライト(reveal)する。
 * 表示のみの機能であり、フォーカス(StatusBarController)には一切触れない。
 */
export class CursorSyncController {
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly taskStore: TaskStore,
    private readonly treeView: vscode.TreeView<Task>,
  ) {}

  handleSelectionChange(editor: vscode.TextEditor): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => this.reveal(editor), DEBOUNCE_MS);
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }

  private reveal(editor: vscode.TextEditor): void {
    const candidates = this.taskStore
      .getAll()
      .filter((task) => task.logFilePath === editor.document.uri.fsPath);
    const line = editor.selection.active.line;

    const task = findInnermostContainingTask(
      editor.document.getText(),
      { startLine: line, endLine: line },
      candidates,
    );
    if (!task) {
      return;
    }

    void this.treeView.reveal(task, { select: true, focus: false });
  }
}
