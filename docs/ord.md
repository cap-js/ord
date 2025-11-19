# Customizing the ORD Document

The CAP-JS ORD plugin automatically generates all values in the ORD document by default. However, you can customize or override this behavior in two main ways:

---

## 1. Overriding Global Application Information

Global settings can be defined using the `present configuration` in your `cdsrc.json` or `package.json` file under the `ord` section.

**Example:**

```json
{
    "ord": {
        "namespace": "sap.sample",
        "description": "This is my custom description",
        "policyLevels": ["sap:core:v1"]
    }
}
```

---

## 2. Overriding Service-Level Information

Service-specific data can be added or overwritten using annotations in your `.cds` files with `@ORD.Extensions`.

**Example:**

```js
annotate ProcessorService with @ORD.Extensions: {
    title: 'This is Processor Service title',
    industry: [
        'Retail',
        'Consumer Products'
    ],
    lineOfBusiness: ['Sales'],
    extensible: { supported: 'no' }
};
```

> **Note:**
> Standard annotations like `@Core.Description` and `@description` are also automatically read by the plugin.

---

# Adding Custom ORD Content

The ORD plugin allows adding **custom ORD content** via the `customOrdContentFile` setting in `cdsrc.json`.

The override priority is as follows:

```js
customOrdContent > ORD.Extensions Annotations > CAP Annotations > Plugin Defaults
```

**Example configuration:**

```json
{
    "ord": {
        "namespace": "sap.sample",
        "description": "This is my custom description",
        "policyLevels": ["sap:core:v1"],
        "customOrdContentFile": "./path/to/custom.ord.json"
    }
}
```

---

## Custom ORD File Structure

In your custom ORD file, you can:

- Add new ORD resources (e.g., `dataProducts`) not supported by CAP.
- Enhance existing generated resources (e.g., add a new `package` or an API resource).
- Patch default generated resources:
    - Override properties.
    - Add new properties.
    - Delete properties by setting them to `null`.

**Example `custom.ord.json`:**

```json
{
    "packages": [
        {
            "description": null,
            "packageLinks": [
                {
                    "type": "terms-of-service",
                    "url": "https://www.sap.com/corporate/en/legal/terms-of-use.html"
                }
            ],
            "lineOfBusiness": ["Sales"]
        }
    ],
    "dataProducts": [
        {
            "ordId": "sap.sm:dataProduct:Supplier:v1"
            // ...
        }
    ]
}
```

---

# Adding Products

You can define product relationships within the ORD document following these rules:

## 1. Using an Existing SAP Product

To associate your resources with an existing SAP product, define `existingProductORDId` in `cdsrc.json`.

**Example:**

```json
{
    "ord": {
        "namespace": "sap.sample",
        "description": "This is my custom description",
        "policyLevels": ["sap:core:v1"],
        "customOrdContentFile": "./ord/custom.ord.json",
        "existingProductORDId": "sap:product:SAPServiceCloudV2:"
    }
}
```

> In this case, the ORD document will **not** contain a `products` root property. Instead, `packages` will be assigned to the specified product via `partOfProducts`.

**Example package entry:**

```json
{
    "ordId": "sap.sample:package:capireordsample-api:v1",
    "title": "Capire ORD Sample",
    "shortDescription": "Package containing public APIs",
    "description": "This package contains public APIs for Capire ORD Sample.",
    "version": "1.0.0",
    "partOfProducts": ["sap:product:SAPServiceCloudV2:"],
    "vendor": "sap:vendor:SAP:"
}
```

---

## 2. Defining a Non-SAP Product

If defining a **custom product**, make sure its `ordId` **does not** start with `sap`. (The plugin validates this.)

**Example:**

```json
{
    "ord": {
        "namespace": "sap.sample",
        "description": "This is my custom description",
        "policyLevels": ["sap:core:v1"],
        "customOrdContentFile": "./ord/custom.ord.json",
        "products": [
            {
                "ordId": "customer:product:eb.bm.tests:",
                "vendor": "sap:vendor:SAP:"
            }
        ]
    }
}
```

If the product `ordId` is invalid, the plugin will fall back to using a default value.

---

## 3. No Product Settings

If no explicit product settings are provided, the plugin will automatically apply its default behavior.

---

# Summary

| Scenario                         | Approach                                          |
| -------------------------------- | ------------------------------------------------- |
| Global Metadata                  | Define in `cdsrc.json` under `ord`                |
| Service Metadata                 | Use `@ORD.Extensions` annotations in `.cds` files |
| Custom ORD Content               | Use `customOrdContentFile`                        |
| Linking to Existing SAP Products | Use `existingProductORDId`                        |
| Defining Custom Products         | Add `products` section manually                   |

---

# Parameters

### `defaultVisibility`

The `defaultVisibility` property sets the default visibility for resources generated in the ORD document.
Possible values include `"public"`, `"internal"`, or `"private"`.
If not specified, the plugin uses its built-in default.

**Example:**

```json
{
    "ord": {
        "namespace": "sap.sample",
        "description": "This is my custom description",
        "policyLevels": ["sap:core:v1"],
        "defaultVisibility": "public"
    }
}
```

> **Note:** You can override visibility for individual resources using service-level annotations or custom ORD content.

---

# Authentication

The ORD plugin supports multiple authentication mechanisms to protect ORD endpoints and metadata.

## UCL mTLS Authentication

UCL (Unified Customer Landscape) mTLS authentication enables secure machine-to-machine communication between ORD aggregators and ORD providers using client certificate validation.

### Overview

UCL mTLS authentication uses mutual TLS (mTLS) where:

1. **TLS Termination & Certificate Validation**: Handled by the front proxy (Cloud Foundry gorouter or API Gateway)
   - Verifies the certificate chain
   - Validates the certificate issuer
   - Ensures the certificate is not expired or revoked

2. **Subject Validation**: Handled by this ORD plugin
   - Validates the client certificate Subject (Distinguished Name) against a configured whitelist
   - Uses order-insensitive comparison as per UCL specification
   - Returns HTTP 401 (Unauthorized) for missing certificates
   - Returns HTTP 403 (Forbidden) for invalid Subject values

**Important**: This implementation assumes you're running in Cloud Foundry or a similar environment where the front proxy handles TLS termination and forwards certificate information via HTTP headers.

### Configuration

UCL mTLS can be configured via `cdsrc.json` or environment variables.

#### Via cdsrc.json

```json
{
    "authentication": {
        "types": ["ucl-mtls"],
        "clientCertificateHeader": "x-forwarded-client-cert"
    },
    "ord": {
        "uclMtls": {
            "expectedSubjects": [
                "CN=ord-aggregator, O=SAP SE, L=Walldorf, C=DE",
                "CN=backup-aggregator, O=SAP SE, C=US"
            ]
        }
    }
}
```

#### Via Environment Variables

```bash
# Set authentication type to UCL mTLS
export ORD_AUTH_TYPE='["ucl-mtls"]'

# Configure expected certificate subjects (comma-separated)
export ORD_UCL_MTLS_EXPECTED_SUBJECTS="CN=ord-aggregator, O=SAP SE, L=Walldorf, C=DE,CN=backup-aggregator, O=SAP SE, C=US"

# Optionally override the header name (defaults to x-forwarded-client-cert)
export ORD_UCL_MTLS_SUBJECT_HEADER="x-forwarded-client-cert"
```

### Configuration Parameters

| Parameter | Environment Variable | cds.env Path | Default | Description |
|-----------|---------------------|--------------|---------|-------------|
| Authentication Type | `ORD_AUTH_TYPE` | `authentication.types` | - | Must include `"ucl-mtls"` |
| Expected Subjects | `ORD_UCL_MTLS_EXPECTED_SUBJECTS` | `ord.uclMtls.expectedSubjects` | - | **Required**. Array or comma-separated list of allowed certificate subjects |
| Header Name | `ORD_UCL_MTLS_SUBJECT_HEADER` | `security.authentication.clientCertificateHeader` | `x-forwarded-client-cert` | HTTP header containing certificate info |

### Subject Validation Rules

The plugin validates certificate subjects according to the UCL mTLS specification (`sap:cmp-mtls:v1`):

1. **Order-Insensitive**: Token order in the Distinguished Name doesn't matter
   - `"CN=test, O=SAP SE, C=DE"` matches `"C=DE, O=SAP SE, CN=test"`

2. **Whitespace Normalization**: Extra spaces are trimmed from each token
   - `"CN=test, O=SAP SE, C=DE"` matches `"CN=test,O=SAP SE,C=DE"`

3. **Exact Token Match**: All tokens must match exactly (set equality)
   - `"CN=test, O=SAP SE"` does NOT match `"CN=test, O=SAP SE, C=DE"`

4. **Multiple Subjects**: You can configure multiple allowed subjects
   - Any matching subject grants access

### Certificate Header Formats

The plugin handles two common certificate header formats:

#### XFCC (X-Forwarded-Client-Cert) Format

Cloud Foundry gorouter and many API gateways use this format:

```
Hash=abc123,Subject="CN=ord-aggregator, O=SAP SE, C=DE",URI=spiffe://example.com,Issuer="CN=Root CA"
```

The plugin automatically extracts the Subject field from XFCC headers.

#### Raw DN Format

Some environments forward just the Distinguished Name:

```
CN=ord-aggregator, O=SAP SE, L=Walldorf, C=DE
```

The plugin handles both formats automatically.

### Combining with Other Authentication Methods

UCL mTLS can be combined with Basic authentication to support multiple client types:

```json
{
    "authentication": {
        "types": ["basic", "ucl-mtls"],
        "credentials": {
            "admin": "$2a$10$..."
        }
    },
    "ord": {
        "uclMtls": {
            "expectedSubjects": [
                "CN=ord-aggregator, O=SAP SE, C=DE"
            ]
        }
    }
}
```

**Note**: You cannot combine `"open"` authentication with any other type.

### HTTP Status Codes

| Status Code | Reason | Description |
|-------------|--------|-------------|
| 200 OK | Valid certificate | Subject matches one of the expected subjects |
| 401 Unauthorized | Missing certificate or subject | Client certificate header is missing or doesn't contain a valid Subject |
| 403 Forbidden | Invalid subject | Certificate is present but Subject doesn't match any expected value |

### Security Considerations

1. **Header Trust**: This implementation trusts the certificate information forwarded in HTTP headers. Ensure your infrastructure prevents header spoofing (e.g., Cloud Foundry strips and overwrites these headers).

2. **TLS at the Edge**: Always terminate TLS at a trusted proxy/gateway that performs full certificate validation before forwarding to your application.

3. **Subject Whitelist**: Keep your expected subjects list minimal and up-to-date. Remove subjects for decommissioned aggregators.

4. **Logging**: Failed authentication attempts are logged with the received Subject (on mismatch) for security auditing.

### Troubleshooting

#### "UCL mTLS requires expectedSubjects configuration"

**Cause**: The `expectedSubjects` array is missing or empty.

**Solution**: Configure at least one expected subject via `cds.env.ord.uclMtls.expectedSubjects` or the `ORD_UCL_MTLS_EXPECTED_SUBJECTS` environment variable.

#### "Client certificate authentication required" (401)

**Cause**: The certificate header is missing from the request.

**Solution**: 
- Verify the client is sending a valid certificate
- Check that your proxy is forwarding certificate information
- Verify the header name matches your configuration

#### "Forbidden: Invalid client certificate" (403)

**Cause**: The certificate Subject doesn't match any expected value.

**Solution**:
- Check the application logs for the actual Subject received
- Verify the Subject format matches your configuration exactly
- Remember that all DN tokens must match (not just CN)

### ORD Access Strategy

When UCL mTLS is configured, the plugin automatically adds `"sap:cmp-mtls:v1"` to the `accessStrategies` in the generated ORD document, indicating that resources are protected by UCL mTLS authentication.

---

# Ord Root Property

More information, see [ord document](https://pages.github.tools.sap/CentralEngineering/open-resource-discovery-specification/spec-v1/interfaces/document)
