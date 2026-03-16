# Active Context: CAP-JS ORD Plugin

## Current Work Focus

### Recent Development Activity

**Code Review – Core Library (March 17, 2026)**:

A detailed code review of `lib/ord.js`, `lib/templates.js`, `lib/extendOrdWithCustom.js`, `lib/defaults.js`, and `lib/auth/authentication.js` surfaced the following issues to address:

- 🔴 **`cleanNullProperties` creates sparse arrays**: `delete arr[idx]` on null array entries leaves holes instead of removing them. Arrays need special handling before the null-delete loop.
- 🔴 **`_propagateORDVisibility` iterates `model.definitions` as an array**: Uses `for...of` on a CAP linked-model proxy and accesses `.name` on children. Should use `Object.entries()`.
- 🔴 **`typeof [] === "array"` dead branch**: In `extendOrdWithCustom.js`, the `=== "array"` check on `typeof` can never match; the array branch is dead code.
- 🟠 **Duplicate blocked-service-name guard** in `_triageCsnDefinitions` loop (already handled by `_isValidService`).
- 🟠 **`require()` caches the custom ORD file**: Runtime changes silently ignored. Should use `JSON.parse(fs.readFileSync(...))`.
- 🟠 **`...(exposedEntityTypes ? { exposedEntityTypes } : [])` spreads array into object** – no-op; should be `{}`.
- 🟠 **Double-negation**: `_shouldNotSkipIfServiceProtocolIsNone` → rename to `_isProtocolEnabled`.
- 🟡 **`_.assignWith` used without customiser** – equivalent to `_.assign`, misleading.
- 🟡 **`Array.includes` in `_flattenEntityGraph`** – O(n); replace with `Set.has`.
- 🟡 **`_getProducts` silently mutates `appConfig`** – implicit coupling.
- 🟡 **`_getPackageID` unreachable branch** – `resourceType` is falsy but used in template literal.

**v1.5.0 (March 11, 2026)**:

- **Parallel Resource File Generation**: Enabled concurrent file generation for improved build performance (`lib/threads/`).
- **MCP Migration Fix**: Fixed MCP API resource generation and `customType` handling.
- **Interop CSN Cleanup**: Removed all unknown properties from the `meta` section in interop CSN.
- **Simplified File Generation Logic**: Refactored build file output code for clarity.
- **Dependency Update**: CDS services updated to v4.8.0.

**v1.4.5 (March 3, 2026)**:

- **GraphQL Protocol Support**: Added `graphql-sdl` resource definition type; `graphql` mapped in `CAP_TO_ORD_PROTOCOL_MAP`.
- **Auto IntegrationDependencies for Consumed Data Products**: `getIntegrationDependencies()` now auto-generates entries for consumed data products.
- **INA Protocol Support**: Added INA as an ORD-only protocol (no resource definitions).
- **Multi-Protocol Service Detection**: Fixed detection of services exposing multiple protocols simultaneously.
- **Error Message Improvement**: Service name now included in protocol-resolver error messages.
- **path-to-regexp v8 Compatibility**: Fixed compatibility issue with CDS 9.7.0.
- **Interop CSN**: Removed `@assert.unique` annotations.
- **ESLint**: Updated to v10.

**v1.4.4 (February 5, 2026)**:

- **INA Protocol**: Support for INA protocol and prevention of null `entryPoints`.
- **CDS Compiler Lock**: Locked cds-compiler to 6.6.2 via npm overrides.

**v1.4.3 (January 29, 2026)**:

- **@OpenAPI.servers Annotation**: Support for service-level server URLs via `@OpenAPI.servers`.
- **BuildError Propagation**: `cds build` now terminates properly on ORD errors.
- **CF mTLS Documentation**: Finalized CF mTLS configuration documentation.

**v1.4.2 (January 14, 2026)**:

- **Data Product API Protocol Fix**: Corrected `apiProtocol` assignment for primary data product services.

**v1.4.1 (January 9, 2026)**:

- **Build Plugin Dependency Fix**: Switched from `@sap/cds-dk` to `@sap/cds` for the build plugin.

**v1.4.0 (December 19, 2025)**:

- **CF mTLS Authentication**: Full CF mTLS support with lazy-initialized validator and dedicated test suite.
- **Legacy Logger Removal**: Removed old logger and legacy logic.
- **MCP API Resource Generation**: Conditional generation when MCP plugin is detected (`isMCPPluginAvailable()`).
- **Custom Compiler Options**: Allow passing custom compiler options to OpenAPI / AsyncAPI plugins.
- **MCP `customType`**: Added `customType` field to MCP API resources.
- **cds.context Auth Fix**: Fixed `cds.context` being overwritten during auth config resolution.
- **OData in Data Products Fix**: Corrected OData handling for data product services.

**Test Code Refactoring – Clean Code (December 15, 2025)**:

- Created `__tests__/unit/utils/test-helpers.js` with reusable helpers: `mockCdsContext()`, `mockAuthenticationService()`, `mockCreateAuthConfig()`, `setupAuthMocks()`.
- Refactored 5 test files to use helpers; eliminated 10+ instances of repeated mock configurations.
- All 357 tests pass (356 passed, 1 skipped).

### Current Development Priorities (March 2026)

1. **Code Review Remediation**: Address high- and medium-priority findings from March 2026 code review (see above).
2. **Build Performance**: Parallel file generation (v1.5.0) — monitor for regressions in large models.
3. **Protocol Coverage**: GraphQL, INA, MCP, multi-protocol — ensure test coverage is comprehensive.
4. **Interop CSN Stability**: Continued cleanup (unknown `meta` properties, `@assert.unique` removed).
5. **Authentication Hardening**: CF mTLS stabilization and documentation.
6. **Java Runtime Parity**: Achieving full feature parity between Node.js and Java implementations.
7. **Dependency Currency**: Renovate keeping CDS services, Spring Boot, and toolchain up to date.
8. **ORD Specification Compliance**: Tracking any updates beyond v1.12.

## Active Decisions and Considerations

### Architecture Decisions

**Protocol Resolution – Dedicated Module (`lib/protocol-resolver.js`)**:

- Extracted from `templates.js` into its own module.
- Three resolution rules:
    - **Rule A**: Explicit protocol + empty CAP endpoints → do NOT fall back to OData.
    - **Rule B**: No explicit protocol + no CAP endpoint → fall back to OData v4.
    - **Rule C**: Never produce `[null]` in `entryPoints`.
- `ORD_ONLY_PROTOCOLS` map handles protocols like INA that have no CAP endpoint concept.
- `PLUGIN_UNSUPPORTED_PROTOCOLS` emits a warning for protocols ORD knows but the plugin cannot generate specs for yet.

**Authentication System (multi-strategy middleware)**:

- `createAuthConfig()` detects Basic and CF mTLS independently; types stored in `authConfig.types[]`.
- CF mTLS validator is **lazily initialized** on first mTLS request to avoid blocking service startup.
- `AUTH_STRATEGIES` registry maps `AUTHENTICATION_TYPE` keys to async handler functions.
- `createAuthMiddleware(authConfig)` factory produces a per-config Express middleware via closure.
- Access strategies for the ORD document are derived via `getAccessStrategiesFromAuthConfig()` (centralized in `lib/access-strategies.js`).

**Parallel Build (v1.5.0)**:

- Resource file generation (OpenAPI, EDMX, CSN) now runs concurrently using worker threads (`lib/threads/`).
- Main build orchestration in `lib/build.js` manages thread lifecycle.

**Custom ORD Content Merge**:

- `extendCustomORDContentIfExists()` in `lib/extendOrdWithCustom.js` merges by `ordId`.
- `patchGeneratedOrdResources()` uses `_.assign` (structuredClone) to overlay custom properties.
- Null properties in custom content delete the corresponding generated property.
- ⚠️ Known issue: `require()` caches the custom file — to be replaced with `JSON.parse(fs.readFileSync(...))`.

**MCP Resource**:

- Inserted conditionally if `isMCPPluginAvailable()` returns true.
- Template in `templates.js#createMCPAPIResourceTemplate`.
- `customType` field required; `apiProtocol` and `resourceDefinitions` are preserved during custom merge.

**Dual Entry Point**:

- Static: `cds build --for ord` / `cds.compile.to.ord(csn)` writes `gen/ord/*`.
- Runtime: `OpenResourceDiscoveryService` serves live ORD JSON.

### Configuration Strategy

```
Environment Variables > Custom ORD Content File > @ORD.Extensions Annotations > .cdsrc.json > Plugin Defaults
```

- `ORD_AUTH_TYPE`, `BASIC_AUTH`, `CF_MTLS_TRUSTED_CERTS` — runtime overrides.
- `.cdsrc.json` `ord` section — application defaults.
- `authenticateMetadataEndpoints` defaults to `false`.

## Important Patterns and Preferences

### Code Organization Patterns

**Modular Architecture**:

```
lib/
├── auth/
│   ├── authentication.js   # Multi-strategy middleware factory
│   └── cf-mtls.js          # CF mTLS validator (lazy-loaded)
├── services/
│   ├── ord-service.cds     # Service definition
│   └── ord-service.js      # Service implementation
├── threads/                # Worker threads for parallel build
├── access-strategies.js    # ORD access strategy mapping (centralized)
├── build.js                # Build system integration
├── constants.js            # Shared constants (Object.freeze)
├── date.js                 # RFC3339 date helper
├── defaults.js             # Default values and package generation
├── extendOrdWithCustom.js  # Custom content merge by ordId
├── index.js                # Public export
├── integrationDependency.js# IntegrationDependency generation
├── interopCsn.js           # Interop CSN export
├── logger.js               # Logger abstraction
├── metaData.js             # Metadata processing
├── ord.js                  # Core ORD generation orchestrator
├── protocol-resolver.js    # CAP→ORD protocol resolution
├── templates.js            # All resource template builders
└── utils.js                # Utility functions
```

**Version Suffix Handling Pattern**:

- Strict regex: `/\.v(\d+)$/` — rejects patterns like `.v1.1`, `.v1.0`, `.beta`.
- Scoped to primary data products only.
- Creates a temporary clean service definition for namespace processing.

**Interop CSN Generation**:

- Removes "localized" associations.
- Removes `@assert.unique` annotations.
- Removes unknown properties from `meta` section.
- Uses "-" as separator for i18n language keys.

**Testing Strategy**:

- Snapshot tests in `__tests__/unit/__snapshots__/` for stable structure validation.
- Focused field assertions in `ord.e2e.test.js` for dynamic/custom merge scenarios.
- `__tests__/unit/utils/test-helpers.js` for reusable auth mock helpers.
- Integration tests in `__tests__/integration/` (basic-auth, mTLS, cds-build).
- Do NOT add snapshot assertions for mutable counts (API/Event resources grow with model).

### Development Preferences

**Code Style**:

- 4-space indentation.
- ESLint v10 recommended rules.
- Constants in `SCREAMING_SNAKE_CASE` with `Object.freeze()`.
- Files in kebab-case, functions in camelCase.

**Error Handling**:

- `createAuthConfig()` returns `{ error: string }` on config failures; callers throw.
- Build errors use `BuildError` to properly terminate `cds build`.
- Graceful degradation (warn + fallback) for non-critical issues (e.g., unsupported protocol).

## Key Learnings

**Protocol Resolution Complexity**:

- CAP services can expose multiple protocols simultaneously (multi-protocol fix in v1.4.5).
- Explicit `@protocol` annotation is the authoritative source; CAP endpoints are secondary.
- ORD-only protocols (INA) have no CAP endpoint concept and must be handled separately.

**Authentication Layering**:

- Basic auth and CF mTLS can coexist; strategies are tried in order.
- CF mTLS lazy initialization avoids blocking startup for non-mTLS users.
- `bcryptjs` `$2y` prefix must be normalized to `$2a` for comparison.

**Custom Merge Edge Cases**:

- `null` values in custom ORD content act as deletion markers — correct but must be preserved through array handling.
- `require()` caching of the custom file is a known footgun in watch mode.

**Build Performance**:

- Parallel file generation (v1.5.0) significantly reduces build time for large models.
- Worker thread lifecycle must be carefully managed to avoid leaks.

## Next Steps and Considerations

### Immediate Priorities

- Fix high-priority code review issues: `cleanNullProperties` array handling, `_propagateORDVisibility` object iteration, `typeof "array"` dead branch in `extendOrdWithCustom`.
- Replace `require(pathToCustomORDContent)` with `JSON.parse(fs.readFileSync(...))` to fix caching.
- Fix `...(exposedEntityTypes ? { exposedEntityTypes } : [])` spread-into-object typo.
- Rename `_shouldNotSkipIfServiceProtocolIsNone` → `_isProtocolEnabled`.
- Monitor parallel build stability for large CAP applications.
- Track ORD specification updates beyond v1.12.

### Recently Completed

- ✅ v1.5.0: Parallel resource file generation, MCP migration fix, interop CSN meta cleanup
- ✅ v1.4.5: GraphQL support, auto IntegrationDependencies, INA protocol, multi-protocol detection
- ✅ v1.4.4: INA protocol null entryPoints fix, cds-compiler lock
- ✅ v1.4.3: @OpenAPI.servers support, BuildError propagation, CF mTLS docs
- ✅ v1.4.2: Data product apiProtocol fix
- ✅ v1.4.1: Build plugin dependency fix (@sap/cds instead of @sap/cds-dk)
- ✅ v1.4.0: CF mTLS auth, MCP API resources, custom compiler options, legacy logger removal
- ✅ Test helper utility module for reusable auth mocks
- ✅ Authentication multi-strategy middleware with CF mTLS lazy loading
- ✅ Interop CSN: removed localized associations, @assert.unique, unknown meta properties

## Current Challenges

- **Code Quality**: Several correctness and maintainability issues identified in code review need addressing.
- **Test Suite Maintenance**: Growing feature surface (GraphQL, MCP, INA, multi-protocol) requires test coverage expansion.
- **Build Parallelism**: Worker thread errors in parallel build must not silently swallow file generation failures.
- **Custom File Caching**: `require()` caching of custom ORD JSON is a developer experience issue in watch mode.
- **Java Runtime Parity**: Ensuring all Node.js features (GraphQL, MCP, parallel build) are available in Java runtime.
- **ORD Specification Evolution**: Staying current as ORD spec evolves past v1.12.