import { describe, expect, it } from 'vitest';
import { buildSummaryTree } from '../../../services/summaryGenerator';
import type { Task } from '../../../models/task';

function fakeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-id',
    title: 'title',
    status: 'open',
    parentTaskId: null,
    logFilePath: '/workspace/log.md',
    anchorStartMarkerId: 'm',
    anchorEndMarkerId: 'm',
    jiraIssueKey: null,
    includeInAncestorSummary: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildSummaryTree', () => {
  it('親子孫の階層を構造化データとして組み立てる', () => {
    const root = fakeTask({ id: 'r', title: '親チケット', jiraIssueKey: 'PROJ-1' });
    const child = fakeTask({ id: 'a', parentTaskId: 'r', title: '子A', status: 'open' });
    const grandchild = fakeTask({ id: 'a1', parentTaskId: 'a', title: '孫A1', status: 'done' });

    const result = buildSummaryTree('r', [root, child, grandchild]);

    expect(result).toEqual([
      { depth: 0, title: '親チケット', status: 'open' },
      { depth: 1, title: '子A', status: 'open' },
      { depth: 2, title: '孫A1', status: 'done' },
    ]);
  });

  it('別チケットに紐づきincludeInAncestorSummaryが偽の部分木は除外する', () => {
    const root = fakeTask({ id: 'r', title: '親チケット', jiraIssueKey: 'PROJ-1' });
    const excluded = fakeTask({
      id: 'b',
      parentTaskId: 'r',
      title: '別件B',
      jiraIssueKey: 'PROJ-2',
      includeInAncestorSummary: false,
    });
    const excludedChild = fakeTask({ id: 'b1', parentTaskId: 'b', title: 'B配下' });

    const result = buildSummaryTree('r', [root, excluded, excludedChild]);

    expect(result).toEqual([{ depth: 0, title: '親チケット', status: 'open' }]);
  });

  it('別チケットに紐づきincludeInAncestorSummaryが真の部分木は含め、スコープを更新する', () => {
    const root = fakeTask({ id: 'r', title: '親チケット', jiraIssueKey: 'PROJ-1' });
    const included = fakeTask({
      id: 'c',
      parentTaskId: 'r',
      title: '含めるC',
      jiraIssueKey: 'PROJ-3',
      includeInAncestorSummary: true,
    });
    const includedChild = fakeTask({ id: 'c1', parentTaskId: 'c', title: 'C配下' });

    const result = buildSummaryTree('r', [root, included, includedChild]);

    expect(result).toEqual([
      { depth: 0, title: '親チケット', status: 'open' },
      { depth: 1, title: '含めるC', status: 'open' },
      { depth: 2, title: 'C配下', status: 'open' },
    ]);
  });

  it('内包された部分木のさらに内側にある独立部分木は、その時点の境界判定に従う', () => {
    const root = fakeTask({ id: 'r', title: '親チケット', jiraIssueKey: 'PROJ-1' });
    const included = fakeTask({
      id: 'c',
      parentTaskId: 'r',
      title: '含めるC',
      jiraIssueKey: 'PROJ-3',
      includeInAncestorSummary: true,
    });
    const deeplyExcluded = fakeTask({
      id: 'd',
      parentTaskId: 'c',
      title: '除外されるD',
      jiraIssueKey: 'PROJ-4',
      includeInAncestorSummary: false,
    });

    const result = buildSummaryTree('r', [root, included, deeplyExcluded]);

    expect(result).toEqual([
      { depth: 0, title: '親チケット', status: 'open' },
      { depth: 1, title: '含めるC', status: 'open' },
    ]);
  });

  it('起点タスクが見つからない場合は空配列を返す', () => {
    const result = buildSummaryTree('no-such-id', []);
    expect(result).toEqual([]);
  });
});
