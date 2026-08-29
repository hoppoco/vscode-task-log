import type { Task, TaskStatus } from '../models/task';

export interface SummaryNode {
  depth: number;
  title: string;
  status: TaskStatus;
}

/**
 * 指定タスクを起点に、子孫タスクのタイトルとステータスを構造化データとして組み立てる。
 * テキストへの変換(ステータスラベルの付与など)は呼び出し側が行う(l10n対応のため、
 * このサービスはvscodeに依存せずvscode.l10n.t()を呼べないので、文言化は行わない)。
 *
 * 降りていく途中で、現在有効なJiraチケットのスコープと異なる`jiraIssueKey`を持つタスクに
 * 出会ったら、そこが部分木の境界となる。`includeInAncestorSummary`が偽ならその部分木ごと
 * 除外し、真なら含めた上でスコープをそのタスクのキーに更新してさらに降りる。
 */
export function buildSummaryTree(rootTaskId: string, allTasks: Task[]): SummaryNode[] {
  const byParent = new Map<string | null, Task[]>();
  for (const task of allTasks) {
    const siblings = byParent.get(task.parentTaskId) ?? [];
    siblings.push(task);
    byParent.set(task.parentTaskId, siblings);
  }

  const root = allTasks.find((task) => task.id === rootTaskId);
  if (!root) {
    return [];
  }

  const nodes: SummaryNode[] = [];
  appendTask(root, 0, nodes, byParent, root.jiraIssueKey);
  return nodes;
}

function appendTask(
  task: Task,
  depth: number,
  nodes: SummaryNode[],
  byParent: Map<string | null, Task[]>,
  scopeJiraIssueKey: string | null,
): void {
  nodes.push({ depth, title: task.title, status: task.status });

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
    appendTask(child, depth + 1, nodes, byParent, nextScope);
  }
}
