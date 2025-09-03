# Technical Context: CAP-JS ORD Plugin

## Technology Stack

### Core Technologies

**Runtime Environment**:

- **Node.js**: Primary runtime environment
- **JavaScript ES2021**: Language standard with modern features
- **CommonJS**: Module system for Node.js compatibility

**CAP Framework Integration**:

- **@sap/cds**: Core CAP framework (>=8.9.4)
- **@sap/cds-dk**: CAP development kit (>=8.9.5)
- **CSN (Core Schema Notation)**: CAP's internal model representation

**Key Dependencies**:

- **@cap-js/openapi**: OpenAPI specification generation (^1.2.1)
- **@cap-js/asyncapi**: AsyncAPI specification generation (^1.0.3)
- **bcryptjs**: Password hashing for authentication (3.0.2)
- **lodash**: Utility library for data manipulation (^4.17.21)
- **cli-progress**: Progress bars for build operations (^3.12.0)

### Development Tools

**Testing Framework**:

- **Jest**: Testing framework (^29.7.0)
- **Snapshot Testing**: For ORD document structure validation
- **Coverage Collection**: Automated test coverage reporting

**Code Quality**:

- **ESLint**: Code linting with recommended rules (^9.2.0)
- **Prettier**: Code formatting (3.5.3)
- **4-space indentation**: Consistent code style

**Build & Development**:

- **Workspaces**: Monorepo structure with `xmpl` and `xmpl_java` examples
- **npm scripts**: Standardized development commands

## Development Environment Setup

### Prerequisites

```bash
# Node.js (LTS version recommended)
node --version  # Should be >= 16.x

# CAP development kit
npm install -g @sap/cds-dk

# Clone with submodules (if using calesi)
git clone --recursive https://github.com/cap-js/calesi.git
```

### Local Development

```bash
# Install dependencies
npm install

# Run example application
cd xmpl/
cds watch

# Run tests
npm test

# Update snapshots after changes
npm run update-snapshot

# Lint code
npm run lint
```

### Build Commands

```bash
# Generate ORD documents and resource files
cds build --for ord

# Compile ORD document only
cds compile srv/ --to ord

# Build with custom output directory
cds compile srv/ --to ord -o ./custom-output/
```

## Technical Constraints

### CAP Framework Dependencies

- **Minimum CAP Version**: 8.9.4 (peer dependency)
- **CSN Compatibility**: Must handle all CAP CSN model structures
- **Plugin Architecture**: Must follow CAP plugin conventions
- **Build Integration**: Must integrate with `cds build` system

### ORD Specification Compliance

- **ORD Version**: Implements ORD specification v1
- **Document Structure**: Must generate valid ORD JSON documents
- **Resource Types**: Support for APIs, Events, Entity Types, Integration Dependencies
- **Authentication**: Must support ORD-compliant authentication mechanisms

### Performance Requirements

- **Large Models**: Handle CAP applications with hundreds of services/entities
- **Build Performance**: Reasonable build times for CI/CD pipelines
- **Memory Usage**: Efficient memory usage during ORD generation
- **Startup Time**: Minimal impact on CAP application startup

### Security Constraints

- **Authentication**: Secure credential handling with bcrypt
- **Environment Variables**: Secure configuration through env vars
- **Metadata Protection**: Configurable access controls for sensitive metadata
- **No Credential Logging**: Prevent credential exposure in logs

## Integration Points

### CAP Framework Integration

**Compiler Integration**:

```javascript
// Registers ORD as compilation target
cds.compile.to.ord(csn);
```

**Build System Integration**:

```javascript
// Registers as build plugin
cds.build.register("ord", OrdBuildPlugin);
```

**Service Integration**:

```cds
// Service definition for runtime API
@rest @path: '/.well-known/open-resource-discovery'
service OpenResourceDiscoveryService {}
```

### External Tool Integration

**OpenAPI Integration**:

- Generates OpenAPI 3.0 specifications for CAP services
- Links ORD API resources to OpenAPI definitions
- Handles CAP-specific annotations and patterns

**AsyncAPI Integration**:

- Generates AsyncAPI specifications for CAP events
- Links ORD event resources to AsyncAPI definitions
- Supports CAP event modeling patterns

**EDMX Integration**:

- Generates OData EDMX metadata for CAP services
- Links ORD API resources to EDMX definitions
- Maintains OData protocol compliance

## Development Patterns

### Code Organization

```
lib/
├── authentication.js    # Authentication middleware
├── build.js            # Build system integration
├── constants.js        # Shared constants
├── defaults.js         # Default values and validation
├── extendOrdWithCustom.js # Custom content integration
├── index.js            # Main export
├── ord.js              # Core ORD generation logic
├── ord-service.cds     # Service definition
├── ord-service.js      # Service implementation
├── templates.js        # Template system
└── utils.js            # Utility functions
```

### Testing Patterns

**Snapshot Testing**:

- Comprehensive ORD document structure validation
- Regression testing for ORD generation changes
- Located in `__tests__/__snapshots__/`

**Unit Testing**:

- Individual function testing in `__tests__/unittest/`
- Mock data in `__tests__/__mocks__/`
- Coverage for all major code paths

**End-to-End Testing**:

- Full ORD generation workflow testing
- Authentication testing
- Build system integration testing

### Configuration Patterns

**Environment-Based Configuration**:

```bash
# Authentication configuration
ORD_AUTH_TYPE=basic
BASIC_AUTH='{"admin":"$2y$05$..."}'
```

**File-Based Configuration**:

```json
// .cdsrc.json
{
    "ord": {
        "namespace": "sap.sample",
        "defaultVisibility": "internal",
        "customOrdContentFile": "./ord/custom.ord.json"
    }
}
```

**Annotation-Based Configuration**:

```cds
annotate ProcessorService with @ORD.Extensions: {
  title: 'Custom Service Title',
  industry: ['Retail']
};
```

## Deployment Considerations

### Production Deployment

- **Authentication**: Always configure authentication for production
- **Performance**: Monitor ORD generation performance in production
- **Caching**: Consider caching strategies for frequently accessed ORD documents
- **Monitoring**: Log ORD endpoint access and generation times

### Development Deployment

- **Hot Reload**: Works with `cds watch` for development
- **Debug Mode**: Supports CAP debug logging
- **Local Testing**: Example applications in `xmpl/` directory
- **IDE Integration**: Works with SAP Business Application Studio and VS Code
