import { resolveAnchor, type LineRange } from './markerAnchorService';
import type { Task } from '../models/task';

/**
 * 指定した行範囲を完全に含む、最も内側(範囲が最小)のタスクを求める。
 * マーカーが正しく入れ子になっている場合、範囲最小のものが必ず最も内側のタスクと一致する。
 * マーカー同士が入れ子にならず一部だけ重なっている場合は、範囲最小優先という
 * 機械的な基準で決着する(意図的な割り切り。詳細はdesign.md参照)。
 */
export function findInnermostContainingTask(
  logText: string,
  range: LineRange,
  candidates: Task[],
): Task | undefined {
  let best: { task: Task; size: number } | undefined;

  for (const task of candidates) {
    const resolved = resolveAnchor(logText, task.anchorStartMarkerId, task.anchorEndMarkerId);
    if (!resolved) {
      continue;
    }

    const contains = resolved.startLine <= range.startLine && resolved.endLine >= range.endLine;
    if (!contains) {
      continue;
    }

    const size = resolved.endLine - resolved.startLine;
    if (!best || size < best.size) {
      best = { task, size };
    }
  }

  return best?.task;
}
