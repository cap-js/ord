# Here are code quality and tool use rules

## CAP framework knowledge via CAP MCP server

- You MUST search for CDS definitions, like entities, fields and services (which include HTTP endpoints) with cds-mcp, only if it fails you MAY read \*.cds files in the project.
- You MUST search for CAP docs with cds-mcp EVERY TIME you modify CDS models or when using APIs from CAP. As long as you have access to the cds-mcp tool, Do NOT propose, suggest or make any changes without first checking it.

## Code Quality Rules

- Run unit tests after each significant change and ensure that tests still pass
- Use linters and formatters to maintain code quality and consistency
- Write clear and concise commit messages
- Keep code changes focused and small in scope
- Favor simple implementation over complex use of patterns
- Favor usage of existing functions in the repository over introducing new ones. If existing functions don't fit the purpose, try to enhance them first, before introducing new ones.
