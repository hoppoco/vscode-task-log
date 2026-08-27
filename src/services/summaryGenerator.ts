import type { Task } from '../models/task';

/**
 * 指定タスクを起点に、子孫タスクのタイトルとステータスをインデント付きテキストで組み立てる。
 * 降りていく途中で、現在有効なJiraチケットのスコープと異なる`jiraIssueKey`を持つタスクに
 * 出会ったら、そこが部分木の境界となる。`includeInAncestorSummary`が偽ならその部分木ごと
 * 除外し、真なら含めた上でスコープをそのタスクのキーに更新してさらに降りる。
 */
export function buildSummary(rootTaskId: string, allTasks: Task[]): string {
  const byParent = new Map<string | null, Task[]>();
  for (const task of allTasks) {
    const siblings = byParent.get(task.parentTaskId) ?? [];
    siblings.push(task);
    byParent.set(task.parentTaskId, siblings);
  }

  const root = allTasks.find((task) => task.id === rootTaskId);
  if (!root) {
    return '';
  }

  const lines: string[] = [];
  appendTask(root, 0, lines, byParent, root.jiraIssueKey);
  return lines.join('\n');
}

function appendTask(
  task: Task,
  depth: number,
  lines: string[],
  byParent: Map<string | null, Task[]>,
  scopeJiraIssueKey: string | null,
): void {
  const statusLabel = task.status === 'done' ? '完了' : '未完了';
  lines.push(`${'  '.repeat(depth)}- [${statusLabel}] ${task.title}`);

  const nextScope =
    task.jiraIssueKey && task.jiraIssueKey !== scopeJiraIssueKey
      ? task.jiraIssueKey
      : scopeJiraIssueKey;

  for (const child of byParent.get(task.id) ?? []) {
    const isDifferentScopeBoundary =
      child.jiraIssueKey !== null && child.jiraIssueKey !== nextScope;
    if (isDifferentScopeBoundary && !child.includeInAncestorSummary) {
      continue;
    }
    appendTask(child, depth + 1, lines, byParent, nextScope);
  }
}
