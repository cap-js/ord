---
name: integrate-ord-plugin
description: Integrate the @cap-js/ord plugin into an existing CAP Node.js project. Use when the user asks to add ORD support, configure the ORD plugin, set up the ord section in .cdsrc.json, or asks what ORD config options are available.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash(npm install *)
  - Bash(ls *)
---

# /integrate-ord-plugin

Integrates `@cap-js/ord` into an existing CAP Node.js project.

Arguments passed: `$ARGUMENTS`

---

## Dispatch on arguments

| Argument | Action |
| -------- | ------ |
| *(none)* | Full walk-through: Steps 1 → 2 → 3 → 4 |
| `config` | Configure `.cdsrc.json` only → Step 2. Assume plugin is already installed. |
| `auth`   | Configure authentication only → Step 3. |

---

## Step 1 — Install

```bash
npm install @cap-js/ord
```

**The plugin activates automatically as a CDS plugin — there is no `requires.ord: true` flag to set.**

If the install produces peer-dependency conflicts with `@cap-js/openapi` or `@cap-js/asyncapi`:

```bash
npm uninstall -g @cap-js/openapi @cap-js/asyncapi
npm install
```

---

## Step 2 — Configure `.cdsrc.json`

1. Check whether `.cdsrc.json` exists in the project root. If it does, read it first — preserve all existing keys.
2. Merge an `"ord"` block. Config can equivalently live in `package.json` under `"cds": { "ord": { ... } }`, but `.cdsrc.json` is preferred.
3. Populate using the property groups below. A minimal setup only needs **Identity** properties. Add others as the user's requirements demand.

> **Security**: the ORD endpoint is publicly accessible by default. Always configure authentication (Step 3) before production deployment.

---

### Group A — Identity *(always set these)*

These two properties define who the application is in the ORD landscape.

#### `namespace`

Prefix used to build **every** ORD ID in the document — packages, API/event resources, entity types, integration dependencies, and groups all derive their `ordId` from it.

- **Default:** `"customer.<packageName>"` with all non-alphanumeric characters stripped (including hyphens and dots). `my-app` → `"customer.myapp"`. Set this explicitly if you want to preserve word separators.
- **Format:** dot-separated identifier, e.g. `"customer.myapp"` or `"sap.sample"`.
- **ID effect:** `namespace: "customer.myapp"` + service `MyService` → `"customer.myapp:apiResource:MyService:v1"`.
- Cross-checked against `export.asyncapi.applicationNamespace` — mismatch logs a warning but does not block startup.

```json
{ "ord": { "namespace": "customer.myapp" } }
```

#### `description`

Top-level `description` of the ORD document. Not processed by ORD aggregators — for human context only. Supports CommonMark.

- **Default:** `"this is an application description"`

```json
{ "ord": { "description": "Exposes the booking and review APIs for the travel sample." } }
```

---

### Group B — Document metadata *(set when defaults are insufficient)*

#### `openResourceDiscovery`

ORD spec version the document claims to conform to. Emitted as the mandatory `openResourceDiscovery` root field.

- **Default:** `"1.16"` — only change if a downstream aggregator requires an older version.

```json
{ "ord": { "openResourceDiscovery": "1.16" } }
```

#### `baseUrl`

Base URL used by ORD consumers to resolve relative URLs for resource definitions and metadata files within the document.

- **Default:** omitted — field absent from document when not set.
- **Format:** `http(s)://` URI, no trailing slash. ORD spec pattern: `^http[s]?:\/\/[^:\/\s]+\.[^:\/\s\.]+(:\d+)?(\/[a-zA-Z0-9-\._~]+)*$`
- **When to set:** when the document contains relative URLs, or when the ORD aggregator requires it.

```json
{ "ord": { "baseUrl": "https://my-app.cfapps.eu10.hana.ondemand.com" } }
```

#### `policyLevels`

Document-level compliance policy levels. **Also controls package generation strategy** — the most impactful config property.

- **Default:** `["none"]`
- **Format:** array of ORD Specification IDs matching `^([a-z0-9]+(?:[.][a-z0-9]+)*):([a-zA-Z0-9._\-]+):(v0|v[1-9][0-9]*)$`, e.g. `["sap:core:v1"]`.
- **Legacy alias:** singular `ord.policyLevel` is accepted and auto-wrapped into an array; `policyLevels` wins if both are present.

**Package generation effect:**
- `["none"]` → one `General` package, `public` visibility only.
- Any `sap:*` level → up to 15 packages: 5 resource types (APIs, Events, Entity Types, Data Products, Integration Dependencies) × 3 visibilities (`public`, `internal`, `private`). Packages with no matching resources are pruned.

```json
{ "ord": { "policyLevels": ["sap:core:v1"] } }
```

#### `defaultVisibility`

Fallback visibility for all generated resources that have no explicit `@ORD.Extensions.visibility` annotation.

- **Default:** `"public"`
- **Allowed values:** `"public"`, `"internal"`, `"private"`. Invalid values fall back to `"public"` with a warning.

**Per-resource resolution order** (first match wins):
1. Primary data product service → always `"internal"`.
2. `@ORD.Extensions.visibility` on the service → that value.
3. Service with `implementationStandard: sap:ord-document-api:v1` → always `"public"`.
4. Anything else → `defaultVisibility`.

**Propagation:** when a CDS `kind: "service"` definition has `@ORD.Extensions.visibility`, that value cascades to all sub-definitions whose name starts with `<service.name>.` — unless the sub-definition already has the annotation set (existing annotations are never overwritten).

**Effect on packages:** with an SAP policy level, resolved visibility determines which of the 15 generated packages a resource is assigned to.

```json
{ "ord": { "defaultVisibility": "internal" } }
```

---

### Group C — Product and package ownership *(set when associating with a product or overriding package metadata)*

Two mutually exclusive approaches for product association:

| Scenario | Property to use |
| -------- | --------------- |
| App belongs to an **existing SAP product** | `existingProductORDId` |
| App defines its **own non-SAP product** | `products` |
| No explicit product needed | Neither — defaults apply |

#### `existingProductORDId`

Associates all generated packages with an existing SAP product. When set, the `products` key is **omitted from the document entirely** and all packages have `partOfProducts: [<this value>]`.

```json
{ "ord": { "existingProductORDId": "sap:product:SAPServiceCloudV2:" } }
```

#### `products`

Overrides fields on the single auto-generated product entry.

- **Only `products[0]` is read.** Elements at index 1+ are ignored.
- **Constraint:** if `products[0].ordId` starts with `"sap"` (case-insensitive), the plugin discards all overrides and logs an error — use `existingProductORDId` instead.
- Default: `ordId` → `"customer:product:<dotted-packageName>:"`, `vendor` → `"customer:vendor:Customer:"`, `title` and `shortDescription` auto-derived.

```json
{ "ord": { "products": [{ "ordId": "customer:product:my-app:", "vendor": "sap:vendor:SAP:", "title": "My Application" }] } }
```

Note: `vendor` can be `"sap:vendor:SAP:"` even for a customer-owned product (when the product is built by SAP). For a fully customer-owned product use `"customer:vendor:Customer:"`.

#### `packages`

Overrides fields on auto-generated packages. Patches generated entries rather than replacing them.

- **Only `packages[0]` is read.** Use `customOrdContentFile` to add extra packages.
- Resolver fields (`ordId`, `title`, `vendor`, `version`, `partOfProducts`, `description`, `shortDescription`) are applied individually. All other fields in `packages[0]` (e.g. `packageLinks`, `lineOfBusiness`) are spread onto **every** generated package.
- With an SAP policy level, `packages[0]` overrides (including `vendor`) propagate to all up-to-15 generated packages.
- When `existingProductORDId` is set, `partOfProducts` is always forced to `[existingProductORDId]`, ignoring any `partOfProducts` in `packages[0]`.
- Default field values: `vendor` → `"customer:vendor:Customer:"`, `version` → `"1.0.0"`, `title` → app name.

```json
{ "ord": { "packages": [{ "vendor": "sap:vendor:SAP:", "version": "2.0.0" }] } }
```

---

### Group D — Resource grouping *(set when clients need to discover and consume resources as a unit)*

#### `consumptionBundles`

Defines the `consumptionBundles` array in the ORD document. Bundles group inbound API and event resources for consumption by clients. Services are linked to a bundle via `@ORD.Extensions.partOfConsumptionBundles` in the CDS model.

- **Default:** omitted from the document when not set.
- **From config:** passed through to the document without transformation — specify each entry in full.
- **From `customOrdContentFile`:** smart-merged on `ordId`.
- Minimum required fields per entry: `ordId`, `title`, `version`.
- The plugin does not validate that `ordId`s referenced in annotations exist in this array.

```json
{
    "ord": {
        "consumptionBundles": [
            { "ordId": "customer.myapp:consumptionBundle:public:v1", "title": "Public APIs", "version": "1.0.0" }
        ]
    }
}
```

Link a service to the bundle in the `.cds` model:

```cds
annotate MyService with @ORD.Extensions: {
    partOfConsumptionBundles: [{ ordId: 'customer.myapp:consumptionBundle:public:v1' }]
};
```

---

### Group E — External dependencies *(set when the app consumes external Data Products)*

#### `integrationDependency`

Overrides fields on the auto-generated `IntegrationDependency` resource. The plugin generates this only when it detects external Data Product services — CDS services annotated with all three of: `@cds.external`, `@data.product`, and `@cds.dp.ordId` where `@cds.dp.ordId` has `apiResource` as its second colon-separated segment. If no such services exist, this property has no effect.

Default field values when generated:

| Field           | Default                                                             |
| --------------- | ------------------------------------------------------------------- |
| `ordId`         | namespace:integrationDependency:externalDependencies:vMAJOR         |
| `version`       | `"1.0.0"`                                                           |
| `visibility`    | `"public"`                                                          |
| `partOfPackage` | First matching integration dependency or general package ID         |
| `title`         | `"External Dependencies"`                                           |
| `releaseStatus` | `"active"`                                                          |
| `mandatory`     | `false`                                                             |
| `aspects`       | Auto-generated from annotated external services                     |

- Resolver fields (`ordId`, `version`, `visibility`, `partOfPackage`, `aspects`) are overridden individually. All other fields (`title`, `releaseStatus`, `description`, `mandatory`) are spread directly onto the generated entry.
- Setting `aspects` replaces the entire auto-detected aspects array.
- To customise individual aspects without replacing the array, use `@ORD.Extensions` on the external service definition:

```cds
annotate sap.sai.Supplier.v1 with @ORD.Extensions: {
    title      : 'SAI Supplier API',
    description: 'Integration with SAP Analytics Intelligence Supplier Data Product'
};
```

```json
{
    "ord": {
        "integrationDependency": {
            "title": "External Data Product Dependencies",
            "version": "2.0.0",
            "releaseStatus": "beta",
            "visibility": "internal"
        }
    }
}
```

---

### Group F — Advanced / rarely needed

#### `customOrdContentFile`

Path to a JSON file deep-merged into the generated ORD document at request time. Use for anything the plugin does not generate automatically.

- **Default:** not set. Missing file logs an error and is skipped (no crash).
- **Path:** relative to the project root (`cds.root`).
- **Override priority:** beats all other config and annotations.
- Setting a field to `null` removes it from the final document.

**What you can do:**
- Add resource types CAP does not generate (e.g. `dataProducts`).
- Enhance a generated resource by matching on its `ordId`.
- Delete a generated field by setting it to `null`.

**Merge semantics by field type:**
- *Scalars* — replaced outright: `baseUrl`, `description`, `openResourceDiscovery`, `policyLevels` (null entries pruned), `perspective`, `policyLevel`, `customPolicyLevel`.
- *Objects* — shallow-merged: `describedSystemType`, `describedSystemVersion`, `describedSystemInstance`.
- *Arrays of objects* — smart-merged keyed on `ordId`: `packages`, `products`, `apiResources`, `eventResources`, `consumptionBundles`, `integrationDependencies`, `entityTypes`, `dataProducts`. Matching entries are merged field-by-field; new entries appended. Exception: `groups` keys on `groupId`; `tombstones` keys on `ordId`/`groupId`/`groupTypeId`.

```json
{ "ord": { "customOrdContentFile": "./ord/custom.ord.json" } }
```

Example `custom.ord.json` — delete a field, add a package link, add a data product:

```json
{
    "packages": [
        {
            "description": null,
            "packageLinks": [{ "type": "terms-of-service", "url": "https://example.com/tos" }]
        }
    ],
    "dataProducts": [
        { "ordId": "sap.sm:dataProduct:Supplier:v1" }
    ]
}
```

#### `packageName`

Overrides the npm package name used to derive the default `namespace` and the `appName` identifier in package titles and ORD IDs.

- **Default:** `name` field from `package.json` (throws at startup if not found).
- The raw value is stored as-is. A derived `appName` is computed separately by stripping the leading `@` then replacing remaining `@` and `/` with `-` (e.g. `@sap/my-app` → `appName: "sap-my-app"`). It is `appName` that appears in generated IDs and titles, not `packageName`.
- **When to set:** only in monorepos where the npm package name is too generic to use as an ORD identifier.

```json
{ "ord": { "packageName": "my-app" } }
```

#### `internalNamespace`

Strips a CDS model namespace prefix from service names when building ORD IDs. Use when the CDS namespace differs from `ord.namespace` and would otherwise produce verbose IDs.

- With `namespace: "sap.sourcing"` and `internalNamespace: "com.sap.sourcing.api.v1"`, a service `com.sap.sourcing.api.v1.MyService` produces `sap.sourcing:apiResource:MyService:v1` instead of `sap.sourcing:apiResource:com.sap.sourcing.api.v1.MyService:v1`.
- If a service name already starts with `ord.namespace`, that takes priority and `internalNamespace` is not consulted.

```json
{ "ord": { "namespace": "sap.sourcing", "internalNamespace": "com.sap.sourcing.api.v1" } }
```

#### `compileOptions`

Extra options forwarded to the resource definition compilers.

```json
{
    "ord": {
        "compileOptions": {
            "openapi":   { "openapi:url": "https://{host}.example.com/${service-path}" },
            "asyncapi":  {},
            "edmx":      {},
            "mcp":       {}
        }
    }
}
```

---

## Step 3 — Configure authentication

The ORD endpoint is publicly accessible by default. At least one strategy is required for production. Authentication type is auto-detected from what is configured — no explicit `types` array is needed. Multiple strategies can be combined; the plugin tries each in order until one succeeds.

### Basic authentication

Generate a bcrypt hash (requires `htpasswd` from `apache2-utils` / `httpd-tools`):

```bash
htpasswd -bnBC 12 "" "your-password" | tr -d ':\n'
```

Add to `.cdsrc.json`. The `BASIC_AUTH` env var takes priority over `.cdsrc.json` when set:

```json
{
    "ord": {
        "authentication": {
            "basic": { "credentials": { "admin": "$2a$12$<bcrypt-hash>" } }
        }
    }
}
```

```bash
# env var alternative (takes priority)
BASIC_AUTH='{"admin":"$2a$12$<bcrypt-hash>"}'
```

### CF mTLS — production (SAP BTP Cloud Foundry)

`cfMtls: true` enables mTLS and fixes the ORD access strategy to `sap:cmp-mtls:v1` (UCL). Provide the cert config via `CF_MTLS_TRUSTED_CERTS` env var only — never commit certs to source control.

If the deployment requires a different access strategy (e.g. `sap.businesshub:mtls:v1` for Business Accelerator Hub), set an explicit `accessStrategies` array inside `CF_MTLS_TRUSTED_CERTS` rather than relying on `cfMtls: true`.

```json
{ "ord": { "authentication": { "cfMtls": true } } }
```

```bash
export CF_MTLS_TRUSTED_CERTS='{
  "configEndpoints": ["https://your-ucl-endpoint/v1/info"],
  "rootCaDn": ["CN=SAP Cloud Root CA,O=SAP SE,L=Walldorf,C=DE"]
}'
```

### CF mTLS — local development

Inline the full cert config directly in `.cdsrc.json`:

```json
{
    "ord": {
        "authentication": {
            "cfMtls": {
                "certs": [{ "issuer": "CN=Test CA,O=MyOrg,C=DE", "subject": "CN=test-client,O=MyOrg,C=DE" }],
                "rootCaDn": ["CN=Test Root CA,O=MyOrg,C=DE"]
            }
        }
    }
}
```

---

## Step 4 — Verify

```bash
cds watch
```

The ORD document is served at `/.well-known/open-resource-discovery`.

---

## Implementation notes

- **Do not add `requires.ord: true`** anywhere — this key does not exist. The plugin self-registers on install.
- `existingProductORDId` and `products` are mutually exclusive: `existingProductORDId` suppresses the `products` output entirely.
- `policyLevels` containing a SAP level causes `packages[0]` overrides (including `vendor`) to propagate to all generated packages — this is usually the intended behaviour.
- `customOrdContentFile` is the right tool for anything beyond what the config properties above cover. Setting a key to `null` in that file removes it from the merged output.