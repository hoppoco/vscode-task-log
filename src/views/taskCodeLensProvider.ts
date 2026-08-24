import * as vscode from 'vscode';
import { resolveAnchor } from '../services/markerAnchorService';
import type { TaskStore } from '../services/taskStore';

/** ログ編集中に、マーカー範囲の直上へ対応するタスク名を表示する */
export class TaskCodeLensProvider implements vscode.CodeLensProvider {
  private readonly onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;

  constructor(private readonly taskStore: TaskStore) {}

  refresh(): void {
    this.onDidChangeCodeLensesEmitter.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const text = document.getText();
    const lenses: vscode.CodeLens[] = [];

    for (const task of this.taskStore.getAll()) {
      if (task.logFilePath !== document.uri.fsPath) {
        continue;
      }
      const resolved = resolveAnchor(text, task.anchorStartMarkerId, task.anchorEndMarkerId);
      if (!resolved) {
        continue;
      }

      const range = new vscode.Range(resolved.startLine, 0, resolved.startLine, 0);
      const statusLabel = task.status === 'done' ? ' (完了)' : '';
      lenses.push(
        new vscode.CodeLens(range, {
          title: `$(circle-outline) タスク: ${task.title}${statusLabel}`,
          command: 'taskLog.setFocus',
          arguments: [task],
        }),
      );
    }

    return lenses;
  }
}
