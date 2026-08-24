import { randomUUID } from 'node:crypto';

export interface LineRange {
  /** 0-indexed, inclusive */
  startLine: number;
  /** 0-indexed, inclusive */
  endLine: number;
}

export interface InsertMarkersResult {
  text: string;
  anchorStartMarkerId: string;
  anchorEndMarkerId: string;
}

export interface ResolvedAnchor {
  /** 開始・終了マーカーに挟まれた範囲の内容(マーカー行自体は含まない) */
  content: string;
  /** マーカー行を含む、開始行(0-indexed) */
  startLine: number;
  /** マーカー行を含む、終了行(0-indexed) */
  endLine: number;
}

const MARKER_LINE_PATTERN = /^\s*<!-- tasklog:([a-zA-Z0-9_-]+):(start|end) -->\s*$/;

function buildMarkerLine(markerId: string, kind: 'start' | 'end'): string {
  return `<!-- tasklog:${markerId}:${kind} -->`;
}

function parseMarkerLine(line: string): { id: string; kind: 'start' | 'end' } | null {
  const match = line.match(MARKER_LINE_PATTERN);
  if (!match) {
    return null;
  }
  return { id: match[1], kind: match[2] as 'start' | 'end' };
}

/** タスク化のたびに一意なマーカーIDを発行する */
export function generateMarkerId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * 指定した行範囲(selection)の前後に開始・終了マーカーを挿入する。
 * ログ本文の内容は一切変更しない(挿入のみ)。
 */
export function insertMarkers(
  text: string,
  selection: LineRange,
  markerId: string = generateMarkerId(),
): InsertMarkersResult {
  const lines = text.split('\n');
  const startMarkerLine = buildMarkerLine(markerId, 'start');
  const endMarkerLine = buildMarkerLine(markerId, 'end');

  const result = [
    ...lines.slice(0, selection.startLine),
    startMarkerLine,
    ...lines.slice(selection.startLine, selection.endLine + 1),
    endMarkerLine,
    ...lines.slice(selection.endLine + 1),
  ];

  return {
    text: result.join('\n'),
    anchorStartMarkerId: markerId,
    anchorEndMarkerId: markerId,
  };
}

/**
 * 開始・終了マーカーIDから、その間の範囲を復元する。
 * マーカーが見つからない、または開始・終了の順序が不正な場合はnull(アンカー未接続)を返す。
 */
export function resolveAnchor(
  text: string,
  anchorStartMarkerId: string,
  anchorEndMarkerId: string,
): ResolvedAnchor | null {
  const lines = text.split('\n');
  let startLine = -1;
  let endLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const marker = parseMarkerLine(lines[i]);
    if (!marker) {
      continue;
    }
    if (marker.id === anchorStartMarkerId && marker.kind === 'start') {
      startLine = i;
    }
    if (marker.id === anchorEndMarkerId && marker.kind === 'end') {
      endLine = i;
    }
  }

  if (startLine === -1 || endLine === -1 || endLine <= startLine) {
    return null;
  }

  return {
    content: lines.slice(startLine + 1, endLine).join('\n'),
    startLine,
    endLine,
  };
}
