import * as vscode from 'vscode';
import {
  insertMarkers,
  type InsertMarkersResult,
  type LineRange,
} from '../services/markerAnchorService';

/**
 * エディタの選択範囲を行範囲に変換する。
 * 選択が空の場合は、カーソルのある行1行を範囲として返す。
 */
export function selectionToLineRange(editor: vscode.TextEditor): LineRange {
  const selection = editor.selection;
  if (selection.isEmpty) {
    return { startLine: selection.active.line, endLine: selection.active.line };
  }

  const startLine = selection.start.line;
  const endLine =
    selection.end.character === 0 && selection.end.line > selection.start.line
      ? selection.end.line - 1
      : selection.end.line;

  return { startLine, endLine };
}

/** 指定した行範囲にマーカーを挿入し、エディタのドキュメントへ反映する */
export async function applyMarkerInsertion(
  editor: vscode.TextEditor,
  lineRange: LineRange,
): Promise<InsertMarkersResult | undefined> {
  const document = editor.document;
  const inserted = insertMarkers(document.getText(), lineRange);
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length),
  );

  const applied = await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, inserted.text);
  });
  if (!applied) {
    vscode.window.showErrorMessage('ログへのマーカー挿入に失敗しました');
    return undefined;
  }

  return inserted;
}
