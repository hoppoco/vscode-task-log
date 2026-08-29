import { beforeEach, describe, expect, it } from 'vitest';
import {
  CannotMoveUnderOwnDescendantError,
  ParentTaskNotFoundError,
  TaskNotFoundError,
  TaskStore,
  type TaskStorage,
} from '../../../services/taskStore';

function createInMemoryStorage(): TaskStorage {
  let content: string | undefined;
  return {
    async read() {
      return content;
    },
    async write(newContent: string) {
      content = newContent;
    },
  };
}

function baseInput(overrides: Partial<Parameters<TaskStore['create']>[0]> = {}) {
  return {
    title: 'タスクA',
    parentTaskId: null,
    logFilePath: '/workspace/investigation.md',
    anchorStartMarkerId: 'm1',
    anchorEndMarkerId: 'm1',
    ...overrides,
  };
}

describe('TaskStore', () => {
  let store: TaskStore;

  beforeEach(async () => {
    store = new TaskStore(createInMemoryStorage());
    await store.load();
  });

  it('load前にアクセスすると例外を投げる', async () => {
    const freshStore = new TaskStore(createInMemoryStorage());
    expect(() => freshStore.getAll()).toThrow();
  });

  it('タスクを作成し、取得できる', async () => {
    const created = await store.create(baseInput());
    expect(store.getById(created.id)).toEqual(created);
    expect(created.status).toBe('open');
    expect(created.parentTaskId).toBeNull();
  });

  it('存在しない親タスクを指定すると例外を投げる', async () => {
    await expect(store.create(baseInput({ parentTaskId: 'no-such-id' }))).rejects.toThrow(
      ParentTaskNotFoundError,
    );
  });

  it('親子関係を取得できる', async () => {
    const parent = await store.create(baseInput({ title: '親' }));
    const child = await store.create(baseInput({ title: '子', parentTaskId: parent.id }));

    expect(store.getChildren(parent.id)).toEqual([child]);
    expect(store.getChildren(null)).toEqual([parent]);
  });

  it('親を事後的に変更できる', async () => {
    const taskA = await store.create(baseInput({ title: 'A' }));
    const taskB = await store.create(baseInput({ title: 'B' }));

    const updated = await store.setParent(taskB.id, taskA.id);

    expect(updated.parentTaskId).toBe(taskA.id);
    expect(store.getChildren(taskA.id)).toEqual([updated]);
  });

  it('自分自身の子孫の下に移動しようとすると例外を投げる', async () => {
    const grandparent = await store.create(baseInput({ title: '祖父' }));
    const parent = await store.create(baseInput({ title: '親', parentTaskId: grandparent.id }));
    const child = await store.create(baseInput({ title: '子', parentTaskId: parent.id }));

    await expect(store.setParent(grandparent.id, child.id)).rejects.toThrow(
      CannotMoveUnderOwnDescendantError,
    );
  });

  it('ステータスを変更できる', async () => {
    const task = await store.create(baseInput());
    const updated = await store.setStatus(task.id, 'done');
    expect(updated.status).toBe('done');
  });

  it('永続化された内容を新しいTaskStoreインスタンスで読み込める', async () => {
    const storage = createInMemoryStorage();
    const first = new TaskStore(storage);
    await first.load();
    const created = await first.create(baseInput());

    const second = new TaskStore(storage);
    await second.load();

    expect(second.getById(created.id)).toEqual(created);
  });

  describe('getDescendantIds', () => {
    it('孫以降も含めて子孫のIDを返す', async () => {
      const grandparent = await store.create(baseInput({ title: '祖父' }));
      const parent = await store.create(baseInput({ title: '親', parentTaskId: grandparent.id }));
      const child = await store.create(baseInput({ title: '子', parentTaskId: parent.id }));

      const descendantIds = store.getDescendantIds(grandparent.id);

      expect(new Set(descendantIds)).toEqual(new Set([parent.id, child.id]));
    });

    it('子孫がいない場合は空配列を返す', async () => {
      const task = await store.create(baseInput());
      expect(store.getDescendantIds(task.id)).toEqual([]);
    });
  });

  describe('delete', () => {
    it('cascade:falseの場合、子タスクを削除対象の親の下に昇格させる', async () => {
      const grandparent = await store.create(baseInput({ title: '祖父' }));
      const parent = await store.create(baseInput({ title: '親', parentTaskId: grandparent.id }));
      const child = await store.create(baseInput({ title: '子', parentTaskId: parent.id }));

      await store.delete(parent.id, { cascade: false });

      expect(store.getById(parent.id)).toBeUndefined();
      expect(store.getById(child.id)?.parentTaskId).toBe(grandparent.id);
    });

    it('cascade:trueの場合、子孫タスクも再帰的に削除する', async () => {
      const grandparent = await store.create(baseInput({ title: '祖父' }));
      const parent = await store.create(baseInput({ title: '親', parentTaskId: grandparent.id }));
      const child = await store.create(baseInput({ title: '子', parentTaskId: parent.id }));

      await store.delete(parent.id, { cascade: true });

      expect(store.getById(parent.id)).toBeUndefined();
      expect(store.getById(child.id)).toBeUndefined();
      expect(store.getById(grandparent.id)).toBeDefined();
    });

    it('存在しないタスクを削除しようとすると例外を投げる', async () => {
      await expect(store.delete('no-such-id', { cascade: false })).rejects.toThrow(
        TaskNotFoundError,
      );
    });
  });

  describe('updateAnchor', () => {
    it('アンカー情報を更新する', async () => {
      const task = await store.create(baseInput());

      const updated = await store.updateAnchor(task.id, {
        logFilePath: '/workspace/other.md',
        anchorStartMarkerId: 'new-marker',
        anchorEndMarkerId: 'new-marker',
      });

      expect(updated.logFilePath).toBe('/workspace/other.md');
      expect(updated.anchorStartMarkerId).toBe('new-marker');
      expect(updated.anchorEndMarkerId).toBe('new-marker');
    });
  });

  describe('setJiraLink', () => {
    it('Jiraチケットキーとincludeフラグを設定する', async () => {
      const task = await store.create(baseInput());

      const updated = await store.setJiraLink(task.id, {
        jiraIssueKey: 'PROJ-123',
        includeInAncestorSummary: true,
      });

      expect(updated.jiraIssueKey).toBe('PROJ-123');
      expect(updated.includeInAncestorSummary).toBe(true);
    });

    it('jiraIssueKeyにnullを渡すと紐付けを解除できる', async () => {
      const task = await store.create(baseInput());
      await store.setJiraLink(task.id, {
        jiraIssueKey: 'PROJ-123',
        includeInAncestorSummary: false,
      });

      const updated = await store.setJiraLink(task.id, {
        jiraIssueKey: null,
        includeInAncestorSummary: false,
      });

      expect(updated.jiraIssueKey).toBeNull();
    });
  });

  describe('findNearestJiraLinkedTask', () => {
    it('自身がjiraIssueKeyを持つ場合は自身を返す', async () => {
      const task = await store.create(baseInput());
      await store.setJiraLink(task.id, { jiraIssueKey: 'PROJ-1', includeInAncestorSummary: false });

      expect(store.findNearestJiraLinkedTask(task.id)?.id).toBe(task.id);
    });

    it('自身に無ければ親方向に辿って見つける', async () => {
      const grandparent = await store.create(baseInput({ title: '祖父' }));
      await store.setJiraLink(grandparent.id, {
        jiraIssueKey: 'PROJ-1',
        includeInAncestorSummary: false,
      });
      const parent = await store.create(baseInput({ title: '親', parentTaskId: grandparent.id }));
      const child = await store.create(baseInput({ title: '子', parentTaskId: parent.id }));

      expect(store.findNearestJiraLinkedTask(child.id)?.id).toBe(grandparent.id);
    });

    it('誰も紐づいていない場合はundefinedを返す', async () => {
      const task = await store.create(baseInput());
      expect(store.findNearestJiraLinkedTask(task.id)).toBeUndefined();
    });

    it('nullを渡すとundefinedを返す', () => {
      expect(store.findNearestJiraLinkedTask(null)).toBeUndefined();
    });
  });
});
