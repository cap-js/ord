# Product Context: CAP-JS ORD Plugin

## Why This Project Exists

The CAP-JS ORD plugin addresses a critical need in enterprise software landscapes: **automated service and metadata discovery**. As organizations build increasingly complex microservice architectures with CAP applications, they face challenges in:

- **Service Discovery**: Finding and understanding available services across the landscape
- **Metadata Management**: Maintaining up-to-date documentation and specifications
- **Integration Planning**: Understanding service capabilities and dependencies
- **Governance**: Ensuring compliance with enterprise standards and policies

## Problems It Solves

### 1. Manual Metadata Management

**Problem**: Developers manually maintain service documentation that quickly becomes outdated.
**Solution**: Automatically generates comprehensive metadata directly from CAP application definitions.

### 2. Service Discovery Complexity

**Problem**: Teams struggle to find and understand available services in large landscapes.
**Solution**: Provides standardized ORD endpoints that enable automated service discovery tools.

### 3. Integration Documentation Gap

**Problem**: Lack of machine-readable service specifications hampers integration efforts.
**Solution**: Generates OpenAPI, AsyncAPI, CSN and EDMX specifications alongside ORD documents.

### 4. Metadata Security Concerns

**Problem**: Sensitive service metadata exposed without proper access controls. Different integrations, require different authentication mechanism.
**Solution**: Implements configurable authentication mechanisms to protect metadata access.

### 5. Platform Integration Challenges

**Problem**: Difficulty integrating CAP services with enterprise service catalogs and discovery platforms.
**Solution**: Follows ORD specification standards for seamless platform integration.

## How It Should Work

### User Experience Goals

**For CAP Developers:**

- Zero-configuration metadata generation for standard CAP applications
- Simple annotation-based customization for specific requirements
- Seamless integration with existing CAP development workflows
- Clear feedback when ORD generation encounters issues
- Automated metadata collection from CAP applications into the customer landscapes
- Configurable visibility controls for different resource types
- Integration with enterprise service catalogs and governance tools
- Performance-optimized metadata generation for large applications

### Core Workflows

#### 1. Development-Time Generation

```bash
# Generate static ORD documents during build
cds build --for ord

# Compile ORD document only
cds compile srv/ --to ord
```

#### 2. Runtime Discovery

```http
# Well-known ORD discovery endpoint
GET /.well-known/open-resource-discovery

# ORD document endpoint
GET /ord/v1/documents/ord-document
```

#### 3. Customization Workflow

```json
// Global configuration in .cdsrc.json
{
    "ord": {
        "namespace": "sap.sample",
        "description": "Custom description",
        "defaultVisibility": "internal"
    }
}
```

```cds
// Service-level customization with annotations
annotate ProcessorService with @ORD.Extensions: {
  title: 'Custom Service Title',
  industry: ['Retail', 'Manufacturing']
};
```

## Success Metrics

### Technical Success

- **ORD Compliance**: 100% compliance with ORD specification requirements
- **Performance**: ORD document generation completes within acceptable time limits
- **Reliability**: Consistent metadata generation across different CAP application types
- **Security**: Proper authentication enforcement when configured

### User Success

- **Adoption**: Widespread use across CAP development teams
- **Integration**: Successful integration with enterprise service discovery platforms
- **Customization**: Teams can easily customize metadata without breaking compliance
- **Maintenance**: Minimal ongoing maintenance required for ORD document accuracy

### Business Success

- **Service Discovery**: Reduced time to discover and understand available services
- **Integration Speed**: Faster service integration through comprehensive metadata
- **Governance**: Improved compliance with enterprise metadata standards
- **Platform Value**: Enhanced value of CAP applications through better discoverability

## Key Value Propositions

1. **Automated Compliance**: Ensures ORD specification compliance without manual effort
2. **CAP Native**: Deep integration with CAP framework patterns and conventions
3. **Flexible Security**: Configurable authentication from open access to enterprise-grade security
4. **Comprehensive Coverage**: Supports all major ORD resource types and CAP constructs
5. **Platform Ready**: Designed for enterprise service discovery and catalog platforms
