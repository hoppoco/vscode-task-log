const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'out/**', 'node_modules/**', '.vscode-test/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/services/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'vscode',
              message:
                'src/services配下はvscodeをimportしない(docs/development-guidelines.md参照)。値または小さなインターフェースの注入で解決すること。',
            },
          ],
        },
      ],
    },
  },
);
