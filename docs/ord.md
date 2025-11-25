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

## CF mTLS Authentication

CF (Cloud Foundry) mTLS authentication provides secure machine-to-machine communication in SAP BTP Cloud Foundry environments using client certificate validation with enhanced security checks.

### Overview

CF mTLS authentication uses mutual TLS (mTLS) with comprehensive certificate validation:

1. **TLS Termination & Certificate Validation**: Handled by the CloudFoundry gorouter
   - Verifies the certificate chain
   - Validates the certificate issuer
   - Ensures the certificate is not expired or revoked
   - Forwards certificate information via base64-encoded HTTP headers

2. **Certificate Information Validation**: Handled by this ORD plugin
   - Validates Issuer DN (Distinguished Name)
   - Validates Subject DN
   - Validates Root CA DN
   - Requires Issuer + Subject to match as a pair
   - Returns HTTP 401 (Unauthorized) for missing certificates
   - Returns HTTP 403 (Forbidden) for invalid certificate information
   - Returns HTTP 400 (Bad Request) for malformed headers

**Important**: This implementation is designed for SAP BTP Cloud Foundry environments where the gorouter terminates TLS and forwards certificate information via three separate base64-encoded headers.

### Configuration

CF mTLS can be configured via `cdsrc.json` or environment variables.

#### Via cdsrc.json

```json
{
    "authentication": {
        "types": ["cf-mtls"]
    },
    "ord": {
        "cfMtls": {
            "trustedCertPairs": [
                {
                    "issuer": "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                    "subject": "CN=ord-aggregator, O=SAP SE, C=DE"
                },
                {
                    "issuer": "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                    "subject": "CN=backup-aggregator, O=SAP SE, C=US"
                }
            ],
            "trustedRootCaDns": [
                "CN=SAP Global Root CA, O=SAP SE, C=DE",
                "CN=DigiCert Global Root CA, O=DigiCert Inc, C=US"
            ],
            "headerNames": {
                "issuer": "x-forwarded-client-cert-issuer-dn",
                "subject": "x-forwarded-client-cert-subject-dn",
                "rootCa": "x-forwarded-client-cert-root-ca-dn"
            }
        }
    }
}
```

#### Via Environment Variables

```bash
# Set authentication type to CF mTLS
export ORD_AUTH_TYPE='["cf-mtls"]'

# Configure trusted certificate pairs (JSON format)
export CF_MTLS_TRUSTED_CERT_PAIRS='[
  {
    "issuer": "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
    "subject": "CN=ord-aggregator, O=SAP SE, C=DE"
  },
  {
    "issuer": "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
    "subject": "CN=backup-aggregator, O=SAP SE, C=US"
  }
]'

# Configure trusted root CA DNs (JSON format)
export CF_MTLS_TRUSTED_ROOT_CA_DNS='[
  "CN=SAP Global Root CA, O=SAP SE, C=DE",
  "CN=DigiCert Global Root CA, O=DigiCert Inc, C=US"
]'

# Optional: Override header names (defaults shown below)
# export CF_MTLS_HEADER_ISSUER=x-forwarded-client-cert-issuer-dn
# export CF_MTLS_HEADER_SUBJECT=x-forwarded-client-cert-subject-dn
# export CF_MTLS_HEADER_ROOT_CA=x-forwarded-client-cert-root-ca-dn
```

### Configuration Parameters

| Parameter | Environment Variable | cds.env Path | Default | Description |
|-----------|---------------------|--------------|---------|-------------|
| Authentication Type | `ORD_AUTH_TYPE` | `authentication.types` | - | Must include `"cf-mtls"` |
| Trusted Cert Pairs | `CF_MTLS_TRUSTED_CERT_PAIRS` | `ord.cfMtls.trustedCertPairs` | - | **Required**. Array of issuer/subject pairs |
| Trusted Root CAs | `CF_MTLS_TRUSTED_ROOT_CA_DNS` | `ord.cfMtls.trustedRootCaDns` | - | **Required**. Array of trusted root CA DNs |
| Issuer Header | `CF_MTLS_HEADER_ISSUER` | `ord.cfMtls.headerNames.issuer` | `x-forwarded-client-cert-issuer-dn` | Header containing issuer DN |
| Subject Header | `CF_MTLS_HEADER_SUBJECT` | `ord.cfMtls.headerNames.subject` | `x-forwarded-client-cert-subject-dn` | Header containing subject DN |
| Root CA Header | `CF_MTLS_HEADER_ROOT_CA` | `ord.cfMtls.headerNames.rootCa` | `x-forwarded-client-cert-root-ca-dn` | Header containing root CA DN |

### Certificate Validation Rules

The plugin validates certificates according to the CF mTLS specification (`sap:cmp-mtls:v1`):

1. **Pair Validation**: Issuer and Subject must match together as a configured pair
   - You cannot have valid issuer with wrong subject or vice versa
   - Both must match one of the configured pairs

2. **Root CA Validation**: Root CA DN must match one of the trusted root CAs
   - Provides additional security layer
   - Ensures certificate is from a trusted authority chain

3. **Order-Insensitive DN Comparison**: Token order in Distinguished Names doesn't matter
   - `"CN=test, O=SAP SE, C=DE"` matches `"C=DE, O=SAP SE, CN=test"`

4. **Whitespace Normalization**: Extra spaces are trimmed from each token
   - `"CN=test, O=SAP SE, C=DE"` matches `"CN=test,O=SAP SE,C=DE"`

5. **Exact Token Match**: All tokens must match exactly (set equality)
   - `"CN=test, O=SAP SE"` does NOT match `"CN=test, O=SAP SE, C=DE"`

### Certificate Headers

The CloudFoundry gorouter forwards certificate information via three separate base64-encoded headers:

| Header | Content | Encoding |
|--------|---------|----------|
| `x-forwarded-client-cert-issuer-dn` | Certificate Issuer DN | Base64 |
| `x-forwarded-client-cert-subject-dn` | Certificate Subject DN | Base64 |
| `x-forwarded-client-cert-root-ca-dn` | Root CA DN | Base64 |

**Example header values:**

```
x-forwarded-client-cert-issuer-dn: Q049U0FQIENsb3VkIFBsYXRmb3JtIENsaWVudCBDQSwgTz1TQVAgU0UsIEM9REU=
x-forwarded-client-cert-subject-dn: Q049YWdncmVnYXRvciwgTz1TQVAgU0UsIEM9REU=
x-forwarded-client-cert-root-ca-dn: Q049U0FQIEdsb2JhbCBSb290IENBLCBPPU5BUCBTRSwgQz1ERQ==
```

These decode to:
```
Issuer:  CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE
Subject: CN=aggregator, O=SAP SE, C=DE
Root CA: CN=SAP Global Root CA, O=SAP SE, C=DE
```

### Combining with Other Authentication Methods

CF mTLS can be combined with Basic authentication to support multiple client types:

```json
{
    "authentication": {
        "types": ["basic", "cf-mtls"],
        "credentials": {
            "admin": "$2a$10$..."
        }
    },
    "ord": {
        "cfMtls": {
            "trustedCertPairs": [
                {
                    "issuer": "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                    "subject": "CN=ord-aggregator, O=SAP SE, C=DE"
                }
            ],
            "trustedRootCaDns": [
                "CN=SAP Global Root CA, O=SAP SE, C=DE"
            ]
        }
    }
}
```

**Note**: You cannot combine `"open"` authentication with any other type.

### HTTP Status Codes

| Status Code | Reason | Description |
|-------------|--------|-------------|
| 200 OK | Valid certificate | Certificate pair and root CA match configuration |
| 400 Bad Request | Invalid encoding | Certificate headers are not properly base64-encoded |
| 401 Unauthorized | Missing headers | One or more required certificate headers are missing |
| 403 Forbidden | Certificate pair mismatch | Issuer/Subject pair doesn't match any configured pair |
| 403 Forbidden | Root CA mismatch | Root CA DN doesn't match any trusted root CA |

### Security Considerations

1. **Header Trust**: This implementation trusts the certificate information forwarded in HTTP headers. SAP BTP Cloud Foundry gorouter ensures these headers are secure and cannot be spoofed.

2. **TLS at the Edge**: The CloudFoundry gorouter terminates TLS and performs full certificate validation before forwarding requests to your application.

3. **Certificate Pair Whitelist**: Keep your certificate pairs list minimal and up-to-date. Remove pairs for decommissioned clients.

4. **Root CA Validation**: Always configure trusted root CAs to ensure certificates come from authorized certificate authorities.

5. **Logging**: Failed authentication attempts are logged with certificate details for security auditing.

### Troubleshooting

#### "CF mTLS requires trustedCertPairs configuration"

**Cause**: The `trustedCertPairs` array is missing or empty.

**Solution**: Configure at least one certificate pair via `cds.env.ord.cfMtls.trustedCertPairs` or the `CF_MTLS_TRUSTED_CERT_PAIRS` environment variable.

#### "CF mTLS requires trustedRootCaDns configuration"

**Cause**: The `trustedRootCaDns` array is missing or empty.

**Solution**: Configure at least one trusted root CA via `cds.env.ord.cfMtls.trustedRootCaDns` or the `CF_MTLS_TRUSTED_ROOT_CA_DNS` environment variable.

#### "Client certificate authentication required" (401)

**Cause**: One or more certificate headers are missing from the request.

**Solution**: 
- Verify the client is sending a valid certificate
- Check that the CloudFoundry gorouter is forwarding certificate information
- Verify the header names match your configuration

#### "Bad Request: Invalid certificate headers" (400)

**Cause**: Certificate headers are not properly base64-encoded.

**Solution**:
- Ensure headers are base64-encoded
- Verify the CloudFoundry gorouter is configured correctly
- Check for header corruption during transmission

#### "Forbidden: Invalid client certificate" (403)

**Cause**: The certificate issuer/subject pair doesn't match any configured pair.

**Solution**:
- Check the application logs for the actual Issuer and Subject received
- Verify both issuer and subject are configured as a pair
- Remember that all DN tokens must match (not just CN)

#### "Forbidden: Untrusted certificate authority" (403)

**Cause**: The root CA DN doesn't match any trusted root CA.

**Solution**:
- Check the application logs for the actual Root CA DN received
- Add the root CA to your trusted list if legitimate
- Verify the certificate chain is correct

### ORD Access Strategy

When CF mTLS is configured, the plugin automatically adds `"sap:cmp-mtls:v1"` to the `accessStrategies` in the generated ORD document, indicating that resources are protected by CF mTLS authentication.

---

# Ord Root Property

More information, see [ord document](https://pages.github.tools.sap/CentralEngineering/open-resource-discovery-specification/spec-v1/interfaces/document)
