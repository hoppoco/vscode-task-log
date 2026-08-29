export interface JiraClientConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraIssueSummary {
  key: string;
  summary: string;
}

/**
 * これらの例外のmessageは、ログ・デバッグ用の素の英語文であり、ユーザーへの表示用文言では
 * ない。呼び出し元(commands層)がinstanceofで種類を判定し、vscode.l10n.t()で
 * 表示用のメッセージを組み立てる。
 */
export class JiraIssueFetchError extends Error {
  constructor(
    public readonly issueKey: string,
    public readonly status: number,
  ) {
    super(`Failed to fetch Jira issue ${issueKey} (status ${status})`);
    this.name = 'JiraIssueFetchError';
  }
}

export class JiraCommentPostError extends Error {
  constructor(
    public readonly issueKey: string,
    public readonly status: number,
  ) {
    super(`Failed to post comment to Jira issue ${issueKey} (status ${status})`);
    this.name = 'JiraCommentPostError';
  }
}

/** Atlassian Document Format(ADF)の最小構成。全文を1つのコードブロックとして包む */
function toAdfCodeBlock(text: string): unknown {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'codeBlock',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

export class JiraClient {
  private readonly baseUrl: string;

  constructor(private readonly config: JiraClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
  }

  async getIssueSummary(issueKey: string): Promise<JiraIssueSummary> {
    const response = await fetch(
      `${this.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary`,
      { headers: this.authHeaders() },
    );
    if (!response.ok) {
      throw new JiraIssueFetchError(issueKey, response.status);
    }

    const body = (await response.json()) as { key: string; fields: { summary: string } };
    return { key: body.key, summary: body.fields.summary };
  }

  async postComment(issueKey: string, bodyText: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
      {
        method: 'POST',
        headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: toAdfCodeBlock(bodyText) }),
      },
    );
    if (!response.ok) {
      throw new JiraCommentPostError(issueKey, response.status);
    }
  }

  private authHeaders(): Record<string, string> {
    const credentials = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString(
      'base64',
    );
    return { Authorization: `Basic ${credentials}`, Accept: 'application/json' };
  }
}
