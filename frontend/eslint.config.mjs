import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['build/**', 'node_modules/**', 'dist/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      // The codebase intentionally uses `any` in places (API boundaries, map callbacks).
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      // Empty catch blocks (`catch {}`) are an intentional pattern across the codebase.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Preserve the YouTube Creator z-index guardrails that previously lived in
    // package.json's CRA `eslintConfig` overrides.
    files: ['src/components/YouTubeCreator/**/*.{ts,tsx}'],
    ignores: [
      'src/components/YouTubeCreator/dashboard/youtubeStudioZIndex.ts',
      'src/components/YouTubeCreator/dashboard/youtubeStudioOverlayInventory.ts',
      'src/components/YouTubeCreator/dashboard/youtubeStudioZIndexGuardrail.ts',
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "Property[key.name='zIndex'][value.value=1250]", message: 'YouTube Creator: use YT_Z_CREATOR_SURFACE from youtubeStudioZIndex.ts.' },
        { selector: "Property[key.name='zIndex'][value.value=1300]", message: 'YouTube Creator: do not hardcode MUI modal z-index; keep nested Dialog/Select on MUI defaults.' },
        { selector: "Property[key.name='zIndex'][value.value=1400]", message: 'YouTube Creator: do not raise Dialog z-index to beat a host shell.' },
        { selector: "Property[key.name='zIndex'][value.value=1500]", message: 'YouTube Creator: do not hardcode MUI tooltip/menu z-index.' },
        { selector: "Property[key.name='zIndex'][value.value=12000]", message: 'YouTube Creator: use YT_Z_KNOWLEDGE_CENTER from youtubeStudioZIndex.ts.' },
        { selector: "Property[key.name='zIndex'][value.value=13000]", message: 'YouTube Creator: use YT_Z_MODAL from youtubeStudioZIndex.ts.' },
        { selector: "Property[key.name='zIndex'][value.value=13001]", message: 'YouTube Creator: YT_Z_MODAL + 1 patches are forbidden (YT_Z_MODAL_POPOVER is retired).' },
      ],
    },
  },
);
