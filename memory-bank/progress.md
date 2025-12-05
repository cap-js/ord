# Progress: CAP-JS ORD Plugin

## What Works

### Core Functionality ✅

**ORD Document Generation**:

- Complete ORD document generation from CAP CSN models
- Support for all major ORD resource types (APIs, Events, Entity Types)
- ORD specification v1 compliance
- Proper ORD ID generation and namespace handling

**Dual Entry Point Architecture**:

- Static file generation via `cds build --for ord`
- Runtime API endpoints (`/.well-known/open-resource-discovery`, `/ord/v1/documents/ord-document`)
- CAP compiler integration (`cds.compile.to.ord`)
- Build system integration with resource file generation

**Authentication System**:

- Open access mode for development
- Basic authentication with bcrypt password hashing
- Environment variable configuration (`ORD_AUTH_TYPE`, `BASIC_AUTH`)
- Secure credential handling and validation

**Customization Framework**:

- Global configuration via `.cdsrc.json`
- Service-level customization with `@ORD.Extensions` annotations
- Custom ORD content file integration
- Configuration hierarchy with proper precedence

### Resource Generation ✅

**API Resources**:

- OpenAPI 3.0 specification generation
- OData EDMX metadata generation
- Proper API resource templates with all required ORD properties
- Service visibility handling (public, internal, private)
- Special handling for APIs for data products, with e.g. CSN metadata resource definition generation

**Event Resources**:

- AsyncAPI specification generation
- Event resource templates with proper ORD structure
- CAP event model integration
- Event visibility and access control

**Entity Types**:

- Entity type extraction from CAP models
- Entity relationship mapping
- Proper ORD entity type structure
- Entity visibility controls

### Build System Integration ✅

**File Generation**:

- ORD document JSON file output
- OpenAPI specification files
- AsyncAPI specification files
- EDMX metadata files
- Proper directory structure creation

**Build Performance**:

- Progress reporting for long-running operations
- Efficient file I/O operations
- Parallel resource file generation
- Memory-efficient processing

### Testing Infrastructure ✅

**Comprehensive Test Suite**:

- Jest testing framework with full coverage
- Snapshot testing for ORD document structure validation
- Unit tests for individual components
- End-to-end testing for complete workflows
- Mock data for various CAP application scenarios

**Test Categories**:

- Authentication testing
- Build system testing
- Template generation testing
- Configuration hierarchy testing
- Error handling testing

## Current Status

### Recently Completed (v1.3.14 - November 18, 2025) ✅

**Interop CSN Enhancement**:

- Removed association "localized" from interop CSN generation
- Improved CSN compatibility with downstream tools
- Enhanced trusted publishing with provenance support
- Updated supertest dependency to v7

### Recently Completed (v1.3.13 - November 12, 2025) ✅

**Authentication & Security**:

- Switched access strategy to basic-auth for consistent security
- Set `authenticateMetadataEndpoints` to false by default
- Limited support to Node.js version 22 only
- Updated ORD specification support to v1.12
- Added dedicated authentication test files

### Recently Completed (v1.3.12 - October 16, 2025) ✅

**Interop CSN i18n**:

- Fixed language key separator in interop CSN (now uses "-" instead of "\_")
- Improved i18n handling for better compatibility
- Updated dependencies (jacoco-maven-plugin, actions/setup-node)

### Recently Completed (v1.3.11 - October 10, 2025) ✅

**Interop CSN Production**:

- Introduced comprehensive interop CSN generation
- Fixed Java authentication issues
- Fixed missing local entity exposure
- Updated CDS services to v4.4.1

### Recently Completed (v1.3.10 - September 26, 2025) ✅

**Major Feature Release**:

- Dual annotation support for data products (`@data.product` and `@DataIntegration.dataProduct.type`)
- Version suffix handling for clean ORD ID generation
- Custom build destination support
- Vipe coding workflow support
- Major dependency updates (Node v22, Express v5, Jest v30)
- Renovate bot integration for automated dependency management

### Stable Features ✅

**Core Plugin Architecture**:

- CAP plugin registration and lifecycle management
- Lazy loading of dependencies
- Clean separation of concerns
- Modular code organization

**Template System**:

- Composable template functions
- Template inheritance and customization
- Consistent ORD document structure
- Reusable template components

**Configuration Management**:

- Multi-source configuration resolution
- Environment variable prioritization
- Annotation-based customization
- Custom content file processing

## What's Left to Build

### Recently Completed (September 18, 2025) ✅

**MCP API exposure**:

- ✅ **MCP API exposure**: Implemented conditional MCP API resource generation based on internal CAP MCP plugin availability
- ✅ **Comprehensive MCP Testing**: Added thorough MCP integration tests covering both plugin available/unavailable scenarios
- ✅ **Backward Compatibility**: Maintained all existing functionality and preserved test coverage (96%+)

### Previously Completed (September 26, 2025) ✅

### Completed Features Summary ✅

**Interop CSN (v1.3.11-v1.3.14)**:

- ✅ Comprehensive interop CSN generation for better format compatibility
- ✅ Removed "localized" associations from interop CSN
- ✅ Fixed i18n language key separators (now uses "-")
- ✅ Local entity exposure properly included
- ✅ All tests passing with enhanced interop CSN testing

**Authentication & Security (v1.3.13)**:

- ✅ Standardized access strategy to basic-auth
- ✅ `authenticateMetadataEndpoints` default set to false
- ✅ Java authentication issues resolved
- ✅ Dedicated auth test files added
- ✅ Environment variable configuration priority maintained

**Data Product APIs (v1.3.10)**:

- ✅ Dual annotation support (`@data.product` and `@DataIntegration.dataProduct.type: 'primary'`)
- ✅ Version suffix handling for clean ORD IDs (`.v1`, `.v2`)
- ✅ Enhanced `isPrimaryDataProductService` function
- ✅ Full feature parity between both annotation types
- ✅ Comprehensive test coverage (36+ new tests)
- ✅ All tests passing with 97%+ code coverage

<<<<<<< HEAD
**MCP API exposure** ✅ → 🔄:

- ✅ Implemented conditional MCP API resource generation based on plugin availability
- ✅ Added proper MCP protocol support in ORD document structure
- ✅ Created comprehensive test coverage for MCP integration scenarios
- 🔄 Continue refinement based on production usage feedback
- # 🔄 Ensure proper documentation and testing of exposed APIs

    **Dependency Management (v1.3.10+)**:

- ✅ Renovate bot integration for automated updates
- ✅ Node.js v22 support
- ✅ Express v5 upgrade
- ✅ Jest v30 upgrade
- ✅ Spring Boot v3.5.6 (Java)
- ✅ Trusted publishing with provenance

### Immediate Development (Next Release - v1.4.0)

**Node.js Version Support** 📋:

- Evaluate Node.js version support strategy beyond v22
- Consider LTS version support timeline
- Plan migration path for users on older Node.js versions

**Interop CSN Enhancements** 🔄:

- Monitor production usage and gather feedback
- Address edge cases in interop CSN generation
- Improve error handling for CSN conversion issues

**MCP API Exposure** 📋:

- Support the exposure of MCP APIs through ORD as API Resources with API protocol `mcp`
- In addition to being regular API Resources for OData
- Ensure proper documentation and testing of exposed APIs
    > > > > > > > origin/main

### Medium-term Development

**Java Runtime Parity** 🔄:

- Complete Java implementation feature parity with Node.js version
- Ensure differentiation of ORD properties and defaults (like API resource paths) between CAP Java/Spring and CAP Node.js environments
- Keep ORD properties from CAP CDS/CSN model consistent across both runtimes
- Continue improving Java authentication middleware
- Enhanced Java build integration
- Note: Java support location (this repository vs. separate) still under consideration

**Error Handling Enhancement** 📋:

- Better error messages for configuration issues
- Improved diagnostics for ORD generation failures
- Validation error reporting improvements
- Recovery mechanisms for partial failures

**Performance Optimization** 🔄:

- Large CAP application handling improvements
- Memory usage optimization during generation
- Build time performance enhancements
- Caching strategies for repeated operations

**Integration Dependencies**:

- Dependency detection and modeling
- Proper ORD integration dependency structure
- Aspect and annotation handling

**Advanced Authentication** 📋:

- UCL-mTLS authentication implementation (planned)
- Certificate-based authentication support
- Parallel support for UCL-mTLS and basic-auth for different integration requirements
- Enhanced authentication configuration flexibility

### Long-term Vision

## Known Issues

### Current Limitations

**Performance Constraints** ⚠️:

- Large CAP applications may experience slower build times (ongoing optimization)
- Memory usage can be high for complex models
- Interop CSN generation adds processing time
- No caching for repeated ORD generation operations

**Configuration Complexity** ⚠️:

- Authentication configuration requires careful setup
- Advanced configuration scenarios can be complex
- Error messages for configuration issues could be clearer
- Migration between plugin versions may require manual updates
- Node.js version constraints may impact some users

**Platform Compatibility** ⚠️:

- Some path handling issues on Windows
- Cross-platform testing coverage gaps
- Environment-specific configuration challenges

### Technical Debt

**Code Organization** 🔧:

- Some functions in `lib/ord.js` are becoming large
- Template system could benefit from further modularization
- Error handling patterns could be more consistent

**Testing Coverage** 🔧:

- Some edge cases in interop CSN generation need more tests
- Cross-platform testing could be more comprehensive (Node.js & Java)
- Performance testing infrastructure needs improvement
- Authentication test coverage significantly improved

**Documentation** 🔧:

- Some advanced configuration scenarios need better documentation
- Migration guides between versions need updates
- Troubleshooting guides could be more comprehensive

## Evolution of Project Decisions

### Architecture Evolution

**Initial Design (v1.0.0)**:

- Single entry point through compiler integration
- Basic ORD document generation
- Limited customization options

**Dual Entry Point Addition (v1.1.0)**:

- Added runtime API endpoints
- Introduced authentication system
- Enhanced customization framework

**Java Support Addition (v1.3.8)**:

- Extended architecture to support Java runtime
- Cross-platform compatibility improvements
- Enhanced build system integration

**Current State (v1.3.14)**:

- Mature dual entry point architecture
- Comprehensive customization framework
- Robust authentication system with basic-auth standardization
- Strong testing infrastructure including dedicated auth tests
- Production-ready interop CSN generation
- ORD specification v1.12 support
- Trusted publishing with provenance
- Automated dependency management via Renovate

### Configuration Strategy Evolution

**Early Approach**:

- Simple `.cdsrc.json` configuration
- Limited customization options
- Basic annotation support

**Current Approach (v1.3.13+)**:

- Multi-source configuration hierarchy
- Environment variable prioritization over `.cdsrc.json`
- `authenticateMetadataEndpoints: false` by default
- Basic-auth as standard access strategy
- Comprehensive annotation system
- Custom ORD content file integration

### Testing Strategy Evolution

**Initial Testing**:

- Basic unit tests
- Limited coverage

**Current Testing (v1.3.13+)**:

- Comprehensive snapshot testing
- Dedicated authentication test files
- Integration tests for basic-auth and mTLS
- Interop CSN generation testing
- Full test coverage across multiple categories
- Mock data for various scenarios
- Automated test execution in CI/CD

## Success Metrics

### Technical Success ✅

- **ORD Compliance**: 100% compliance with ORD specification v1
- **CAP Integration**: Seamless integration with CAP framework
- **Performance**: Acceptable build times for typical CAP applications
- **Reliability**: Stable ORD generation across different CAP application types

### User Adoption ✅

- **Community Usage**: Growing adoption in CAP developer community
- **Enterprise Deployment**: Successful enterprise deployments
- **Documentation Quality**: Comprehensive documentation and examples
- **Developer Experience**: Positive feedback on ease of use

### Platform Integration ✅

- **ORD Ecosystem**: Recognition as reference ORD implementation
- **Tool Compatibility**: Works with major ORD discovery tools
- **Enterprise Catalogs**: Successful integration with enterprise service catalogs
- **Standard Compliance**: Maintains ORD specification compliance

## Next Milestone Targets

### Version 1.4.0 Goals (In Planning)

1. **Node.js Version Strategy**: Define clear support strategy for Node.js versions beyond v22
2. **Interop CSN Stability**: Address edge cases and improve production reliability
3. **Complete Java Parity**: Continue progress toward full feature parity between Node.js and Java
4. **Performance Optimization**: Improvements in build time and memory usage, especially for interop CSN
5. **Enhanced Error Handling**: Better error messages and diagnostics
6. **Documentation Updates**: Comprehensive documentation refresh including interop CSN and auth

### Version 1.5.0 Goals (Future)

1. **UCL-mTLS Authentication**: Advanced authentication implementation with parallel basic-auth support
2. **MCP API Exposure**: Support for MCP protocol APIs in ORD
3. **Enhanced Customization**: Improved custom ORD content workflows
4. **Monitoring Capabilities**: Basic metrics and observability features
5. **Platform Integration**: Better enterprise service catalog integration

### Long-term Goals (v2.0.0)

1. **Architecture Refresh**: Clean up technical debt and optimize architecture
2. **Advanced Features**: Full enterprise-grade feature set
3. **Ecosystem Leadership**: Establish as definitive ORD reference implementation
4. **Community Growth**: Expand adoption across broader CAP community
