# Active Context: CAP-JS ORD Plugin

## Current Work Focus

### Recent Development Activity

**Latest Completed Feature (September 26, 2025)**:

- **Dual Annotation Support for Data Products**: Enhanced data product service exposure to support both `@DataIntegration.dataProduct.type: 'primary'` and the simpler `@data.product` annotation
- Either annotation is now sufficient to create data product ORD resources with full feature parity
- `@DataIntegration.dataProduct.type: 'primary'` takes precedence when both annotations are present
- Services with `@data.product` (truthy values) get same ORD properties: `sap.dp:data-subscription-api:v1`, REST protocol, outbound direction, internal visibility
- Enhanced `isPrimaryDataProductService` function to handle both annotation patterns
- Added comprehensive test coverage (36 new tests across multiple test suites)
- Full backward compatibility maintained - no breaking changes

**Previous Major Feature (September 5, 2025)**:

- **Version Suffix Handling for Data Products**: Implemented new pattern for CAP framework data products where service names with `.v1` or `.v2` suffixes result in ORD IDs like `:apiResource::v1` or `:v2` instead of `:apiResource:.v1:v1`
- Added comprehensive version extraction logic with strict validation
- Fixed namespace processing for clean service names
- Created extensive test coverage (14 test cases)
- Maintained full backward compatibility

**Previous Release (v1.3.9 - September 2, 2025)**:

- Fixed visibility handling for private resources (no group creation)
- Added support for loading additional package attributes
- Improved package configuration flexibility

**Recent Major Features (v1.3.8)**:

- Java sample application setup
- Java pipeline integration
- CommonJS support improvements

### Current Development Priorities

1. **Data Product Support**: Enhanced support for CAP data products with proper version handling
2. **Java Runtime Support**: Expanding support for CAP Java applications
3. **Visibility Management**: Refining resource visibility controls and group handling
4. **Package Configuration**: Enhanced package attribute loading and customization
5. **Authentication Evolution**: Preparing for UCL-mTLS authentication support

## Active Decisions and Considerations

### Architecture Decisions

**Dual Entry Point Maintenance**:

- Continue supporting both static generation and runtime API patterns
- Ensure feature parity between Node.js and Java implementations
- Maintain backward compatibility across CAP framework versions

**Configuration Strategy**:

- Prioritize environment variables for production deployments
- Enhance annotation-based customization capabilities
- Improve custom ORD content integration workflows

**Performance Optimization**:

- Focus on build-time performance for large CAP applications
- Optimize memory usage during ORD document generation
- Consider caching strategies for frequently accessed metadata

### Technical Considerations

**ORD Specification Compliance**:

- Stay current with ORD specification updates
- Ensure generated documents pass ORD validation requirements
- Maintain compatibility with ORD discovery tools and platforms

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
- Only apply to primary data product services (`@DataIntegration.dataProduct.type: "primary"`)
- Create temporary service definitions for proper namespace processing
- Maintain backward compatibility for all non-matching patterns

**Configuration Hierarchy**:

```
Environment Variables > Custom ORD Content > @ORD.Extensions > CAP Annotations > Plugin Defaults
```

**Testing Strategy**:

- Comprehensive snapshot testing for ORD document structure validation
- Unit tests for individual functions and components
- End-to-end tests for complete workflows
- Mock data organization in `__tests__/__mocks__/`

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

- ✅ **Version Suffix Handling**: Successfully implemented version extraction for data product services
- ✅ **Namespace Processing Fix**: Resolved ORD ID duplication issues
- ✅ **Comprehensive Testing**: Added 14 test cases covering all scenarios
- ✅ **Backward Compatibility**: Ensured no regressions in existing functionality

### Immediate Priorities

- Monitor version suffix handling feature in production usage
- Gather feedback on data product ORD ID generation patterns
- Consider extending version handling to other service types if needed

## Current Challenges

### Technical Challenges

- **Complexity Management**: Balancing feature richness with maintainability
- **Performance Scaling**: Handling very large CAP applications efficiently
- **Cross-Platform Compatibility**: Ensuring consistent behavior across environments
- **Dependency Management**: Managing OpenAPI/AsyncAPI plugin dependencies

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
