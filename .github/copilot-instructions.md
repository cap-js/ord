# Copilot Instructions (ORD CAP Plugin)

Concise, actionable guidance for AI coding agents working on this repository. Focus on THESE project patterns—not generic advice.

## 1. Big Picture

This is a CAP (@sap/cds) plugin that generates and serves Open Resource Discovery (ORD) metadata. Two execution paths:

1. Static build: `cds build --for ord` / `cds.compile.to.ord(csn)` writes `gen/ord/*` (document + resource artifacts).
2. Runtime API: `OpenResourceDiscoveryService` (defined in `lib/ord-service.cds` + implemented in `ord-service.js`) serves live ORD JSON + referenced specs.

Core composition (read these first when changing generation logic):
`lib/ord.js` (orchestrator) -> `templates.js` (resource templates + visibility + version extraction) -> `defaults.js` (baseline values) -> `extendOrdWithCustom.js` (merge custom overrides) -> `authentication.js` (access strategies) -> `interopCsn.js` (CSN interop export) -> `build.js` (build target wiring).

## 2. Generation Flow (critical mental model)

CSN in → `_triageCsnDefinitions()` classifies services/entities/events → template builders create API/Event/EntityType resources → custom merge (if `env.ord.customOrdContentFile`) overlays by `ordId` → unused packages trimmed → final ORD document returned/served.
Blocked / skipped cases: service marked `@protocol:'none'`, external services (`cds.requires.*`), blocked names (`MTXServices`, `OpenResourceDiscoveryService`), services with only events (no entities/actions/functions) => no API resource.

## 3. Customization Hierarchy (highest wins)

Env vars > `.cdsrc.json` `ord` section > `custom.ord.json` (structural merge by `ordId`) > `@ORD.Extensions.*` annotations > defaults. MCP resource customization: match `*:apiResource:mcp-server:v1` in `custom.ord.json`—merge preserves `apiProtocol` & generated `resourceDefinitions`.

## 4. MCP Resource

Inserted conditionally if `isMCPPluginAvailable()` returns true (tests mock it). Template in `templates.js#createMCPAPIResourceTemplate`. When customizing: ensure bookshop test model sets `cds.root` AND `env.ord` before requiring `lib/ord`. Do NOT rely on inline `cds.linked()` for customization tests—load actual model with `cds.load(<srv path>)` to activate merge.

## 5. Visibility & Packaging

`_handleVisibility()` cascades: explicit @ORD.Extensions.visibility > implementation standard defaults > configured `defaultVisibility` > fallback public. Private resources are filtered out. Package selection uses `_getPackageID()` with visibility-specific suffix (`-internal`, `-private`). After merge, `_filterUnusedPackages()` prunes unreferenced package entries.

## 6. Version & Data Product Services

Data product services may carry a suffixed name `.vN`; `_extractVersionFromServiceName()` maps `vN` → semantic `N.0.0`, adjusts ordId & groups. Primary data product services (annotations) force `apiProtocol: rest`, add `implementationStandard: sap.dp:data-subscription-api:v1`, and replace OpenAPI/EDMX with CSN interop resource definition.

## 7. Entity Type Mapping

ODM or relationship annotations (`@ODM.entityName`, `@EntityRelationship.entityType`) generate entityTypeMappings/exposedEntityTypes. ODM mappings flagged `isODMMapping` are NOT emitted as entityTypes (only referenced). SAP policy levels (e.g. `sap:core:v1`) suppress entity type emission (central registry expectation).

## 8. Event Broker Integration Dependencies

`eventBrokerAdapter.js` detects @cap-js/event-broker configuration and generates Integration Dependencies. Dual namespace handling: `ordNamespace` for integrationDependency ordId (consuming app), `sourceNamespace` for eventResource ordId (external source from ceSource). Configuration: `cds.ord.consumedEventTypes` array for build-time. Package selection uses `_getPackageID()` with visibility. Graceful skip if Event Broker not configured or no events.

## 9. Authentication Layer

`authentication.js` builds `accessStrategies` array (currently open/basic). Environment precedence: `ORD_AUTH_TYPE` then `.cdsrc.json`. Basic auth expects bcrypt hashes (see README). When adding new strategy, propagate through `getAuthConfig()` and templates (each resourceDefinition includes `accessStrategies`).

## 10. Testing Conventions

Test types:
`__tests__/ord.e2e.test.js` (integration / feature)—favor field assertions over brittle full-document snapshots for dynamic/custom merges (especially MCP). Snapshot tests still exist elsewhere; update with caution (`npm test -- -u`). Unit/behavior tests in `unittest/` & fine-grained mocks in `__tests__/__mocks__`.
When altering merge or template logic: add/adjust a focused assertion in e2e rather than broad snapshot regeneration unless structure fundamentally changes.

## 11. Safe Change Checklist (always)

1. Read memory bank (`memory-bank/*.md`) for active context & architectural constraints.
2. If modifying model-related logic: inspect relevant template/helper in `templates.js` & invocation in `ord.js`.
3. Run `npm test` (do not skip; many conditions are covered indirectly).
4. Avoid introducing duplicate logic—extend existing template helpers instead.
5. Preserve `apiProtocol` when merging custom overrides; never silently drop `resourceDefinitions`.

## 12. Common Pitfalls

- Forgetting to set `cds.root` before loading CSN in tests → custom file merge fails.
- Adding snapshot assertions for mutable counts (API/Event resources can grow with model) → flaky CI.
- Overwriting MCP ordId without preserving protocol/definitions (merge helper now safeguards—maintain it when refactoring).
- Emitting private resources or unused packages—ensure filtering stays intact after changes.

## 13. Useful File Map

`lib/ord.js` (entry orchestration) | `lib/templates.js` (all generation rules) | `lib/extendOrdWithCustom.js` (merge by ordId + null cleanup) | `lib/defaults.js` (package/product defaults) | `lib/authentication.js` (access strategies) | `lib/interopCsn.js` (interop export) | `lib/eventBrokerAdapter.js` (Event Broker detection) | `cds-plugin.js` (registration) | `__tests__/ord.e2e.test.js` (integration patterns) | `docs/ord.md` (user customization guide).

## 14. When Unsure

Compare behavior using a local `npm test` run; prefer adding a minimal assertion over expanding snapshots; document any new rule in `systemPatterns.md` + update this file if it changes core flow or precedence.

---

Maintain brevity in changes; update Memory Bank artifacts if you introduce or alter architectural decisions, resource precedence, or customization rules.
