import cds from "@sap/cds/eslint.config.mjs";

export default [
  ...cds.recommended,
  {
    // Allow console statements in test files and add jest globals
    files: ['__tests__/**/*.js', '__tests__/**/*.mjs', '**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        test: 'readonly'
      }
    },
    rules: {
      'no-console': 'off'
    }
  }
];
