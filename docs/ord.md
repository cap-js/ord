# CAP-JS ORD Plugin Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Configuration](#configuration)
    - [Global Application Settings](#1-overriding-global-application-information)
    - [Service-Level Customization](#2-overriding-service-level-information)
    - [OpenAPI Servers](#3-openapi-servers-configuration)
3. [Custom ORD Content](#adding-custom-ord-content)
4. [Products](#adding-products)
    - [Using Existing SAP Products](#1-using-an-existing-sap-product)
    - [Defining Custom Products](#2-defining-a-non-sap-product)
5. [Authentication](#authentication)
    - [CF mTLS Authentication](#cf-mtls-authentication)
6. [Parameters](#parameters)
7. [ORD Root Properties](#ord-root-property)
8. [Importing External Data Products](#importing-external-data-products)

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

### 3. OpenAPI Servers Configuration

Use `@OpenAPI.servers` to add production URLs to generated OpenAPI documents (for SAP Business Accelerator Hub "Try Out" feature):

```js
annotate MyService with @OpenAPI.servers: [
    { url: 'https://my-service.api.sap.com', description: 'Production' }
];
```

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

#### Production Configuration (Recommended)

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

**Option A: UCL Integration (Recommended)**

For SAP UCL (Unified Customer Landscape) integration:

```bash
export CF_MTLS_TRUSTED_CERTS='{
  "configEndpoints": ["https://your-ucl-endpoint/v1/info"],
  "rootCaDn": ["CN=SAP Cloud Root CA,O=SAP SE,L=Walldorf,C=DE"]
}'
```

**Option B: Custom Certificates**

For custom certificates without UCL:

```bash
export CF_MTLS_TRUSTED_CERTS='{
  "certs": [{"issuer": "CN=My CA,O=MyOrg", "subject": "CN=my-service,O=MyOrg"}],
  "rootCaDn": ["CN=My Root CA,O=MyOrg"]
}'
```

---

#### Development Configuration

For local development and testing, configure the full mTLS settings in `.cdsrc.json`:

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

#### Configuration Reference

| Field             | Required                              | Description                                                 |
| ----------------- | ------------------------------------- | ----------------------------------------------------------- |
| `certs`           | Yes (unless `configEndpoints` is set) | Array of `{issuer, subject}` certificate pairs to trust     |
| `rootCaDn`        | **Yes**                               | Array of trusted root CA Distinguished Names                |
| `configEndpoints` | No                                    | Array of URLs to fetch certificates dynamically (e.g., UCL) |

> **Note**: When `configEndpoints` is configured, `certs` will be fetched from those endpoints. `rootCaDn` is never fetched from endpoints and must always be configured statically.

---

#### HTTP Status Codes

| Status           | Reason                                  |
| ---------------- | --------------------------------------- |
| 200 OK           | Valid certificate                       |
| 400 Bad Request  | Invalid header encoding                 |
| 401 Unauthorized | Missing certificate headers             |
| 403 Forbidden    | Certificate pair or root CA not trusted |

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

#### ORD Access Strategy

When CF mTLS is configured, the plugin automatically adds `"sap:cmp-mtls:v1"` to the `accessStrategies` in the generated ORD document.

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

## Importing External Data Products

The plugin auto-generates `IntegrationDependency` resources when you import external Data Products.

### External Package Definition

Create a `.cds` file with these required annotations:

```cds
@cds.dp.ordId: 'sap.s4:dataProduct:Supplier:v1'
@cds.external
@data.product
@protocol: 'none'
service external.Supplier {
  entity Supplier { key ID: String; name: String; }
}
```

| Annotation       | Purpose                                 |
| ---------------- | --------------------------------------- |
| `@cds.dp.ordId`  | ORD ID of the external Data Product     |
| `@cds.external`  | Marks service as external               |
| `@data.product`  | Identifies as Data Product              |
| `@protocol`      | Set to `'none'` for external packages   |

### Import in Your Service

```cds
using { external.Supplier } from './external/SupplierDP';
```

The plugin generates an `IntegrationDependency` with an aspect referencing the external Data Product ORD ID.

---

## Summary

| Scenario                         | Approach                                                                |
| -------------------------------- | ----------------------------------------------------------------------- |
| Global Metadata                  | Define in `.cdsrc.json` under `ord`                                     |
| Service Metadata                 | Use `@ORD.Extensions` annotations in `.cds` files                       |
| OpenAPI Servers                  | Use `@OpenAPI.servers` annotation                                       |
| Custom ORD Content               | Use `customOrdContentFile`                                              |
| Linking to Existing SAP Products | Use `existingProductORDId`                                              |
| Defining Custom Products         | Add `products` section manually                                         |
| Basic Authentication             | Configure `ord.authentication.basic`                                    |
| CF mTLS Authentication           | Set `ord.authentication.cfMtls: true` + `CF_MTLS_TRUSTED_CERTS` env var |
| External Data Products           | Use `@cds.external`, `@data.product`, `@cds.dp.ordId` annotations       |
