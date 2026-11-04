# Entity Types Sample

Demonstrates ORD entity type exposure with aggregate generation, composition-based membership, ODM identity, and a static data product.

## Model

- `Orders` — annotated with `@ObjectModel.compositionRoot`, `@EntityRelationship.entityType`, and `@ODM.entityName`. With aggregate generation enabled, this becomes the aggregate.
- `OrderItems` — a composition child of `Orders`. Receives a `part-of` relationship pointing to the aggregate.

## Configuration

```json
{
    "ord": {
        "namespace": "customer.entitytypes",
        "policyLevels": ["none"],
        "entityTypes": {
            "generateAggregates": true,
            "includeRootEntities": true
        }
    }
}
```

With `generateAggregates: true`:
- `Orders` is emitted as `level: "aggregate"` with a `can-share-identity` relationship to `sap.odm:entityType:Order:v1`.
- `OrderItems` is emitted as `level: "sub-entity"` with a `part-of` relationship to the aggregate.

With `includeRootEntities: true`, a separate root entity `customer.entitytypes:entityType:OrderRoot:v1` is also generated with `level: "root-entity"` and `part-of` → aggregate.

## Generated entity types

| ordId | level |
|---|---|
| `customer.entitytypes:entityType:Order:v1` | `aggregate` |
| `customer.entitytypes:entityType:OrderRoot:v1` | `root-entity` |
| `customer.entitytypes:entityType:OrderItem:v1` | `sub-entity` |

## Static data product

`ord/custom.ord.json` supplies a data product referencing the entity types and the two output ports (API resource and event resource).

## Running

Static build (output in `gen/ord/`):

```sh
npm install
cds build --for ord
```

HTTP endpoint (tenant-free, system-version perspective):

```sh
cds serve
# GET /ord/v1/documents/ord-document?perspective=system-version
```
