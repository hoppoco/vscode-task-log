import * as vscode from 'vscode';
import type { Task } from '../models/task';
import type { TaskStore } from '../services/taskStore';

export class StatusBarController {
  private readonly statusBarItem: vscode.StatusBarItem;
  private focusedTaskId: string | undefined;

  constructor(private readonly taskStore: TaskStore) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  }

  setFocus(taskId: string): void {
    this.focusedTaskId = taskId;
    this.render();
  }

  clearFocus(): void {
    this.focusedTaskId = undefined;
    this.render();
  }

  getFocusedTaskId(): string | undefined {
    return this.focusedTaskId;
  }

  render(): void {
    if (!this.focusedTaskId) {
      this.statusBarItem.hide();
      return;
    }

    const task = this.taskStore.getById(this.focusedTaskId);
    if (!task) {
      this.focusedTaskId = undefined;
      this.statusBarItem.hide();
      return;
    }

    this.statusBarItem.text = `$(search) ${this.buildBreadcrumb(task)}`;
    this.statusBarItem.show();
  }

  private buildBreadcrumb(task: Task): string {
    const chain: string[] = [task.title];
    let current: Task = task;
    while (current.parentTaskId) {
      const parent = this.taskStore.getById(current.parentTaskId);
      if (!parent) {
        break;
      }
      chain.unshift(parent.title);
      current = parent;
    }
    return chain.join(' > ');
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
