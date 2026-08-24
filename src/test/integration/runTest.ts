import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'tasklog-test-'));

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspacePath],
    });
  } catch (error) {
    console.error('拡張機能の結合テストの起動に失敗しました', error);
    process.exit(1);
  }
}

main();
