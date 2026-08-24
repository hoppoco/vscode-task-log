import * as vscode from 'vscode';
import type { Task } from '../models/task';
import type { TaskStore } from '../services/taskStore';

/** 同名タスクを区別できるよう、タイトルに短縮ID(タスクIDの先頭8文字)を添えて表示する */
export function formatTaskLabel(task: Task): string {
  return `${task.title} (${task.id.slice(0, 8)})`;
}

export interface PickTaskOptions {
  placeHolder: string;
  /** 選択肢に含めるタスクを絞り込む(例:アンカー未接続のタスクのみ) */
  filter?: (task: Task) => boolean;
}

export async function pickTask(
  taskStore: TaskStore,
  options: PickTaskOptions,
): Promise<Task | undefined> {
  const candidates = options.filter
    ? taskStore.getAll().filter(options.filter)
    : taskStore.getAll();
  const items = candidates.map((task) => ({ label: formatTaskLabel(task), task }));
  const picked = await vscode.window.showQuickPick(items, { placeHolder: options.placeHolder });
  return picked?.task;
}
