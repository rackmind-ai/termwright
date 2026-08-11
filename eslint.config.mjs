import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'],
  },
  {
    files: ['**/*.mjs'],
    ...eslint.configs.recommended,
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['**/*.test.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  eslintConfigPrettier,
);
