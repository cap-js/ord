import cds from "@sap/cds/eslint.config.mjs";

export default [
    ...cds.recommended,
    {
        rules: {
            "no-console": "off",
            "no-unused-vars": ["warn", { "argsIgnorePattern": "lazy" }]
        }
    }
];
