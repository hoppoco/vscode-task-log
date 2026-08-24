import { describe, expect, it } from 'vitest';
import {
  generateMarkerId,
  insertMarkers,
  resolveAnchor,
} from '../../../services/markerAnchorService';

describe('insertMarkers', () => {
  it('選択範囲の前後にマーカー行を挿入する', () => {
    const text = ['line0', 'line1', 'line2', 'line3'].join('\n');

    const result = insertMarkers(text, { startLine: 1, endLine: 2 }, 'abc123');

    expect(result.text.split('\n')).toEqual([
      'line0',
      '<!-- tasklog:abc123:start -->',
      'line1',
      'line2',
      '<!-- tasklog:abc123:end -->',
      'line3',
    ]);
    expect(result.anchorStartMarkerId).toBe('abc123');
    expect(result.anchorEndMarkerId).toBe('abc123');
  });

  it('markerIdを省略した場合は自動生成される', () => {
    const result = insertMarkers('line0', { startLine: 0, endLine: 0 });
    expect(result.anchorStartMarkerId).toBeTruthy();
    expect(result.anchorStartMarkerId).toBe(result.anchorEndMarkerId);
  });
});

describe('resolveAnchor', () => {
  it('マーカーに挟まれた範囲の内容を復元する', () => {
    const { text } = insertMarkers(
      ['line0', 'line1', 'line2', 'line3'].join('\n'),
      { startLine: 1, endLine: 2 },
      'abc123',
    );

    const resolved = resolveAnchor(text, 'abc123', 'abc123');

    expect(resolved).not.toBeNull();
    expect(resolved?.content).toBe('line1\nline2');
  });

  it('その後の編集で範囲内の内容が変わっても追従する', () => {
    const inserted = insertMarkers(
      ['line0', 'line1', 'line2', 'line3'].join('\n'),
      { startLine: 1, endLine: 2 },
      'abc123',
    );
    const edited = inserted.text.replace('line2', 'line2-edited\nline2-added');

    const resolved = resolveAnchor(edited, 'abc123', 'abc123');

    expect(resolved?.content).toBe('line1\nline2-edited\nline2-added');
  });

  it('マーカーが見つからない場合はnull(アンカー未接続)を返す', () => {
    const resolved = resolveAnchor('line0\nline1', 'missing', 'missing');
    expect(resolved).toBeNull();
  });

  it('開始マーカーのみ存在する場合はnullを返す', () => {
    const text = ['<!-- tasklog:abc123:start -->', 'line1'].join('\n');
    const resolved = resolveAnchor(text, 'abc123', 'abc123');
    expect(resolved).toBeNull();
  });

  it('終了マーカーが開始マーカーより前にある場合はnullを返す', () => {
    const text = ['<!-- tasklog:abc123:end -->', 'line1', '<!-- tasklog:abc123:start -->'].join(
      '\n',
    );
    const resolved = resolveAnchor(text, 'abc123', 'abc123');
    expect(resolved).toBeNull();
  });
});

describe('generateMarkerId', () => {
  it('呼び出すたびに異なるIDを生成する', () => {
    const id1 = generateMarkerId();
    const id2 = generateMarkerId();
    expect(id1).not.toBe(id2);
  });
});
