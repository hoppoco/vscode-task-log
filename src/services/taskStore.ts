import { randomUUID } from 'node:crypto';
import type { Task, TaskStatus } from '../models/task';

/**
 * TaskStoreが必要とする永続化操作だけを表すインターフェース。
 * 実際の保存先(VSCode拡張専用ストレージ等)は呼び出し元が実装して注入する。
 */
export interface TaskStorage {
  read(): Promise<string | undefined>;
  write(content: string): Promise<void>;
}

export interface CreateTaskInput {
  title: string;
  parentTaskId: string | null;
  logFilePath: string;
  anchorStartMarkerId: string;
  anchorEndMarkerId: string;
}

export interface Anchor {
  logFilePath: string;
  anchorStartMarkerId: string;
  anchorEndMarkerId: string;
}

export class TaskStore {
  private tasks = new Map<string, Task>();
  private loaded = false;

  constructor(private readonly storage: TaskStorage) {}

  async load(): Promise<void> {
    const raw = await this.storage.read();
    this.tasks.clear();
    if (raw) {
      const parsed = JSON.parse(raw) as Task[];
      for (const task of parsed) {
        this.tasks.set(task.id, task);
      }
    }
    this.loaded = true;
  }

  getAll(): Task[] {
    this.ensureLoaded();
    return Array.from(this.tasks.values());
  }

  getById(id: string): Task | undefined {
    this.ensureLoaded();
    return this.tasks.get(id);
  }

  getChildren(parentTaskId: string | null): Task[] {
    this.ensureLoaded();
    return this.getAll().filter((task) => task.parentTaskId === parentTaskId);
  }

  async create(input: CreateTaskInput): Promise<Task> {
    this.ensureLoaded();
    if (input.parentTaskId && !this.tasks.has(input.parentTaskId)) {
      throw new Error(`親タスクが見つかりません: ${input.parentTaskId}`);
    }

    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      status: 'open',
      parentTaskId: input.parentTaskId,
      logFilePath: input.logFilePath,
      anchorStartMarkerId: input.anchorStartMarkerId,
      anchorEndMarkerId: input.anchorEndMarkerId,
      jiraIssueKey: null,
      includeInAncestorSummary: false,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    await this.persist();
    return task;
  }

  async setParent(taskId: string, newParentTaskId: string | null): Promise<Task> {
    this.ensureLoaded();
    const task = this.requireTask(taskId);

    if (newParentTaskId) {
      this.requireTask(newParentTaskId);
      if (this.isDescendantOf(newParentTaskId, taskId)) {
        throw new Error('タスクを自分自身の子孫の下に移動することはできません');
      }
    }

    task.parentTaskId = newParentTaskId;
    task.updatedAt = new Date().toISOString();
    await this.persist();
    return task;
  }

  async setStatus(taskId: string, status: TaskStatus): Promise<Task> {
    this.ensureLoaded();
    const task = this.requireTask(taskId);
    task.status = status;
    task.updatedAt = new Date().toISOString();
    await this.persist();
    return task;
  }

  /**
   * タスクを削除する。ログ本文・マーカーには一切触れない(マーカーは孤立した無害な
   * コメントとして残る)。子タスクの扱いはcascadeで指定する:
   * - false: 子タスクを削除対象の親の下に昇格させる
   * - true: 子孫タスクも再帰的に削除する
   */
  async delete(taskId: string, options: { cascade: boolean }): Promise<void> {
    this.ensureLoaded();
    const task = this.requireTask(taskId);

    if (options.cascade) {
      for (const descendantId of this.getDescendantIds(taskId)) {
        this.tasks.delete(descendantId);
      }
    } else {
      const now = new Date().toISOString();
      for (const child of this.getChildren(taskId)) {
        child.parentTaskId = task.parentTaskId;
        child.updatedAt = now;
      }
    }

    this.tasks.delete(taskId);
    await this.persist();
  }

  /** taskIdの子孫タスクのIDを全て(孫以降も含めて)返す */
  getDescendantIds(taskId: string): string[] {
    this.ensureLoaded();
    const result: string[] = [];
    const stack = this.getChildren(taskId).map((task) => task.id);
    while (stack.length > 0) {
      const id = stack.pop();
      if (id === undefined) {
        break;
      }
      result.push(id);
      stack.push(...this.getChildren(id).map((task) => task.id));
    }
    return result;
  }

  /** マーカーが見つからなくなったタスクのアンカーを、新しい範囲に張り替える */
  async updateAnchor(taskId: string, anchor: Anchor): Promise<Task> {
    this.ensureLoaded();
    const task = this.requireTask(taskId);
    task.logFilePath = anchor.logFilePath;
    task.anchorStartMarkerId = anchor.anchorStartMarkerId;
    task.anchorEndMarkerId = anchor.anchorEndMarkerId;
    task.updatedAt = new Date().toISOString();
    await this.persist();
    return task;
  }

  private requireTask(taskId: string): Task {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`タスクが見つかりません: ${taskId}`);
    }
    return task;
  }

  /** candidateIdが、targetIdの子孫(親を辿った先にtargetIdが現れる)かどうかを判定する */
  private isDescendantOf(candidateId: string, targetId: string): boolean {
    let current = this.tasks.get(candidateId);
    while (current) {
      if (current.id === targetId) {
        return true;
      }
      current = current.parentTaskId ? this.tasks.get(current.parentTaskId) : undefined;
    }
    return false;
  }

  private ensureLoaded(): void {
    if (!this.loaded) {
      throw new Error('TaskStore.load()が呼ばれる前にアクセスされました');
    }
  }

  private async persist(): Promise<void> {
    const serialized = JSON.stringify(Array.from(this.tasks.values()), null, 2);
    await this.storage.write(serialized);
  }
}
