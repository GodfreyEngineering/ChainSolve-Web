import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  // Adapter boundary: UI components must not import the Supabase client directly.
  // Use service-layer functions in src/lib/ instead.
  // Type-only imports (e.g. `import type { User }`) are allowed — no runtime coupling.
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['off'],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '.*/lib/supabase',
              message:
                'UI components must not import the Supabase client. Use service-layer functions from src/lib/ instead.',
            },
            {
              regex: '^@supabase/',
              allowTypeImports: true,
              message:
                'UI components must not import Supabase runtime values. Type imports are OK.',
            },
          ],
        },
      ],
    },
  },
])
