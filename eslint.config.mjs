import cds from "@sap/cds/eslint.config.mjs";

export default [
  ...cds.recommended,
  {
    // Allow console statements in test files
    files: ['__tests__/**/*.js', '__tests__/**/*.mjs', '**/*.test.js', '**/*.spec.js'],
    rules: {
      'no-console': 'off'
    }
  }
];
