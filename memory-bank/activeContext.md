# Active Context: CAP-JS ORD Plugin

## Current Work Focus

### Recent Development Activity

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

- **Interop CSN i18n Fix**: Fixed internationalization handling in interop CSN by using "-" as separator for language keys instead of "_"
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


### Current Development Priorities

1. **Interop CSN Stability**: Ensuring robust interop CSN generation across various CAP model patterns
2. **Authentication Refinement**: Improving authentication configuration flexibility and security
3. **Node.js Version Strategy**: Focusing on Node.js 22 support and future version planning
4. **Supply Chain Security**: Maintaining trusted publishing and provenance capabilities
5. **Dependency Management**: Keeping dependencies current through automated Renovate updates
6. **Java Runtime Parity**: Continuing to expand and stabilize Java runtime support
7. **CSN Format Compatibility**: Ensuring clean CSN generation for various integration scenarios

## Active Decisions and Considerations

### Architecture Decisions

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
- Dedicated authentication test files for security validation
- Integration tests for basic-auth and mTLS scenarios
- End-to-end tests for complete workflows
- Mock data organization in `__tests__/__mocks__/`
- Interop CSN generation testing

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

**Performance Considerations**:

- Lazy loading of heavy dependencies
- Efficient CSN model processing
- Minimal memory footprint during generation
- Progress reporting for long-running build operations

## Learnings and Project Insights

### Key Technical Insights

**CSN Processing Complexity**:

- CAP CSN models can be highly complex with nested relationships
- Service definitions require careful analysis to extract ORD-relevant information
- Entity relationships need proper mapping to ORD entity types
- Event definitions require special handling for AsyncAPI integration

**Interop CSN Generation**:

- Interop CSN provides a standardized CSN format for better integration compatibility
- Removed "localized" associations improve downstream tooling compatibility
- Language key separators standardized to "-" for i18n consistency
- Local entity exposure properly included in interop CSN output
- CSN format aligns with both CAP framework and ORD requirements

**Data Product Annotation Handling**:

- Dual annotation support requires careful precedence logic to avoid conflicts
- `@DataIntegration.dataProduct.type: 'primary'` takes precedence over `@data.product` when both are present
- Boolean coercion (using `!!`) is essential for consistent true/false returns from detection functions
- Version suffix extraction applies to both annotation types seamlessly
- Both annotations trigger identical ORD resource properties for consistency

**Data Product Version Handling**:

- Version suffix extraction requires strict pattern validation to avoid false positives
- Namespace processing must be applied to clean service names to prevent duplication
- Semantic versioning conversion (v1 → 1.0.0) provides consistent version format
- Feature must be scoped only to primary data products to maintain backward compatibility

**Authentication Configuration**:

- `authenticateMetadataEndpoints: false` by default allows flexible deployment scenarios
- Basic-auth access strategy provides consistent security baseline
- Environment variables override configuration file settings for runtime flexibility
- Java authentication issues resolved with proper initialization

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

- Monitor interop CSN generation in production usage
- Gather feedback on authentication configuration improvements
- Continue stabilizing Java runtime support
- Track ORD specification v1.12 adoption
- Consider Node.js version support beyond v22

## Current Challenges

### Technical Challenges

- **Interop CSN Complexity**: Ensuring interop CSN works across all CAP model patterns
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
