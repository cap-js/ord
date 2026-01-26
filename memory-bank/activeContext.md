# Active Context: CAP-JS ORD Plugin

## Current Work Focus

### Recent Development Activity

**Dependency Review and Issue Triage (January 26, 2026)**:

- **Spring Boot 4 Branch Evaluation**: Reviewed `renovate/major-spring-boot` branch that proposed upgrading from Spring Boot 3.5.10 to 4.0.2
- **CAP Compatibility Check**: Investigated CAP Java Spring Boot version support - confirmed CAP Java only supports Spring Boot 3.x (not 4.x yet)
- **Decision**: Deleted the `renovate/major-spring-boot` branch as CAP framework doesn't yet support Spring Boot 4
- **Issue #101 Review**: Evaluated GitHub issue about moving assets out of repo
  - Identified 7.2MB GIF and 356KB PNG in `asset/etc/` directory
  - Confirmed assets are NOT included in npm package (excluded via `files` field in package.json)
  - Conclusion: No action needed - assets don't affect package size, only git clone

**Test Code Refactoring - Clean Code Implementation (December 15, 2025)**:

- **Objective**: Eliminate duplicate authentication mock configurations across test files following Clean Code principles
- **Problem Identified**: Multiple test files contained identical authentication mock configurations, violating DRY (Don't Repeat Yourself) principle
- **Solution Implemented**:
    - Created comprehensive test helper utility module (`__tests__/unit/utils/test-helpers.js`)
    - Implemented reusable helper functions: `mockCdsContext()`, `mockAuthenticationService()`, `mockCreateAuthConfig()`, `setupAuthMocks()`
    - Support for different authentication configurations: Open, Basic, CF mTLS, and Mixed
    - Refactored 5 test files to use helper functions: `templates.test.js`, `namespace.test.js`, `ordVisibilitySplit.test.js`, `mockedCsn.test.js`, `ord.e2e.test.js`
- **Benefits Achieved**:
    - **Reduced Code Duplication**: Eliminated 10+ instances of repeated authentication mock configurations
    - **Improved Maintainability**: Authentication configuration changes now require updates in only one place
    - **Enhanced Consistency**: All tests use identical mock configurations, reducing test flakiness
    - **Simplified Test Writing**: New tests can easily reuse authentication helpers
    - **Better Code Organization**: Clear separation between test logic and mock setup
- **Test Results**: All 357 tests pass (356 passed, 1 skipped), maintaining 100% test reliability
- **Code Coverage**: Maintained high coverage (82.44% overall) while improving code quality
- **Architecture Impact**: Established new pattern for test helper utilities that can be extended for future testing needs

**Authentication Test Fix (December 11, 2025)**:

- **Root Cause Identified**: Authentication tests were failing because they expected a `types` property that no longer exists in the production code
- **User's Design Decision**: The user had intentionally removed the `types` property from authentication configuration, preferring to auto-parse authentication types from the `accessStrategies` configuration instead
- **Problem**: Tests were still expecting `authConfig.types` but the production code only provides `authConfig.accessStrategies`
- **Solution Implemented**:
    - Completely removed all references to `types` property from test expectations
    - Updated all test mock configurations to only use `accessStrategies`
    - Fixed constant mismatches where tests expected `ORD_ACCESS_STRATEGY` values but production code uses `AUTHENTICATION_TYPE` values
    - Updated mock authenticate function to extract authentication types from `accessStrategies.map(s => s.type)` instead of expecting a separate `types` array
- **Tests Fixed**: All 6 previously failing CF mTLS authentication tests now pass
- **Final Result**: All 325 tests now pass (324 passed, 1 skipped), confirming the new architecture works correctly

**Authentication Error Fix (December 10, 2025)**:

- **Root Cause Identified**: The error `Cannot read properties of undefined (reading 'authConfig')` was caused by unreliable `cds.context` usage for storing authentication configuration
- **Solution Implemented**: Replaced `cds.context` dependency with module-level caching for authentication configuration
- **Architecture Simplified**: Removed async complexity from authentication initialization, making it synchronous and more reliable
- **Tests Updated**: Modified test suite to work with new module-level caching approach instead of `cds.context` mocking

**Latest Release (v1.3.14 - November 18, 2025)**:

- **Interop CSN Enhancement**: Removed association "localized" from interop CSN generation to improve CSN compatibility
- **Trusted Publishing Setup**: Prepared for trusted publishing and enabled provenance for better supply chain security
- **Dependency Updates**: Updated supertest to v7 for improved testing capabilities
- All tests passing with enhanced interop CSN generation

**Recent Release (v1.3.13 - November 12, 2025)**:

- **Access Strategy Migration**: Switched access strategy to basic-auth for improved security posture
- **Authentication Configuration**: Set `authenticateMetadataEndpoints` to false by default for better flexibility
- **Node.js Version Support**: Limited support to Node.js version 22 only
- **ORD Specification Update**: Updated openResourceDiscovery version to 1.12
- **Enhanced Testing**: Added dedicated auth test files for better authentication coverage

**Recent Release (v1.3.12 - October 16, 2025)**:

- **Interop CSN i18n Fix**: Fixed internationalization handling in interop CSN by using "-" as separator for language keys instead of "\_"
- **Dependency Updates**: Updated jacoco-maven-plugin and actions/setup-node

**Recent Release (v1.3.11 - October 10, 2025)**:

- **Interop CSN Production**: Introduced comprehensive interop CSN generation for better CSN format compatibility
- **Java Authentication Fix**: Resolved authentication issues in Java runtime
- **Local Entity Exposure Fix**: Fixed missing local entity exposure in ORD documents
- **Dependency Updates**: Updated CDS services to v4.4.1

**Major Feature Release (v1.3.10 - September 26, 2025)**:

- **Dual Annotation Support for Data Products**: Enhanced data product service exposure to support both `@DataIntegration.dataProduct.type: 'primary'` and the simpler `@data.product` annotation
- **Version Suffix Handling**: Implemented clean ORD ID generation for data product services with version suffixes (e.g., `.v1`, `.v2`)
- **Custom Build Destination**: Added support for custom build destination paths
- **Vipe Coding Support**: Configured support for vipe coding workflow
- **Dependency Modernization**: Major dependency updates including Node v22, Express v5, Jest v30, Spring Boot v3.5.6
- **Renovate Integration**: Configured Renovate bot for automated dependency management

### Current Development Priorities (January 2026)

1. **CAP Java Spring Boot 4 Support**: Monitor CAP framework updates for Spring Boot 4 compatibility
2. **Issue Triage**: Continue reviewing and addressing community issues (e.g., Issue #101 - assets in repo)
3. **Authentication System Stability**: Maintain stable authentication architecture
4. **Test Suite Reliability**: All 357 tests now pass with comprehensive coverage
5. **Production Stability**: Monitoring and stabilizing features in production environments
6. **Java Runtime Maturation**: Achieving full feature parity between Node.js and Java implementations
7. **Interop CSN Stability**: Ensuring robust interop CSN generation across various CAP model patterns
8. **Node.js Version Strategy**: Planning support strategy for Node.js versions (currently 18-22)
9. **Performance Optimization**: Addressing build-time and memory usage concerns for large CAP applications
10. **Supply Chain Security**: Maintaining trusted publishing and provenance capabilities
11. **Dependency Management**: Keeping dependencies current through automated Renovate updates (excluding incompatible upgrades like Spring Boot 4)
12. **Documentation Modernization**: Updating documentation to reflect current architecture and best practices
13. **Community Feedback Integration**: Incorporating user feedback from v1.4.x releases into future development

## Active Decisions and Considerations

### Architecture Decisions

**Authentication System Overhaul**:

- **Removed `types` Property**: User intentionally removed the `types` property from authentication configuration, preferring to auto-parse authentication types from `accessStrategies` instead
- **Auto-parsing Design**: Authentication types are now automatically derived from the `accessStrategies` array using `accessStrategies.map(s => s.type)`
- **Cleaner Architecture**: This eliminates redundancy and ensures consistency between what's configured and what's used
- **Module-Level Caching**: Authentication config is cached at the module level, eliminating dependency on `cds.context`
- **Synchronous Configuration**: Authentication config loading is now synchronous, removing async complexity
- **Better Error Handling**: Improved error handling for configuration initialization failures
- **Test Architecture**: Updated test suite to use comprehensive mocking that works with the new architecture

**Dual Entry Point Maintenance**:

- Continue supporting both static generation and runtime API patterns
- Ensure feature parity between Node.js and Java implementations
- Maintain backward compatibility across CAP framework versions

**Configuration Strategy**:

- Environment variables take precedence for runtime configuration
- `.cdsrc.json` provides application-level defaults
- `authenticateMetadataEndpoints` default set to false for flexibility
- Access strategy standardized to basic-auth for consistent security
- Enhance annotation-based customization capabilities
- Improve custom ORD content integration workflows

**Performance Optimization**:

- Focus on build-time performance for large CAP applications
- Optimize memory usage during ORD document generation
- Consider caching strategies for frequently accessed metadata

### Technical Considerations

**Authentication Architecture Improvements**:

- **No More `types` Property**: Authentication configuration no longer includes a separate `types` array - types are auto-parsed from `accessStrategies`
- **Module-Level Caching**: Authentication configuration is now cached at the module level, eliminating dependency on `cds.context`
- **Synchronous Loading**: Configuration loading is now synchronous, removing async complexity and potential race conditions
- **Robust Error Handling**: Better error handling for invalid configurations with clear error messages
- **Simplified Testing**: Test suite updated to work with new caching approach using comprehensive mock implementation
- **Multi-Auth Strategy Support**: Proper fallback logic between Basic auth and CF mTLS authentication

**ORD Specification Compliance**:

- Currently supporting ORD specification v1.12
- Stay current with ORD specification updates
- Ensure generated documents pass ORD validation requirements
- Maintain compatibility with ORD discovery tools and platforms
- Interop CSN format aligns with latest standards

**CAP Framework Evolution**:

- Track CAP framework changes and adapt accordingly
- Leverage new CAP features for improved ORD generation
- Maintain compatibility with existing CAP applications

## Important Patterns and Preferences

### Code Organization Patterns

**Authentication Module Pattern**:

- **No `types` Property**: Don't include a separate `types` array in authentication configuration - auto-parse from `accessStrategies` instead
- **Module-Level Variables**: Use module-level variables for caching instead of global context objects
- **Synchronous Initialization**: Prefer synchronous initialization over async when possible
- **Error-First Design**: Always check for errors before proceeding with operations
- **Clear Separation**: Separate configuration creation from configuration caching
- **Comprehensive Testing**: Use complete mock implementations that mirror production behavior

**Modular Architecture**:

- Keep core logic in `lib/ord.js` focused on ORD generation
- Maintain template system in `lib/templates.js` for reusability
- Separate authentication concerns in `lib/authentication.js`
- Use `lib/constants.js` for shared constants instead of magic strings

**Version Suffix Handling Pattern**:

- Use strict regex validation (`/\.v(\d+)$/`) for version extraction
- Apply to primary data product services (both `@DataIntegration.dataProduct.type: "primary"` and `@data.product`)
- Create temporary service definitions for proper namespace processing
- Maintain backward compatibility for all non-matching patterns

**Interop CSN Generation Pattern**:

- Remove "localized" associations to improve compatibility
- Use "-" as separator for language keys in i18n handling
- Ensure CSN format aligns with CAP framework expectations
- Support for local entity exposure in interop format

**Configuration Hierarchy**:

```
Environment Variables > Custom ORD Content > @ORD.Extensions > CAP Annotations > Plugin Defaults
```

**Testing Strategy**:

- Comprehensive snapshot testing for ORD document structure validation
- Unit tests for individual functions and components
- Dedicated authentication test files with complete mock implementations
- Integration tests for basic-auth and mTLS scenarios
- End-to-end tests for complete workflows
- Mock data organization in `__tests__/__mocks__/`
- Interop CSN generation testing
- Module-level mocking for authentication configuration
- **No `types` Property in Mocks**: Test mocks should only use `accessStrategies`, never include a `types` property

### Development Preferences

**Code Style**:

- 4-space indentation consistently applied
- ESLint recommended rules enforcement
- Constants in SCREAMING_SNAKE_CASE with Object.freeze()
- Files in kebab-case, functions in camelCase

**Error Handling**:

- Graceful degradation when optional features fail
- Clear error messages for configuration issues
- Proper validation of ORD document structure
- Authentication error handling with appropriate HTTP status codes
- Module-level error handling for configuration failures

**Performance Considerations**:

- Lazy loading of heavy dependencies
- Efficient CSN model processing
- Minimal memory footprint during generation
- Progress reporting for long-running build operations
- Module-level caching to avoid repeated initialization

## Key Learnings

### Key Technical Insights

**Authentication Test Architecture Lessons**:

- **Removing Redundant Properties**: When a user removes a property like `types` from production code, all test references must be updated accordingly
- **Auto-parsing Benefits**: Auto-parsing authentication types from configuration eliminates redundancy and ensures consistency
- **Test Mock Alignment**: Test mocks must exactly match the production code structure - no extra properties should be included
- **Constant Consistency**: Tests must use the same constants as production code (`AUTHENTICATION_TYPE` vs `ORD_ACCESS_STRATEGY`)
- **Comprehensive Mock Updates**: When changing authentication architecture, all mock configurations need to be updated consistently

**Authentication Architecture Lessons**:

- **Simplified Configuration**: Removing redundant properties like `types` makes configuration cleaner and less error-prone
- **Auto-parsing Reliability**: Deriving authentication types from `accessStrategies` ensures they're always in sync
- **Module-Level Caching Benefits**: Module-level variables provide more reliable caching than framework-dependent global objects
- **Synchronous Simplicity**: Removing async complexity from configuration loading eliminates race conditions and improves reliability
- **Test Architecture**: Mocking module-level caches requires different approaches than mocking global context objects

**CSN Processing Complexity**:

- CAP CSN models can be highly complex with nested relationships
- Service definitions require careful analysis to extract ORD-relevant information
- Entity relationships need proper mapping to ORD entity types
- Event definitions require special handling for AsyncAPI integration

### Current Implementation Insights

**Interop CSN Generation**:

- Interop CSN provides a standardized CSN format for better integration compatibility
- Removed "localized" associations improve downstream tooling compatibility
- Language key separators standardized to "-" for i18n consistency
- Local entity exposure properly included in interop CSN output
- CSN format aligns with both CAP framework and ORD requirements

**Data Product Annotation Handling**:

- Dual annotation support requires careful precedence logic to avoid conflicts
- `@DataIntegration.dataProduct.type: 'primary'` takes precedence over `@data.product` when both are present
- Both annotations trigger identical ORD resource properties for consistency

**Version Suffix Processing**:

- Version suffix extraction requires strict pattern validation (`/\.v(\d+)$/`)
- Namespace processing must be applied to clean service names to prevent duplication
- Feature scoped only to primary data products to maintain backward compatibility

**MCP Integration**:

- Conditional API resource generation based on plugin availability
- Comprehensive test coverage essential for optional feature scenarios
- Backward compatibility maintained across integration scenarios

**Authentication Configuration**:

- Auto-parsing authentication types from configuration is more reliable than maintaining separate arrays
- Module-level caching is more reliable than `cds.context` for application-wide configuration
- Synchronous initialization eliminates race conditions and startup issues
- Environment variables override configuration file settings for runtime flexibility
- Clear error messages help developers debug configuration issues

**Authentication Challenges**:

- Balancing security with ease of development
- Environment variable configuration can be complex for teams
- Basic authentication with bcrypt provides good security baseline
- Future UCL-mTLS support will require significant architecture changes

**Customization Balance**:

- Users need extensive customization capabilities
- Too much flexibility can break ORD compliance
- Annotation-based customization provides good developer experience
- Custom ORD content files offer maximum flexibility for advanced users

### Integration Learnings

**CAP Framework Integration**:

- Plugin registration patterns work well with CAP's architecture
- Build system integration requires careful handling of file generation
- Service definition approach provides clean runtime API implementation
- Compiler integration enables programmatic ORD generation

**External Tool Integration**:

- OpenAPI and AsyncAPI plugins provide essential resource definitions
- EDMX generation maintains OData protocol compliance
- Resource definition file generation requires careful path management
- Cross-platform compatibility (Windows/Linux/macOS) needs attention

### User Experience Insights

**Developer Workflow**:

- Zero-configuration approach works well for standard CAP applications
- Annotation-based customization feels natural to CAP developers
- Build integration provides familiar development experience
- Runtime API endpoints enable dynamic discovery scenarios

**Enterprise Requirements**:

- Authentication is critical for production deployments
- Visibility controls are essential for internal/external resource separation
- Custom ORD content enables integration with enterprise catalogs
- Performance at scale requires ongoing optimization

## Next Steps and Considerations

### Recently Completed

- ✅ **Authentication Test Fix**: Successfully resolved all authentication test failures by removing `types` property references
- ✅ **Test Suite Stability**: All 325 tests now pass, ensuring complete test coverage and reliability
- ✅ **Authentication Architecture Cleanup**: Successfully aligned test mocks with production code that auto-parses authentication types
- ✅ **Constant Consistency**: Fixed all constant mismatches between tests and production code
- ✅ **Mock Configuration Updates**: Updated all test mock configurations to match new authentication architecture
- ✅ **Authentication Error Fix**: Successfully resolved the `Cannot read properties of undefined (reading 'authConfig')` error
- ✅ **Module-Level Caching**: Implemented reliable module-level caching for authentication configuration
- ✅ **Synchronous Architecture**: Simplified authentication initialization by removing async complexity
- ✅ **Test Suite Updates**: Updated test suite to work with new authentication architecture
- ✅ **Interop CSN Production**: Successfully implemented comprehensive interop CSN generation
- ✅ **CSN i18n Handling**: Fixed language key separator issues in interop CSN
- ✅ **Authentication Refinement**: Improved authentication configuration and Java support
- ✅ **Access Strategy Standardization**: Migrated to basic-auth for consistent security
- ✅ **ORD Specification Update**: Updated to v1.12 support
- ✅ **Trusted Publishing**: Enabled provenance and prepared for trusted publishing
- ✅ **Version Suffix Handling**: Successfully implemented version extraction for data product services
- ✅ **Dual Annotation Support**: Implemented support for both data product annotation patterns
- ✅ **Comprehensive Testing**: Enhanced test coverage including dedicated auth tests

### Immediate Priorities

- Monitor authentication system stability in production usage
- Continue stabilizing Java runtime support
- Track ORD specification v1.12 adoption
- Consider Node.js version support beyond v22
- Gather feedback on authentication configuration improvements

## Current Challenges

### Technical Challenges

- **Test Suite Maintenance**: Ensuring test mocks stay synchronized with production code changes
- **Authentication Configuration**: Balancing security with deployment flexibility
- **Node.js Version Strategy**: Managing support for evolving Node.js versions
- **Complexity Management**: Balancing feature richness with maintainability
- **Performance Scaling**: Handling very large CAP applications efficiently
- **Cross-Platform Compatibility**: Ensuring consistent behavior across environments (Node.js & Java)
- **Dependency Management**: Managing OpenAPI/AsyncAPI plugin dependencies and automated updates

### User Experience Challenges

- **Configuration Complexity**: Simplifying advanced configuration scenarios
- **Error Diagnostics**: Providing clear feedback when ORD generation fails
- **Documentation Maintenance**: Keeping documentation current with rapid development
- **Migration Support**: Helping users upgrade between plugin versions

### Ecosystem Challenges

- **ORD Specification Evolution**: Staying current with specification changes
- **CAP Framework Changes**: Adapting to CAP framework evolution
- **Tool Integration**: Maintaining compatibility with ORD discovery tools
- **Community Feedback**: Incorporating diverse user requirements effectively
