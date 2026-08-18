import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Deliberately narrow. This is not a style linter — Prettier-style formatting
 * arguments are not what it is here for. It catches the class of mistake that
 * a bundler will happily build and only fails at runtime: a component or
 * variable that is referenced but never defined, and hook dependency bugs.
 */
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    // Build config runs in Node, not the browser, so it gets Node globals.
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      // The whole point: <Foo /> where Foo was never imported builds fine and
      // white-screens at runtime.
      'react/jsx-no-undef': 'error',
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',
      ...reactHooks.configs.recommended.rules,
      // Downgraded, not disabled. Every current hit is a legitimate case the
      // rule cannot distinguish: fetching on mount, syncing a form to the
      // record a panel was opened with, resetting to page 1 when a filter
      // changes. Worth seeing, not worth contorting correct code for.
      'react-hooks/set-state-in-effect': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
