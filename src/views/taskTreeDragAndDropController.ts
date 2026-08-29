import * as vscode from 'vscode';
import type { Task } from '../models/task';
import {
  CannotMoveUnderOwnDescendantError,
  TaskNotFoundError,
  type TaskStore,
} from '../services/taskStore';

const TASK_MIME_TYPE = 'application/vnd.code.tree.tasklog-tree';

/** タスクツリー上のドラッグ&ドロップで親を変更する。兄弟間の並び替えは扱わない */
export class TaskTreeDragAndDropController implements vscode.TreeDragAndDropController<Task> {
  readonly dropMimeTypes = [TASK_MIME_TYPE];
  readonly dragMimeTypes = [TASK_MIME_TYPE];

  constructor(
    private readonly taskStore: TaskStore,
    private readonly onChanged: () => void,
  ) {}

  handleDrag(source: readonly Task[], dataTransfer: vscode.DataTransfer): void {
    if (source.length === 0) {
      return;
    }
    dataTransfer.set(TASK_MIME_TYPE, new vscode.DataTransferItem(source[0].id));
  }

  async handleDrop(target: Task | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    const item = dataTransfer.get(TASK_MIME_TYPE);
    if (!item) {
      return;
    }

    const draggedId = await item.asString();
    if (!draggedId || draggedId === target?.id) {
      return;
    }

    try {
      await this.taskStore.setParent(draggedId, target ? target.id : null);
      this.onChanged();
    } catch (error) {
      if (error instanceof CannotMoveUnderOwnDescendantError) {
        vscode.window.showErrorMessage(
          vscode.l10n.t(
            'Failed to change the parent: cannot move a task under its own descendant.',
          ),
        );
      } else if (error instanceof TaskNotFoundError) {
        vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to change the parent: the task no longer exists.'),
        );
      } else {
        vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to change the parent: {0}', (error as Error).message),
        );
      }
    }
  }
}
