# Integration Testing Guide

This document describes the comprehensive integration testing setup for the CAP-JS ORD plugin, including mTLS authentication testing and automated CI/CD pipelines.

## Overview

The integration testing framework provides:

- **Dynamic Certificate Generation**: Automated CA and client certificate creation
- **Authentication Configuration**: Secure credential management with bcrypt hashing
- **mTLS Testing**: Complete mTLS authentication flow validation
- **CI/CD Integration**: GitHub Actions workflow for automated testing
- **Bookshop Test Application**: Realistic CAP application for testing

## Architecture

### Components

1. **Certificate Generation Script** (`scripts/generate-test-certs.sh`)
   - Creates CA certificate and private key
   - Generates client certificate signed by CA
   - Exports base64-encoded certificates for CI/CD
   - Validates certificate chain

2. **Authentication Setup Script** (`scripts/setup-bookshop-auth.js`)
   - Generates bcrypt password hashes
   - Updates bookshop `.cdsrc.json` with authentication configuration
   - Creates environment variable files for CI/CD
   - Supports new nested authentication structure

3. **Integration Test Suite** (`__tests__/bookshop/test-mtls-integration.js`)
   - Tests both basic and mTLS authentication flows
   - Validates ORD document generation and structure
   - Provides comprehensive test reporting
   - Follows project code style conventions

4. **GitHub Actions Workflow** (`.github/workflows/integration-test.yml`)
   - Automated testing on push and pull requests
   - Complete environment setup and teardown
   - Artifact collection for debugging

## Authentication Structure Improvements

### New Nested Configuration

The authentication configuration now supports a cleaner, more logical structure:

```json
{
    "authentication": {
        "types": ["mtls", "basic"],
        "basic": {
            "credentials": {
                "admin": "$2a$10$hash..."
            }
        },
        "mtls": {
            "mode": "sap:cmp-mtls",
            "trustedIssuers": ["C=DE,O=SAP,OU=UCL,CN=UCL Certificate Authority"],
            "trustedSubjects": ["C=DE,O=SAP,OU=UCL,CN=ucl-discovery-bot"],
            "decodeBase64Headers": false
        }
    }
}
```

### Backward Compatibility

The system maintains full backward compatibility with the legacy flat structure:

```json
{
    "authentication": {
        "types": ["mtls", "basic"],
        "credentials": {"admin": "$2a$10$hash..."},
        "mtls": {...}
    }
}
```

## Usage

### Local Development

1. **Generate Test Certificates**:
   ```bash
   chmod +x scripts/generate-test-certs.sh
   ./scripts/generate-test-certs.sh
   ```

2. **Setup Authentication Configuration**:
   ```bash
   node scripts/setup-bookshop-auth.js
   ```

3. **Start Bookshop Application**:
   ```bash
   cd __tests__/bookshop
   npm install
   cds run
   ```

4. **Run Integration Tests**:
   ```bash
   node __tests__/bookshop/test-mtls-integration.js
   ```

### CI/CD Pipeline

The GitHub Actions workflow automatically:

1. Sets up Node.js and CAP development environment
2. Generates test certificates and authentication configuration
3. Builds ORD documents for the bookshop application
4. Starts the bookshop CAP application
5. Runs comprehensive integration tests
6. Executes all unit tests
7. Uploads test artifacts for debugging

### Environment Variables

The following environment variables are used:

- `BASE_URL`: Target URL for testing (default: `http://localhost:4004`)
- `TEST_USERNAME`: Username for basic authentication (default: `admin`)
- `TEST_PASSWORD`: Password for basic authentication (default: `test-secret-123`)
- `TRUSTED_ISSUER`: Trusted certificate issuer DN
- `TRUSTED_SUBJECT`: Trusted certificate subject DN
- `ORD_AUTH_TYPE`: Authentication types as JSON array
- `BASIC_AUTH`: Basic authentication credentials as JSON object

## Test Coverage

### Authentication Tests

- **No Authentication**: Verifies endpoints return 401 when no credentials provided
- **Invalid Credentials**: Ensures invalid credentials are rejected
- **Basic Authentication**: Tests username/password authentication flow
- **mTLS Authentication**: Validates certificate-based authentication
- **Response Structure**: Verifies ORD document format and content

### ORD Document Validation

- **Well-Known Endpoint**: Tests `/.well-known/open-resource-discovery`
- **ORD Document Endpoint**: Validates `/ord/v1/documents/ord-document`
- **Resource Structure**: Checks for API resources, packages, entity types
- **Specification Compliance**: Ensures ORD specification adherence

### Server Health Checks

- **Application Startup**: Verifies bookshop application starts correctly
- **Endpoint Availability**: Confirms ORD endpoints are accessible
- **Response Times**: Monitors performance characteristics

## Security Features

### Certificate Management

- **Dynamic Generation**: Certificates created fresh for each test run
- **Proper Validation**: Certificate chain validation and expiration checks
- **Secure Storage**: Certificates stored temporarily and cleaned up
- **No Hardcoded Secrets**: All credentials generated dynamically

### Password Security

- **Bcrypt Hashing**: Industry-standard password hashing with salt
- **Configurable Rounds**: Adjustable hashing complexity
- **Validation**: Hash format validation before use
- **Environment Isolation**: Test credentials separate from production

## Troubleshooting

### Common Issues

1. **Certificate Validation Errors**:
   - Ensure OpenSSL is installed and accessible
   - Check certificate validity dates
   - Verify certificate chain integrity

2. **Authentication Failures**:
   - Confirm bcrypt hashes are valid
   - Check environment variable formatting
   - Verify configuration file structure

3. **Application Startup Issues**:
   - Ensure all dependencies are installed
   - Check port availability (default: 4004)
   - Verify CAP application configuration

### Debug Information

The setup scripts create several debug files:

- `test-config.json`: Complete test configuration
- `test-headers.json`: Sample mTLS headers
- `cert-env.txt`: Certificate environment variables
- `auth-env.txt`: Authentication environment variables

## Development Workflow

### Adding New Tests

1. Follow existing code style conventions (4-space indentation, double quotes)
2. Use descriptive test names and clear error messages
3. Include proper cleanup in test teardown
4. Add documentation for new test scenarios

### Modifying Authentication

1. Update both nested and flat structure support
2. Add backward compatibility tests
3. Update documentation with configuration examples
4. Test with existing applications

### CI/CD Enhancements

1. Add new workflow steps in logical order
2. Include proper error handling and timeouts
3. Upload relevant artifacts for debugging
4. Update retention policies as needed

## Best Practices

### Security

- Never commit certificates or credentials to version control
- Use environment variables for sensitive configuration
- Implement proper certificate rotation in production
- Regular security audits of authentication mechanisms

### Testing

- Test both positive and negative scenarios
- Include edge cases and error conditions
- Validate complete request/response cycles
- Monitor test execution times and reliability

### Maintenance

- Regular updates to certificate validity periods
- Periodic review of authentication configuration
- Updates to match ORD specification changes
- Performance optimization based on metrics

## Integration with Existing Systems

### CAP Framework Integration

- Seamless integration with existing CAP applications
- Minimal configuration changes required
- Backward compatibility with existing deployments
- Standard CAP authentication patterns

### Enterprise Deployment

- Supports enterprise certificate authorities
- Configurable for various deployment environments
- Scalable authentication mechanisms
- Comprehensive logging and monitoring

This integration testing framework provides a robust foundation for validating ORD plugin functionality across various authentication scenarios while maintaining security best practices and development workflow efficiency.
