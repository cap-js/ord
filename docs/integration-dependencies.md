# Integration Dependencies from app.yaml

This document describes how to automatically generate ORD Integration Dependencies from an `app.yaml` configuration file that defines data product consumption.

## Overview

Integration Dependencies are ORD resources that describe dependencies on external systems or services required for integration scenarios. This feature automatically generates Integration Dependency ORD structures from the `dataProducts.consumption` section of an `app.yaml` (Application Foundation) configuration file.

## Prerequisites

- An `app.yaml` file in your project root directory
- The `app.yaml` must contain a valid Application Foundation configuration
- The `commercial.application-namespace` field must be defined
- Data products consumption must be configured under `overrides.dataProducts.consumption`

## Usage

Simply place an `app.yaml` file in your project root and run:

```bash
cds build --for ord
```

The build process will **automatically detect** the `app.yaml` file and generate Integration Dependencies if data products consumption is configured.

**No additional flags or configuration needed!**

## app.yaml Configuration

### Required Structure

```yaml
metadata:
  name: my-application
  description: "My Application Description"
  version: "1.0.0"

commercial:
  application-namespace: "com.example.myapp"  # REQUIRED for Integration Dependencies

overrides:
  dataProducts:
    consumption:
      # Each key is an ORD ID of a consumed data product/API resource
      "sap.s4com:apiResource:PurchaseOrder:v1":
        minimumVersion: "1.2.3"      # REQUIRED: Minimum version of the consumed resource
        mandatory: true              # OPTIONAL: Whether this dependency is mandatory (default: false)
        consumptionType: "replication"  # OPTIONAL: Type of consumption (replication, federation, cached)
        ordId: "xyz"                 # OPTIONAL: Custom ORD ID reference
        capConsumption:
          model: "sap-s4com-purchaseorder-v1"  # OPTIONAL: CAP model name
```

### Example Configuration

```yaml
apiVersion: composer.yaml/v1
kind: Application
metadata:
  name: intelligent-supply-chain-app
  description: "Intelligent Supply Chain Application"
  version: "1.0.0"

commercial:
  application-namespace: "com.sap.intelligent.supplychain"

overrides:
  dataProducts:
    consumption:
      # Mandatory Purchase Order integration
      "sap.s4com:apiResource:PurchaseOrder:v1":
        minimumVersion: "1.2.3"
        mandatory: true
        consumptionType: "replication"
        capConsumption:
          model: "sap-s4com-purchaseorder-v1"
      
      # Optional Supplier integration
      "sap.ariba:apiResource:Supplier:v2":
        minimumVersion: "2.0.0"
        mandatory: false
        consumptionType: "federation"
```

## Generated Integration Dependency Structure

For each consumed data product, an Integration Dependency will be generated with the following structure:

```json
{
  "ordId": "sap.intelligentsupplychain:integrationDependency:S4comPurchaseOrder:v1",
  "title": "S/4HANA Commerce Purchase Order Integration",
  "description": "Integration with sap.s4com for accessing Purchase Order data. Integration pattern: replication. Consumed resource: sap.s4com:apiResource:PurchaseOrder:v1 (resource type: apiResource, minimum version: 1.2.3). CAP model: sap-s4com-purchaseorder-v1. This is a mandatory dependency required for core functionality. Enables data access and integration with sap.s4com for enhanced analytics and business process support.",
  "partOfPackage": "sap.intelligentsupplychain:package:default:v1",
  "version": "1.2.3",
  "releaseStatus": "active",
  "visibility": "public",
  "mandatory": true,
  "aspects": [
    {
      "title": "PurchaseOrder Data Access",
      "description": "Replication of purchaseorder data",
      "mandatory": true,
      "supportMultipleProviders": false,
      "apiResources": [
        {
          "ordId": "sap.s4com:apiResource:PurchaseOrder:v1",
          "minVersion": "1.2.3"
        }
      ]
    }
  ]
}
```

## ORD ID Generation

Integration Dependency ORD IDs are automatically generated using the following algorithm:

### Format
```
<namespace>:integrationDependency:<resourceName>:v<majorVersion>
```

### Components

1. **Namespace**: Converted from `commercial.application-namespace`
   - Example: `com.sap.intelligent.supplychain` → `sap.intelligentsupplychain`
   - Follows ORD namespace conventions (vendor.system format)

2. **Concept**: Always `integrationDependency`

3. **Resource Name**: Derived from consumed ORD ID
   - Example: `sap.s4com:apiResource:PurchaseOrder:v1` → `S4comPurchaseOrder`
   - Combines source system identifier with resource name
   - **Note**: Consumption type (replication, federation) is NOT included in the name

4. **Major Version**: Extracted from `minimumVersion`
   - Example: `1.2.3` → `v1`

### Examples

| Consumed ORD ID | App Namespace | Generated Integration Dependency ORD ID |
|-----------------|---------------|----------------------------------------|
| `sap.s4com:apiResource:PurchaseOrder:v1` | `com.sap.intelligent.supplychain` | `sap.intelligentsupplychain:integrationDependency:S4comPurchaseOrder:v1` |
| `sap.ariba:apiResource:Supplier:v2` | `com.example.procurement` | `example.procurement:integrationDependency:AribaSupplier:v2` |

## Package Assignment

Integration Dependencies are automatically assigned to packages:

- Uses the first available package from the ORD document
- If no packages exist, creates a reference to: `<namespace>:package:CoreIntegrations:v1`
- Package filtering ensures only packages with actual resources are included in the final ORD document

## Field Mapping

| app.yaml Field | Integration Dependency Field | Notes |
|----------------|----------------------------|-------|
| Key (ORD ID) | `aspects[].apiResources[].ordId` | The consumed resource ORD ID |
| `minimumVersion` | `version`, `aspects[].apiResources[].minVersion` | Used for version and aspect |
| `mandatory` | `mandatory`, `aspects[].mandatory` | Defaults to `false` if not specified |
| `consumptionType` | Description, labels | Included in description and labels, not in ORD ID |
| `capConsumption.model` | Description | Included in markdown description |

## Error Handling

The integration is designed to be resilient:

- If `app.yaml` is not found, the build continues without Integration Dependencies
- If `app.yaml` parsing fails, an error is logged but the build continues
- If individual Integration Dependency generation fails, it's logged and skipped
- Other Integration Dependencies continue to be processed

## Validation

The generated Integration Dependencies follow ORD specification requirements:

- ✅ Valid ORD ID format
- ✅ All mandatory fields present (`ordId`, `title`, `description`, `partOfPackage`, `version`, `releaseStatus`, `visibility`, `mandatory`)
- ✅ Semantic versioning (SemVer 2.0.0)
- ✅ Proper namespace structure
- ✅ Valid aspect structure with `apiResources` containing both `ordId` and `minVersion`

## Benefits

1. **Automatic Documentation**: Integration dependencies are automatically documented in ORD
2. **Governance**: Provides visibility into external system dependencies
3. **Version Management**: Tracks minimum required versions of consumed resources
4. **Discovery**: Helps consumers understand what external systems are needed
5. **Consistency**: Ensures consistent Integration Dependency generation across projects

## Troubleshooting

### No Integration Dependencies Generated

**Check:**
- `app.yaml` exists in project root
- `commercial.application-namespace` is defined
- `overrides.dataProducts.consumption` contains valid entries
- Build logs for error messages

### Invalid ORD ID Generated

**Verify:**
- `commercial.application-namespace` follows proper format
- Consumed ORD IDs are valid (format: `namespace:concept:resource:version`)
- `minimumVersion` is a valid semantic version

### Missing Dependencies

**Ensure:**
- All consumed data products are listed in `app.yaml`
- Each entry has required fields (`minimumVersion`)
- ORD IDs are correct and complete

## Implementation Details

The feature consists of three main components:

1. **`lib/integrationDependency.js`**: Core generation logic
   - Namespace conversion
   - ORD ID generation
   - Integration Dependency structure creation

2. **`lib/build.js`**: Build integration
   - Loads and parses `app.yaml`
   - Passes configuration to ORD generation

3. **`lib/ord.js`**: ORD document integration
   - Calls Integration Dependency generation
   - Includes Integration Dependencies in ORD document
   - Updates package filtering

## See Also

- [ORD Specification - Integration Dependencies](https://open-resource-discovery.github.io/specification/spec-v1/concepts/integration-dependency)
- [ORD ID Concepts](https://open-resource-discovery.github.io/specification/spec-v1/#ord-id)
- [Application Foundation Documentation](../xmpl_java/app.yaml)
