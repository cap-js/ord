# System Patterns: CAP-JS ORD Plugin

## Architecture Overview

The CAP-JS ORD plugin follows a **dual entry point architecture** that serves both static generation and runtime API needs:

```
CAP Application
├── Static Generation Path (cds-plugin.js)
│   ├── CAP Compiler Integration (cds.compile.to.ord)
│   ├── Build System Integration (cds build --for ord)
│   └── File Generation (ORD + Resource Definition Files)
└── Runtime API Path (lib/ord-service.cds + lib/ord-service.js)
    ├── ORD Service Definition
    ├── REST API Endpoints
    └── Authentication Middleware
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
CSN Model → Triage Definitions → Generate Resources → Apply Templates → Create ORD Document
```

**Key Stages**:

1. **CSN Analysis**: `_triageCsnDefinitions()` categorizes services, entities, events
2. **Resource Generation**: Creates API resources, event resources, entity types
3. **Template Application**: `lib/templates.js` applies ORD-compliant formatting
4. **Document Assembly**: Combines all resources into final ORD document

### 3. Configuration Hierarchy Pattern

**Pattern**: Layered configuration with clear precedence
**Implementation**: Multiple configuration sources

```
Priority Order (highest to lowest):
1. Environment Variables (ORD_AUTH_TYPE, BASIC_AUTH)
2. Custom ORD Content Files
3. @ORD.Extensions Annotations
4. CAP Standard Annotations
5. Plugin Defaults
```

**Configuration Sources**:

- `.cdsrc.json` - Global application settings
- `@ORD.Extensions` - Service-level customization
- Custom ORD files - Advanced overrides
- Environment variables - Runtime configuration

### 4. Template System Pattern

**Pattern**: Composable template functions with inheritance
**Implementation**: `lib/templates.js`

```javascript
// Base template creation
const createAPIResourceTemplate = (serviceName, serviceDefinition, appConfig, packageIds, accessStrategies) => {
    return {
        ordId: generateOrdId(serviceName),
        title: _getTitleFromServiceName(serviceName),
        // ... other properties
    };
};

// Template enhancement through extensions
function _handleVisibility(ordExtensions, definition, defaultVisibility) {
    // Applies visibility rules with fallbacks
}
```

**Benefits**:

- Consistent ORD document structure
- Easy customization through extensions
- Reusable template components

### 5. Authentication Middleware Pattern

**Pattern**: Pluggable authentication with multiple strategies
**Implementation**: `lib/authentication.js`

```javascript
async function authenticate(req, res, next) {
    const authConfig = getAuthConfig();
    const authTypes = authConfig.accessStrategies.map(s => s.type);

    if (authTypes.includes("open")) {
        return next();
    }

    if (authTypes.includes("basic")) {
        return await handleBasicAuth(req, res, next);
    }

    // Future: UCL-mTLS support
}
```

**Supported Strategies**:

- **Open**: No authentication required
- **Basic**: Username/password with bcrypt hashing
- **Future**: UCL-mTLS for enterprise scenarios

### 6. Test Helper Pattern

**Pattern**: Centralized test utility functions for consistent mocking
**Implementation**: `__tests__/unit/utils/test-helpers.js`

```javascript
// Reusable authentication mock setup
function setupAuthMocks(authType = 'open') {
    const mockAuthConfig = mockCreateAuthConfig(authType);
    mockAuthenticationService(mockAuthConfig);
    mockCdsContext();
    return mockAuthConfig;
}

// Configurable authentication configurations
function mockCreateAuthConfig(type) {
    const configs = {
        open: { accessStrategies: [{ type: 'open' }] },
        basic: { accessStrategies: [{ type: 'basic' }] },
        mtls: { accessStrategies: [{ type: 'mtls' }] }
    };
    return configs[type] || configs.open;
}
```

**Benefits**:

- Eliminates code duplication across test files
- Ensures consistent mock configurations
- Simplifies test setup and maintenance
- Provides reusable patterns for future tests

## Component Relationships

### Core Components

1. **Entry Points**

    - `cds-plugin.js`: Framework integration
    - `lib/ord-service.cds`: Service definition

2. **Processing Engine**

    - `lib/ord.js`: Main ORD generation logic
    - `lib/templates.js`: Template system
    - `lib/defaults.js`: Default values and validation

3. **Support Systems**

    - `lib/authentication.js`: Security layer
    - `lib/build.js`: Build system integration
    - `lib/utils.js`: Utility functions

4. **Extension Points**
    - `lib/extendOrdWithCustom.js`: Custom content integration
    - `lib/metaData.js`: Metadata processing

### Data Flow Architecture

```
CAP CSN Model
    ↓
CSN Analysis & Triage
    ↓
Resource Generation
    ├── API Resources
    ├── Event Resources
    ├── Entity Types
    └── Integration Dependencies
    ↓
Template Application
    ↓
Configuration Overlay
    ├── Global Config (.cdsrc.json)
    ├── Annotations (@ORD.Extensions)
    └── Custom Content Files
    ↓
ORD Document Assembly
    ↓
Output Generation
    ├── Static Files (build)
    └── Runtime API (service)
```

## Critical Implementation Paths

### 1. ORD Document Generation Path

**Trigger**: `cds.compile.to.ord(csn)` or build command
**Flow**:

1. Initialize app configuration from multiple sources
2. Analyze CSN to identify services, entities, events
3. Generate resource templates for each identified component
4. Apply configuration overlays and customizations
5. Assemble final ORD document with proper structure
6. Validate ORD compliance and generate output

### 2. Runtime API Path

**Trigger**: HTTP request to ORD endpoints
**Flow**:

1. Authentication middleware validates request
2. Service handler generates ORD document on-demand
3. Response formatting and caching (if applicable)
4. Return ORD-compliant JSON response

### 3. Build Integration Path

**Trigger**: `cds build --for ord`
**Flow**:

1. Build plugin initialization
2. ORD document generation
3. Resource definition file generation (OpenAPI, EDMX, etc.)
4. File system output with proper directory structure
5. Progress reporting and error handling

## Key Design Decisions

### 1. Dual Entry Point Architecture

**Decision**: Support both static and runtime access patterns
**Rationale**: Different use cases require different access patterns
**Trade-offs**: Increased complexity but better flexibility

### 2. Template-Based Generation

**Decision**: Use composable templates rather than direct object construction
**Rationale**: Easier customization and maintenance
**Trade-offs**: Slight performance overhead for better maintainability

### 3. Configuration Hierarchy

**Decision**: Multiple configuration sources with clear precedence
**Rationale**: Supports different customization needs and deployment scenarios
**Trade-offs**: Complex configuration resolution but maximum flexibility

### 4. CSN-First Approach

**Decision**: Generate ORD documents directly from CAP CSN models
**Rationale**: Ensures consistency with CAP application structure
**Trade-offs**: Tight coupling to CAP but perfect alignment with framework

### 5. Pluggable Authentication

**Decision**: Support multiple authentication strategies
**Rationale**: Different deployment environments have different security requirements
**Trade-offs**: More complex authentication logic but broader applicability
