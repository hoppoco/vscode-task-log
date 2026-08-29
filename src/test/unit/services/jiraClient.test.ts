import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  JiraClient,
  JiraCommentPostError,
  JiraIssueFetchError,
} from '../../../services/jiraClient';

function mockFetchResponse(ok: boolean, status: number, json: unknown): Response {
  return { ok, status, json: async () => json } as Response;
}

function getFetchMock(): ReturnType<typeof vi.fn> {
  return fetch as unknown as ReturnType<typeof vi.fn>;
}

describe('JiraClient', () => {
  const config = {
    baseUrl: 'https://example.atlassian.net/',
    email: 'user@example.com',
    apiToken: 'token123',
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getIssueSummary', () => {
    it('チケット情報を取得し、正しいURL・認証ヘッダでリクエストする(末尾スラッシュも正規化される)', async () => {
      getFetchMock().mockResolvedValue(
        mockFetchResponse(true, 200, {
          key: 'PROJ-123',
          fields: { summary: 'ログイン不具合の調査' },
        }),
      );

      const client = new JiraClient(config);
      const result = await client.getIssueSummary('PROJ-123');

      expect(result).toEqual({ key: 'PROJ-123', summary: 'ログイン不具合の調査' });

      const [url, options] = getFetchMock().mock.calls[0];
      expect(url).toBe('https://example.atlassian.net/rest/api/3/issue/PROJ-123?fields=summary');
      const expectedAuth = `Basic ${Buffer.from('user@example.com:token123').toString('base64')}`;
      expect(options.headers.Authorization).toBe(expectedAuth);
    });

    it('存在しないチケットキーの場合は例外を投げる', async () => {
      getFetchMock().mockResolvedValue(mockFetchResponse(false, 404, {}));

      const client = new JiraClient(config);
      await expect(client.getIssueSummary('NOPE-1')).rejects.toThrow(JiraIssueFetchError);
    });
  });

  describe('postComment', () => {
    it('ADF形式(codeBlock)でコメント本文を投稿する', async () => {
      getFetchMock().mockResolvedValue(mockFetchResponse(true, 201, {}));

      const client = new JiraClient(config);
      await client.postComment('PROJ-123', '調査状況のテキスト');

      const [url, options] = getFetchMock().mock.calls[0];
      expect(url).toBe('https://example.atlassian.net/rest/api/3/issue/PROJ-123/comment');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body as string);
      expect(body.body.type).toBe('doc');
      expect(body.body.content[0].type).toBe('codeBlock');
      expect(body.body.content[0].content[0].text).toBe('調査状況のテキスト');
    });

    it('投稿に失敗した場合は例外を投げる', async () => {
      getFetchMock().mockResolvedValue(mockFetchResponse(false, 500, {}));

      const client = new JiraClient(config);
      await expect(client.postComment('PROJ-123', 'text')).rejects.toThrow(JiraCommentPostError);
    });
  });
});
