import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const reactRecommendedTs = eslintReact.configs['recommended-typescript'];
const typeCheckedConfigs = [
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked
]
  .filter((config) => config && typeof config === 'object')
  .map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}']
  }));

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  ...typeCheckedConfigs,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        chrome: 'readonly'
      }
    },
    plugins: {
      ...(reactRecommendedTs.plugins ?? {}),
      prettier: prettierPlugin
    },
    settings: {
      ...(reactRecommendedTs.settings ?? {})
    },
    rules: {
      ...(reactRecommendedTs.rules ?? {}),
      'prettier/prettier': 'warn'
    }
  },
  {
    files: ['vite.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    plugins: {
      prettier: prettierPlugin
    },
    rules: {
      'prettier/prettier': 'warn'
    }
  },
  prettierConfig
);
