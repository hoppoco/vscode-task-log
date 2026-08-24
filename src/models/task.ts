export type TaskStatus = 'open' | 'done';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  parentTaskId: string | null;
  logFilePath: string;
  anchorStartMarkerId: string;
  anchorEndMarkerId: string;
  /** Phase 2で利用するJira連携用フィールド。Phase 1では未使用。 */
  jiraIssueKey: string | null;
  /** Phase 2で利用するJira連携用フィールド。Phase 1では未使用。 */
  includeInAncestorSummary: boolean;
  createdAt: string;
  updatedAt: string;
}
