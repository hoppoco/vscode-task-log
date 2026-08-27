import { describe, expect, it } from 'vitest';
import { buildSummary } from '../../../services/summaryGenerator';
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

describe('buildSummary', () => {
  it('親子孫の階層をインデント付きテキストで組み立てる', () => {
    const root = fakeTask({ id: 'r', title: '親チケット', jiraIssueKey: 'PROJ-1' });
    const child = fakeTask({ id: 'a', parentTaskId: 'r', title: '子A', status: 'open' });
    const grandchild = fakeTask({ id: 'a1', parentTaskId: 'a', title: '孫A1', status: 'done' });

    const result = buildSummary('r', [root, child, grandchild]);

    expect(result).toBe(
      ['- [未完了] 親チケット', '  - [未完了] 子A', '    - [完了] 孫A1'].join('\n'),
    );
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

    const result = buildSummary('r', [root, excluded, excludedChild]);

    expect(result).toBe('- [未完了] 親チケット');
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

    const result = buildSummary('r', [root, included, includedChild]);

    expect(result).toBe(
      ['- [未完了] 親チケット', '  - [未完了] 含めるC', '    - [未完了] C配下'].join('\n'),
    );
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

    const result = buildSummary('r', [root, included, deeplyExcluded]);

    expect(result).toBe(['- [未完了] 親チケット', '  - [未完了] 含めるC'].join('\n'));
  });

  it('起点タスクが見つからない場合は空文字列を返す', () => {
    const result = buildSummary('no-such-id', []);
    expect(result).toBe('');
  });
});
