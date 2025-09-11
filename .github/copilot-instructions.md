# Copilot Instructions for AI Coding Agents

## Project Overview

- This is a CDS plugin for the [Open Resource Discovery (ORD)](https://open-resource-discovery.github.io/specification/) protocol, designed for CAP-based applications.
- The plugin exposes a single entry point for discovering and gathering machine-readable metadata about the application, supporting both static cataloging and runtime inspection.
- Security: By default, metadata is public. To secure, configure authentication via environment variables or `.cdsrc.json` (see below).

## Architecture & Key Components

- Main logic is in `lib/` (e.g., `ord.js`, `ord-service.js`, `metaData.js`, etc.).
- Test suites are in `unittest/` and `__tests__/` (unit and integration/e2e tests).
- Example and reference projects are in `xmpl/` and `xmpl_java/`.
- Memory bank for project context is in `memory-bank/` (see `.clinerules/memory-bank.md`).

## Developer Workflows

- **Install dependencies:** `npm install`
- **Run tests:** `npm test` (unit and e2e tests)
- **Lint:** Use the provided `eslint.config.mjs` for linting.
- **Authentication:**
    - Set `ORD_AUTH_TYPE` and `BASIC_AUTH` env vars, or configure `.cdsrc.json` for authentication.
    - Example: `BASIC_AUTH='{"admin":"<bcrypt-hash>"}'`
- **CDS Model Changes:**
    - Always use the `cds-mcp` tool to search for CDS definitions and CAP docs before modifying models or using CAP APIs.
    - Only read `.cds` files directly if `cds-mcp` is unavailable.

## Project Conventions & Patterns

- Follow the memory bank workflow: always read and update `memory-bank/` files at the start/end of significant tasks.
- Keep code changes focused and small; favor enhancing existing functions over introducing new ones.
- Use linters and run all tests after significant changes.
- Commit messages should be clear and concise.
- Example authentication config is in the main `README.md`.

## Integration & External Dependencies

- Depends on `@cap-js/openapi`, and `@cap-js/asyncapi` (installed locally, not globally).
- Uses CAP framework conventions for service and entity definitions.
- Authentication can be configured via environment or `.cdsrc.json`.

## References

- Main documentation: `README.md`
- Code quality and CAP usage rules: `.clinerules/code-quality.md`
- Memory bank and project context: `.clinerules/memory-bank.md`, `memory-bank/`
- Example usage: `xmpl/`, `xmpl_java/`

---

> For any non-obvious workflow, pattern, or integration, check the memory bank and code quality rules before proceeding. If in doubt, prefer explicit documentation and update the memory bank as needed.
