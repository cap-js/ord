# CAP-JS ORD Plugin Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Configuration](#configuration)
    - [Global Application Settings](#1-overriding-global-application-information)
    - [Service-Level Customization](#2-overriding-service-level-information)
3. [Custom ORD Content](#adding-custom-ord-content)
4. [Products](#adding-products)
    - [Using Existing SAP Products](#1-using-an-existing-sap-product)
    - [Defining Custom Products](#2-defining-a-non-sap-product)
5. [Authentication](#authentication)
    - [CF mTLS Authentication](#cf-mtls-authentication)
6. [Parameters](#parameters)
7. [ORD Root Properties](#ord-root-property)

---

## Introduction

The CAP-JS ORD plugin automatically generates Open Resource Discovery (ORD) documents for your CAP applications. This documentation covers how to customize and configure the plugin to meet your specific needs.

---

## Configuration

### 1. Overriding Global Application Information

Global settings can be defined using the `present configuration` in your `.cdsrc.json` or `package.json` file under the `ord` section.

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

### 2. Overriding Service-Level Information

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

## Adding Custom ORD Content

The ORD plugin allows adding **custom ORD content** via the `customOrdContentFile` setting in `.cdsrc.json`.

The override priority is as follows:

```
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

### Custom ORD File Structure

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

## Adding Products

You can define product relationships within the ORD document following these rules:

### 1. Using an Existing SAP Product

To associate your resources with an existing SAP product, define `existingProductORDId` in `.cdsrc.json`.

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

### 2. Defining a Non-SAP Product

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

### 3. No Product Settings

If no explicit product settings are provided, the plugin will automatically apply its default behavior.

---

## Authentication

The ORD plugin supports multiple authentication mechanisms to protect ORD endpoints and metadata.

### CF mTLS Authentication

CF (Cloud Foundry) mTLS authentication provides secure machine-to-machine communication in SAP BTP Cloud Foundry environments using client certificate validation.

> **⚠️ Environment Requirement**
>
> This mTLS implementation is **specifically designed for SAP BTP Cloud Foundry environments**. It relies on the CloudFoundry gorouter to terminate TLS and forward certificate information via HTTP headers.

---

#### Quick Start

CF mTLS requires two configuration steps:

**Step 1: Enable in `.cdsrc.json`**

```json
{
    "ord": {
        "authentication": {
            "cfMtls": true
        }
    }
}
```

**Step 2: Provide configuration via environment variable**

Choose one of the following options based on your use case:

**Option A: Dynamic Certificates (UCL)**

Use this when connecting to SAP UCL (Unified Customer Landscape):

```bash
export CF_MTLS_TRUSTED_CERTS='{
  "configEndpoints": ["https://your-ucl-endpoint/v1/info"],
  "rootCaDn": ["CN=SAP Cloud Root CA,O=SAP SE,L=Walldorf,C=DE"]
}'
```

**Option B: Custom Certificates**

Use this when using your own certificates:

```bash
export CF_MTLS_TRUSTED_CERTS='{
  "certs": [{"issuer": "CN=My CA,O=MyOrg", "subject": "CN=my-service,O=MyOrg"}],
  "rootCaDn": ["CN=My Root CA,O=MyOrg"]
}'
```

---

#### Configuration Reference

| Field             | Required | Description                                                 |
| ----------------- | -------- | ----------------------------------------------------------- |
| `certs`           | No\*     | Array of `{issuer, subject}` certificate pairs to trust     |
| `rootCaDn`        | **Yes**  | Array of trusted root CA Distinguished Names                |
| `configEndpoints` | No       | Array of URLs to fetch certificates dynamically (e.g., UCL) |

\* `certs` can be omitted when `configEndpoints` is provided.

> **Security Note**: `rootCaDn` is never fetched from endpoints. It must always be configured statically.

---

#### How It Works

1. **TLS Termination**: The CloudFoundry gorouter terminates TLS and validates the client certificate chain
2. **Header Forwarding**: Certificate information is forwarded via base64-encoded HTTP headers
3. **Validation**: This plugin validates the certificate issuer/subject pair and root CA DN against the configured allow list

**Certificate Headers** (set by CF gorouter):

| Header                    | Content                         |
| ------------------------- | ------------------------------- |
| `x-ssl-client-issuer-dn`  | Certificate Issuer DN (base64)  |
| `x-ssl-client-subject-dn` | Certificate Subject DN (base64) |
| `x-ssl-client-root-ca-dn` | Root CA DN (base64)             |

---

#### Validation Rules

- **Pair Validation**: Issuer and Subject must match together as a configured pair
- **Root CA Validation**: Root CA DN must match one of the trusted root CAs
- **Order-Insensitive**: `"CN=test, O=SAP SE"` matches `"O=SAP SE, CN=test"`
- **Whitespace-Tolerant**: Extra spaces are normalized

---

#### HTTP Status Codes

| Status           | Reason                                  |
| ---------------- | --------------------------------------- |
| 200 OK           | Valid certificate                       |
| 400 Bad Request  | Invalid header encoding                 |
| 401 Unauthorized | Missing certificate headers             |
| 403 Forbidden    | Certificate pair or root CA not trusted |

---

#### Development Configuration

For local development and testing, you can configure the full mTLS settings in `.cdsrc.json`:

```json
{
    "ord": {
        "authentication": {
            "cfMtls": {
                "certs": [
                    {
                        "issuer": "CN=Test CA,O=MyOrg,C=DE",
                        "subject": "CN=test-client,O=MyOrg,C=DE"
                    }
                ],
                "rootCaDn": ["CN=Test Root CA,O=MyOrg,C=DE"]
            }
        }
    }
}
```

> **⚠️ Security Warning**: Avoid putting production certificate configurations in `.cdsrc.json` as it may be committed to source control. Use environment variables for production.

---

#### Combining with Basic Authentication

CF mTLS can be combined with Basic authentication:

```json
{
    "ord": {
        "authentication": {
            "basic": {
                "credentials": {
                    "admin": "$2a$10$..."
                }
            },
            "cfMtls": true
        }
    }
}
```

When both are configured, the plugin tries each authentication method in order until one succeeds.

---

#### Error Handling

**Endpoint-Related Errors:**

- **Endpoint Fetch Failure**: If all endpoints fail and no static configuration exists, service startup will fail
- **Partial Endpoint Failure**: If some endpoints fail but others succeed (or static config exists), service continues
- **Invalid Response Format**: Endpoints returning invalid JSON are logged and skipped
- **Timeout**: Endpoints that don't respond within 10 seconds are skipped

**Runtime Auth Errors:**

- Invalid certificates receive 401/403 responses with appropriate error messages
- Failed authentication attempts are logged with certificate details for security auditing

---

#### Security Considerations

1. **Header Trust**: This implementation trusts the certificate information forwarded in HTTP headers. SAP BTP Cloud Foundry gorouter ensures these headers are secure and cannot be spoofed.

2. **TLS at the Edge**: The CloudFoundry gorouter terminates TLS and performs full certificate validation before forwarding requests to your application.

3. **Certificate Pair Whitelist**: Keep your certificate pairs list minimal and up-to-date. Remove pairs for decommissioned clients.

4. **Root CA Validation**: Always configure trusted root CAs to ensure certificates come from authorized certificate authorities.

5. **Root CA Trust**: Root CA DNs are NEVER fetched from endpoints, only from static configuration. This is a security-by-design decision.

6. **No Cryptographic Validation**: This module validates DN strings only, not actual certificates. Cryptographic validation is handled by the CF router.

7. **Logging**: Failed authentication attempts are logged with certificate details for security auditing.

---

#### Troubleshooting

##### "CF mTLS requires at least one certificate pair"

**Cause**: After merging static configuration and endpoint responses, no certificate pairs were available. This can happen when:

- The `certs` array is empty or omitted
- All `configEndpoints` failed to load certificates
- No endpoints were configured and no static `certs` were provided

**Solution**:

- Configure at least one certificate pair via `cds.env.ord.cfMtls.certs` or the `CF_MTLS_TRUSTED_CERTS` environment variable, OR
- Ensure at least one `configEndpoint` is reachable and returns valid certificate information, OR
- Use a combination of both static and dynamic configuration

##### "CF mTLS requires at least one root CA DN"

**Cause**: The `rootCaDn` array is missing or empty.

**Solution**: Configure at least one trusted root CA via `cds.env.ord.cfMtls.rootCaDn` or the `CF_MTLS_TRUSTED_CERTS` environment variable.

##### "Client certificate authentication required" (401)

**Cause**: One or more certificate headers are missing from the request.

**Solution**:

- Verify the client is sending a valid certificate
- Check that the CloudFoundry gorouter is forwarding certificate information
- Verify the header names match your configuration

##### "Bad Request: Invalid certificate headers" (400)

**Cause**: Certificate headers are not properly base64-encoded.

**Solution**:

- Ensure headers are base64-encoded
- Verify the CloudFoundry gorouter is configured correctly
- Check for header corruption during transmission

##### "Forbidden: Invalid client certificate" (403)

**Cause**: The certificate issuer/subject pair doesn't match any configured pair.

**Solution**:

- Check the application logs for the actual Issuer and Subject received
- Verify both issuer and subject are configured as a pair
- Remember that all DN tokens must match (not just CN)

##### "Forbidden: Untrusted certificate authority" (403)

**Cause**: The root CA DN doesn't match any trusted root CA.

**Solution**:

- Check the application logs for the actual Root CA DN received
- Add the root CA to your trusted list if legitimate
- Verify the certificate chain is correct

##### Endpoint Fetch Issues

**Symptom**: Logs show "Failed to fetch mTLS cert from [endpoint]"

**Solutions**:

- Verify endpoint URL is correct and accessible
- Check network connectivity from your application
- Ensure endpoint returns valid JSON in the expected format
- Check endpoint timeout settings (default 10 seconds)
- Verify endpoint authentication if required

##### "This implementation requires SAP BTP Cloud Foundry"

**Symptom**: mTLS authentication not working in non-CF environments

**Cause**: This implementation relies on CloudFoundry gorouter-specific headers that are not available in other environments.

**Solution**:

- If you're using SAP BTP Cloud Foundry: Ensure mTLS is enabled in your space and routes are configured correctly
- If you're using other environments (AWS, Azure, Kubernetes, etc.): This implementation will not work. You need to:
    - Use standard Node.js TLS (`req.socket.getPeerCertificate()`) if your app terminates TLS
    - Parse standard XFCC headers if using Istio/Envoy
    - Implement custom header parsing for your specific reverse proxy
    - Consider using a different authentication mechanism (OAuth2, API keys, etc.)

---

#### FAQ

##### Do I need to configure `configEndpoints`?

**No.** The `configEndpoints` feature is completely optional. Static configuration via `certs` array is sufficient for most use cases and is recommended for development and testing environments.

##### Can I use this in Kubernetes without Cloud Foundry?

**No.** This implementation is specifically designed for SAP BTP Cloud Foundry and relies on CF gorouter-specific headers. For Kubernetes environments, you'll need a different mTLS implementation.

##### Can I use this with NGINX or HAProxy?

**No.** This implementation expects specific header names and formats used by the CloudFoundry gorouter. Other reverse proxies use different header formats.

##### Why can't I fetch `rootCaDn` from endpoints?

**Security.** Root CAs define which certificate authorities you trust. This must be explicitly configured in your application, not fetched from external sources that could potentially be compromised.

##### Can I combine static and dynamic certificate configuration?

**Yes!** You can configure both static `certs` and `configEndpoints`. Certificates from all sources will be merged together.

##### What happens if all my `configEndpoints` fail?

If you have static `certs` configured, authentication will continue using those certificates. If you have no static certificates and all endpoints fail, the service startup will fail to ensure security.

##### How often are `configEndpoints` refreshed?

Endpoints are fetched once during service startup. To refresh certificates, you need to restart the application.

##### Can I use environment variables in production?

**Yes.** The `CF_MTLS_TRUSTED_CERTS` environment variable is designed for production use and follows 12-Factor App principles. Use `.cdsrc.json` only for development and environment variables for production.

---

#### Logging

The implementation provides detailed logging for monitoring and debugging:

```
INFO: Fetching mTLS trusted certificates from 2 endpoint(s)...
INFO: Successfully fetched mTLS cert info from https://config1.example.com/mtls-info
ERROR: Failed to fetch mTLS cert from https://config2.example.com/mtls-info: Network error
INFO: Merged mTLS config: 3 certificate pair(s), 2 root CA DN(s)
INFO: Loaded 3 trusted certificate pair(s) and 2 trusted root CA DN(s)
```

---

#### ORD Access Strategy

When CF mTLS is configured, the plugin automatically adds `"sap:cmp-mtls:v1"` to the `accessStrategies` in the generated ORD document, indicating that resources are protected by CF mTLS authentication.

---

## Parameters

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

## ORD Root Property

More information, see [ORD Document specification](https://pages.github.tools.sap/CentralEngineering/open-resource-discovery-specification/spec-v1/interfaces/document)

---

## Summary

| Scenario                         | Approach                                                                |
| -------------------------------- | ----------------------------------------------------------------------- |
| Global Metadata                  | Define in `.cdsrc.json` under `ord`                                     |
| Service Metadata                 | Use `@ORD.Extensions` annotations in `.cds` files                       |
| Custom ORD Content               | Use `customOrdContentFile`                                              |
| Linking to Existing SAP Products | Use `existingProductORDId`                                              |
| Defining Custom Products         | Add `products` section manually                                         |
| Basic Authentication             | Configure `ord.authentication.basic`                                    |
| CF mTLS Authentication           | Set `ord.authentication.cfMtls: true` + `CF_MTLS_TRUSTED_CERTS` env var |
