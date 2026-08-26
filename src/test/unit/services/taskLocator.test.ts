import { describe, expect, it } from 'vitest';
import { findInnermostContainingTask } from '../../../services/taskLocator';
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

describe('findInnermostContainingTask', () => {
  it('単一マーカーが範囲を含んでいれば、そのタスクを返す', () => {
    const text = [
      'line0',
      '<!-- tasklog:a:start -->',
      'line2',
      'line3',
      '<!-- tasklog:a:end -->',
      'line5',
    ].join('\n');
    const taskA = fakeTask({ id: 'a', anchorStartMarkerId: 'a', anchorEndMarkerId: 'a' });

    const result = findInnermostContainingTask(text, { startLine: 2, endLine: 3 }, [taskA]);

    expect(result?.id).toBe('a');
  });

  it('正しく入れ子になっている場合、最も内側(範囲最小)のタスクを返す', () => {
    const text = [
      'line0',
      '<!-- tasklog:a:start -->',
      'line2',
      '<!-- tasklog:b:start -->',
      'line4',
      '<!-- tasklog:b:end -->',
      'line6',
      '<!-- tasklog:a:end -->',
      'line8',
    ].join('\n');
    const taskA = fakeTask({ id: 'a', anchorStartMarkerId: 'a', anchorEndMarkerId: 'a' });
    const taskB = fakeTask({ id: 'b', anchorStartMarkerId: 'b', anchorEndMarkerId: 'b' });

    const result = findInnermostContainingTask(text, { startLine: 4, endLine: 4 }, [taskA, taskB]);

    expect(result?.id).toBe('b');
  });

  it('どのタスクにも含まれない範囲はundefinedを返す', () => {
    const text = ['line0', '<!-- tasklog:a:start -->', 'line2', '<!-- tasklog:a:end -->'].join(
      '\n',
    );
    const taskA = fakeTask({ id: 'a', anchorStartMarkerId: 'a', anchorEndMarkerId: 'a' });

    const result = findInnermostContainingTask(text, { startLine: 0, endLine: 0 }, [taskA]);

    expect(result).toBeUndefined();
  });

  it('入れ子になっていない重なりでは、範囲最小のタスクを機械的に返す', () => {
    // A: 1-6, B: 4-8 (どちらもマーカー行を含む)。4-6が重なる範囲。
    const text = [
      'line0',
      '<!-- tasklog:a:start -->',
      'line2',
      'line3',
      '<!-- tasklog:b:start -->',
      'line5',
      '<!-- tasklog:a:end -->',
      'line7',
      '<!-- tasklog:b:end -->',
    ].join('\n');
    const taskA = fakeTask({ id: 'a', anchorStartMarkerId: 'a', anchorEndMarkerId: 'a' });
    const taskB = fakeTask({ id: 'b', anchorStartMarkerId: 'b', anchorEndMarkerId: 'b' });

    const result = findInnermostContainingTask(text, { startLine: 5, endLine: 5 }, [taskA, taskB]);

    expect(result?.id).toBe('b');
  });

  it('アンカーが解決できない候補は無視する', () => {
    const text = ['line0', '<!-- tasklog:a:start -->', 'line2', '<!-- tasklog:a:end -->'].join(
      '\n',
    );
    const taskA = fakeTask({ id: 'a', anchorStartMarkerId: 'a', anchorEndMarkerId: 'a' });
    const missing = fakeTask({
      id: 'missing',
      anchorStartMarkerId: 'no-such',
      anchorEndMarkerId: 'no-such',
    });

    const result = findInnermostContainingTask(text, { startLine: 2, endLine: 2 }, [
      missing,
      taskA,
    ]);

    expect(result?.id).toBe('a');
  });
});
