# System Patterns: CAP-JS ORD Plugin

## Architecture Overview

The CAP-JS ORD plugin follows a **dual entry point architecture** that serves both static generation and runtime API needs:

```
CAP Application
├── Static Generation Path (cds-plugin.js)
│   ├── CAP Compiler Integration (cds.compile.to.ord)
│   ├── Build System Integration (cds build --for ord)
│   └── Parallel File Generation (ORD + Resource Definition Files via lib/threads/)
└── Runtime API Path (lib/services/ord-service.cds + lib/services/ord-service.js)
    ├── ORD Service Definition
    ├── REST API Endpoints
    └── Authentication Middleware (multi-strategy)
```

## Core Design Patterns

### 1. Plugin Registration Pattern

**Pattern**: Lazy registration with CAP framework integration
**Implementation**: `cds-plugin.js`

```javascript
// Registers build target
if (cds.cli.command === "build") {
    cds.build?.register?.("ord", require("./lib/build"));
}

// Registers compiler target with lazy loading
Object.defineProperty(cds.compile.to, "ord", {
    get: _lazyRegisterCompileTarget,
    configurable: true,
});
```

**Benefits**:

- Minimal startup overhead
- Clean separation of concerns
- Standard CAP plugin patterns

### 2. CSN Processing Pipeline

**Pattern**: Multi-stage transformation pipeline
**Implementation**: `lib/ord.js`

```
CSN Model → _propagateORDVisibility → Triage Definitions → Generate Resources → Apply Templates → Custom Merge → Filter Unused Packages → ORD Document
```

**Key Stages**:

1. **Visibility Propagation**: `_propagateORDVisibility()` cascades service visibility to children.
2. **CSN Analysis**: `_triageCsnDefinitions()` categorizes services, entities, events, actions/functions.
3. **Resource Generation**: Creates API resources, event resources, entity types, integration dependencies.
4. **Template Application**: `lib/templates.js` applies ORD-compliant formatting.
5. **Custom Merge**: `extendCustomORDContentIfExists()` overlays `custom.ord.json` by `ordId`.
6. **Package Pruning**: `_filterUnusedPackages()` removes packages not referenced by any resource.

### 3. Protocol Resolution Pattern

**Pattern**: Dedicated resolution module with explicit rules
**Implementation**: `lib/protocol-resolver.js`

```javascript
// Resolution priority:
// 1. Primary data product → SAP_DATA_SUBSCRIPTION (early return)
// 2. CAP endpoints → mapped via CAP_TO_ORD_PROTOCOL_MAP
// 3. Explicit @protocol annotation → may add ORD-only protocols (INA)
// Rule A: explicit + no CAP endpoints → no fallback to OData
// Rule B: no explicit, no CAP endpoints → fallback to OData v4
// Rule C: never produce [null] in entryPoints
```

**Supported Protocols**:

- `odata-v4` (default fallback), `odata-v2`
- `rest` (OpenAPI only, no EDMX)
- `graphql` (GraphQL SDL, text/plain media type)
- `mcp` (MCP resource definition type)
- `sap:data-subscription-api:v1` (data products, CSN only)
- INA (ORD-only, no resource definitions)

**Benefits**:

- Single responsibility; testable in isolation
- Explicit rules prevent silent fallback surprises
- `PLUGIN_UNSUPPORTED_PROTOCOLS` warns rather than silently skips

### 4. Configuration Hierarchy Pattern

**Pattern**: Layered configuration with clear precedence
**Implementation**: Multiple configuration sources

```
Priority Order (highest to lowest):
1. Environment Variables (BASIC_AUTH, CF_MTLS_TRUSTED_CERTS, ORD_AUTH_TYPE)
2. Custom ORD Content Files (customOrdContentFile, merged by ordId)
3. @ORD.Extensions Annotations (service-level overrides)
4. CAP Standard Annotations (@title, @Core.Description, etc.)
5. Plugin Defaults (lib/defaults.js)
```

### 5. Template System Pattern

**Pattern**: Composable template functions with ORD extension overlay
**Implementation**: `lib/templates.js`

```javascript
const createAPIResourceTemplate = (serviceName, serviceDefinition, appConfig, packageIds, accessStrategies) => {
    const ordExtensions = readORDExtensions(serviceDefinition); // reads @ORD.Extensions.*
    const visibility = _handleVisibility(ordExtensions, serviceDefinition, appConfig.env?.defaultVisibility);
    const protocolResults = resolveApiResourceProtocol(serviceName, serviceDefinition, options);
    // build one resource object per protocol result
    // spread ordExtensions last to allow annotation overrides
    return apiResources;
};
```

**Visibility Cascade**:

```
isPrimaryDataProduct → "internal"
  else: ordExtensions.visibility
  else: @ORD.Extensions.visibility annotation
  else: implementationStandard override → "public"
  else: configured defaultVisibility
  else: "public"
```

### 6. Authentication Middleware Pattern

**Pattern**: Strategy registry with lazy initialization
**Implementation**: `lib/auth/authentication.js`

```javascript
const AUTH_STRATEGIES = {
    [AUTHENTICATION_TYPE.Basic]: basicAuthStrategy, // bcrypt compare
    [AUTHENTICATION_TYPE.CfMtls]: cfMtlsAuthStrategy, // lazy-init CF mTLS validator
    [AUTHENTICATION_TYPE.Open]: openAuthStrategy, // always success
};

function createAuthMiddleware(authConfig) {
    return async function authenticate(req, res, next) {
        // tries each strategy in authConfig.types order
        // first success → next()
        // all fail → 401
    };
}
```

**Key design choices**:

- `createAuthConfig()` detects Basic and CF mTLS from env vars or `.cdsrc.json`, stores in `authConfig.types[]`.
- CF mTLS validator is lazily initialized on the first mTLS request via a cached Promise.
- `getAccessStrategiesFromAuthConfig()` (centralized in `lib/access-strategies.js`) maps auth types to ORD access strategy objects.
- Open auth is automatically included/excluded based on whether secure methods are configured.

### 7. Parallel Build Pattern

**Pattern**: Worker thread pool for I/O-bound file generation
**Implementation**: `lib/threads/`, orchestrated by `lib/build.js`

```
Build Plugin
    ↓
ORD Document Generation (main thread)
    ↓
Parallel Resource File Generation (worker threads)
    ├── OpenAPI spec files
    ├── EDMX metadata files
    ├── AsyncAPI spec files
    └── CSN interop files
    ↓
Progress Reporting + Error Aggregation
```

### 8. Runtime API Service Pattern

**Pattern**: `cds.ApplicationService` subclass registering Express routes directly
**Implementation**: `lib/services/ord-service.js`

```
OpenResourceDiscoveryService.init()
    ├── createAuthConfig()          → fail-closed on config errors
    ├── createAuthMiddleware(cfg)   → closure-based Express middleware (open/basic/cf-mtls)
    ├── GET this.path               → well-known discovery JSON (unauthenticated)
    ├── GET /ord/v1/documents/ord-document  → full ORD document (authenticated)
    ├── GET /ord/v1/documents/:id   → 404 placeholder (unimplemented)
    └── GET /ord/v1[/:ordId[/:service]]     → spec files (OAS3/EDMX/CSN/MCP) via compileMetadata()
```

**Key implementation notes**:

- `authMiddleware` factory is called **once** in `init()` and reused across all protected routes (no per-request overhead).
- Three explicit metadata routes replace a single optional-param route for `path-to-regexp` v8 compatibility (CDS 9.7.0+).
- `compileMetadata(req.url)` delegates spec compilation to `lib/meta-data.js` which dispatches by file extension (`.oas3.json`, `.edmx`, `.csn.json`, `.mcp.json`).
- ⚠️ Known issues: (1) `ord(csn)` call is unguarded — an unhandled exception causes an unlogged 500; (2) `/ord/v1/documents/:id` is an unimplemented placeholder; (3) `/ord/v1` prefix is hard-coded rather than derived from `this.path`.

### 9. Test Helper Pattern

**Pattern**: Centralized test utility functions for consistent mocking
**Implementation**: `__tests__/unit/utils/test-helpers.js`

```javascript
function mockCreateAuthConfig(authentication, authConfig = createOpenAuthConfig()) {
    return jest.spyOn(authentication, "createAuthConfig").mockReturnValue(authConfig);
}
function setupAuthMocks(mocks, authType = "open") { ... }
```

**Benefits**:

- DRY: single place to update when auth architecture changes.
- Returns Jest spies for post-assertion in tests.
- `createOpenAuthConfig()`, `createBasicAuthConfig()`, `createCfMtlsAuthConfig()` cover common cases.

### 9. Extension Registry Pattern

**Pattern**: Plugin-to-plugin communication via provider registration
**Implementation**: `lib/extensionRegistry.js`

```javascript
// External plugin (e.g., @cap-js/event-broker) registers provider at startup:
const ord = require("@cap-js/ord");
ord.registerIntegrationDependencyProvider(() => ({
    eventResources: [
        {
            ordId: "sap.s4:eventResource:CE_SALESORDEREVENTS:v1",
            events: ["sap.s4.beh.salesorder.v1.SalesOrder.Changed.v1"],
        },
    ],
}));
```

**Design**:

- Providers are functions returning `{ eventResources: [{ ordId, events }] }` or `null`.
- ORD plugin builds the final ORD `subset` structure from provider data.
- Providers are called during ORD document generation (runtime only).
- Provider errors are logged but don't break ORD generation.

**Integration**:

- `integrationDependency.js#createEventIntegrationDependency()` collects data from all providers.
- Exported via `cds-plugin.js` as `module.exports.registerIntegrationDependencyProvider`.
- Follows Java plugin pattern (Spring DI `OrdIntegrationDependencyProvider` beans).

## Component Relationships

### Core Components

1. **Entry Points**
    - `cds-plugin.js`: Framework integration (lazy registration)
    - `lib/services/ord-service.cds`: Runtime service definition (`@rest @path: '/.well-known/open-resource-discovery'`)
    - `lib/services/ord-service.js`: `OpenResourceDiscoveryService` – registers Express routes, wires `authMiddleware`, serves ORD document and metadata specs

2. **Processing Engine**
    - `lib/ord.js`: Main ORD generation orchestrator
    - `lib/templates.js`: All resource template builders
    - `lib/protocol-resolver.js`: CAP → ORD protocol mapping
    - `lib/defaults.js`: Default values and package generation

3. **Support Systems**
    - `lib/auth/authentication.js`: Multi-strategy auth middleware factory
    - `lib/auth/cf-mtls.js`: CF mTLS validator (lazy-loaded)
    - `lib/auth/mtls-endpoint-service.js`: mTLS endpoint service helper
    - `lib/access-strategies.js`: Centralized ORD access strategy mapping
    - `lib/build.js`: Build system integration (parallel)
    - `lib/threads/`: Worker thread implementation
    - `lib/utils.js`: Utility functions

4. **Extension Points**
    - `lib/extend-ord-with-custom.js`: Custom content merge by `ordId`
    - `lib/extension-registry.js`: Provider registration for Integration Dependencies
    - `lib/integration-dependency.js`: IntegrationDependency generation
    - `lib/interop-csn.js`: Interop CSN export
    - `lib/meta-data.js`: Metadata / spec compilation (OAS3, EDMX, CSN, MCP, AsyncAPI)

### Data Flow Architecture

```
CAP CSN Model
    ↓
_propagateORDVisibility (linked CSN)
    ↓
CSN Analysis & Triage (_triageCsnDefinitions)
    ↓
Resource Generation
    ├── API Resources (protocol-resolver → templates)
    ├── Event Resources (templates)
    ├── Entity Types (templates)
    └── Integration Dependencies (integrationDependency)
    ↓
ORD Document Assembly (createDefaultORDDocument)
    ↓
Custom Content Overlay (extendCustomORDContentIfExists)
    ↓
Package Pruning (_filterUnusedPackages)
    ↓
Output Generation
    ├── Static Files (parallel worker threads)
    └── Runtime API (ord-service.js)
```

## Critical Implementation Paths

### 1. ORD Document Generation Path

**Trigger**: `cds.compile.to.ord(csn)` or build command
**Flow**:

1. Link CSN and propagate visibility annotations.
2. Initialize app config (package.json, namespace, triage).
3. Create auth config (fail-closed on errors).
4. Assemble ORD document (groups, packages, products).
5. Generate entity types, API resources, event resources, integration dependencies.
6. Merge custom ORD content by `ordId`.
7. Filter unused packages.
8. Return complete ORD document.

### 2. Runtime API Path

**Trigger**: HTTP request to ORD endpoints
**Flow**:

1. `createAuthMiddleware(authConfig)` validates request (Basic / CF mTLS / Open).
2. Service handler generates ORD document on-demand.
3. Return ORD-compliant JSON response.

### 3. Build Integration Path

**Trigger**: `cds build --for ord`
**Flow**:

1. Build plugin initialization (registers via `cds.build.register`).
2. ORD document generation.
3. Parallel resource definition file generation (OpenAPI, EDMX, AsyncAPI, CSN interop).
4. Progress reporting and `BuildError` propagation on failures.

## Key Design Decisions

### 1. Dual Entry Point Architecture

**Decision**: Support both static and runtime access patterns.
**Rationale**: Different use cases require different access patterns.
**Trade-offs**: Increased complexity but better flexibility.

### 2. Protocol Resolution as Separate Module

**Decision**: Extracted `resolveApiResourceProtocol` into `lib/protocol-resolver.js`.
**Rationale**: Protocol logic was growing (OData, REST, GraphQL, MCP, INA) and needed clear rules (A/B/C) with isolated testability.
**Trade-offs**: One more module, but much easier to add new protocols.

### 3. Lazy CF mTLS Initialization

**Decision**: CF mTLS validator is initialized on first use, not at startup.
**Rationale**: Avoids blocking service startup for users not using mTLS.
**Trade-offs**: First mTLS request has extra latency; Promise caching prevents duplicate initialization.

### 4. Parallel Build via Worker Threads

**Decision**: Resource file generation is parallelized using Node.js worker threads.
**Rationale**: Build time for large CAP applications was unacceptable with sequential file I/O.
**Trade-offs**: Thread lifecycle complexity; error aggregation must be explicit.

### 5. Custom Merge by `ordId`

**Decision**: Custom ORD content is merged by matching `ordId` keys, not by array index.
**Rationale**: Index-based merge is fragile when generated resource counts change.
**Trade-offs**: Requires every custom resource to declare an `ordId`; null values act as deletion markers.

### 6. CSN-First Approach

**Decision**: Generate ORD documents directly from CAP CSN models.
**Rationale**: Ensures consistency with CAP application structure.
**Trade-offs**: Tight coupling to CAP but perfect alignment with framework.
