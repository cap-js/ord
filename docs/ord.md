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
        "policyLevel": "sap:core:v1"
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
    "policyLevel": "sap:core:v1",
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
      "lineOfBusiness": [
        "Sales"
      ]
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
    "policyLevel": "sap:core:v1",
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
  "partOfProducts": [
    "sap:product:SAPServiceCloudV2:"
  ],
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
    "policyLevel": "sap:core:v1",
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

| Scenario                         | Approach                                               |
| --------------------------------- | ------------------------------------------------------ |
| Global Metadata                  | Define in `cdsrc.json` under `ord`                     |
| Service Metadata                 | Use `@ORD.Extensions` annotations in `.cds` files      |
| Custom ORD Content               | Use `customOrdContentFile`                             |
| Linking to Existing SAP Products | Use `existingProductORDId`                             |
| Defining Custom Products         | Add `products` section manually                        |

---


# Ord Root Property

More information, see [ord document](https://pages.github.tools.sap/CentralEngineering/open-resource-discovery-specification/spec-v1/interfaces/document)
