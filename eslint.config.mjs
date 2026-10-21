import eslint from 'eslint';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export const baseConfig = [
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**', '.next/**', 'prisma/generated/**'] },
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'off',
    },
  },
];

export default baseConfig;
