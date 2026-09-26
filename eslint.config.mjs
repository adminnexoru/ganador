import expoConfig from 'eslint-config-expo/flat.js';
import i18next from 'eslint-plugin-i18next';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/*.min.js',
      'apps/api/drizzle/**',
      '.specify/**',
      '.claude/**',
    ],
  },
  // Servidor, dominio y herramientas: TypeScript estricto.
  ...tseslint.configs.recommended.map((c) => ({
    ...c,
    files: ['apps/api/**/*.ts', 'packages/**/*.ts', 'tools/**/*.ts'],
  })),
  // App Expo.
  ...expoConfig.map((c) => ({ ...c, files: ['apps/mobile/**/*.{js,jsx,ts,tsx}'] })),
  {
    files: ['apps/mobile/**/*.{js,jsx,ts,tsx}'],
    settings: {
      'import/resolver': { typescript: { project: 'apps/mobile/tsconfig.json' } },
    },
  },
  // Principio IV: ningún texto visible escrito directo en pantallas o componentes.
  {
    files: ['apps/mobile/src/app/**/*.tsx', 'apps/mobile/src/components/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          // Solo atributos que el usuario ve o escucha; los técnicos (accessibilityRole,
          // keyboardType, etc.) no son textos de interfaz.
          'jsx-attributes': {
            include: ['label', 'title', 'placeholder', 'accessibilityLabel', 'accessibilityHint', 'alt'],
          },
        },
      ],
    },
  },
];
