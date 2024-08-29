const cds = require("@sap/cds");
const ord = require("../lib/ord");
const path = require("path");

describe("Tests for default ORD document", () => {
  let csn;

  beforeAll(async () => {
    csn = await cds.load(path.join(__dirname, "bookshop", "srv"));
  });

  test("Successfully create ORD Documents with defaults", () => {
    const document = ord(csn);
    expect(document).toStrictEqual({
        "$schema": "https://sap.github.io/open-resource-discovery/spec-v1/interfaces/Document.schema.json",
        "openResourceDiscovery": "1.9",
        "policyLevel": "none",
        "description": "this is an application description",
        "products": [
          {
            "ordId": "customer:product:cap.js.ord:",
            "title": "cap js ord",
            "shortDescription": "Description for cap js ord",
            "vendor": "customer:vendor:customer:"
          }
        ],
        "groups": [
          {
            "groupId": "sap.cds:service:capjs.ord:undefined.AdminService",
            "groupTypeId": "sap.cds:service",
            "title": "Admin Service Title"
          },
          {
            "groupId": "sap.cds:service:capjs.ord:undefined.CatalogService",
            "groupTypeId": "sap.cds:service",
            "title": "Catalog Service Title"
          }
        ],
        "apiResources": [
          {
            "ordId": "capjs.ord:apiResource:undefined.AdminService:v1",
            "title": "The service is for AdminService",
            "shortDescription": "Here we have the shortDescription for AdminService",
            "description": "Here we have the description for AdminService",
            "version": "1.0.0",
            "visibility": "public",
            "partOfGroups": [
              "sap.cds:service:capjs.ord:undefined.AdminService"
            ],
            "partOfPackage": undefined,
            "releaseStatus": "active",
            "apiProtocol": "odata-v4",
            "resourceDefinitions": [
              {
                "type": "openapi-v3",
                "mediaType": "application/json",
                "url": "/.well-known/open-resource-discovery/v1/api-metadata/AdminService.oas3.json",
                "accessStrategies": [
                  {
                    "type": "open"
                  }
                ]
              },
              {
                "type": "edmx",
                "mediaType": "application/xml",
                "url": "/.well-known/open-resource-discovery/v1/api-metadata/AdminService.edmx",
                "accessStrategies": [
                  {
                    "type": "open"
                  }
                ]
              }
            ],
            "entryPoints": [
              "/odata/v4/admin"
            ],
            "extensible": {
              "supported": "no"
            },
            "entityTypeMappings": [
              {
                "entityTypeTargets": []
              }
            ]
          },
          {
            "ordId": "capjs.ord:apiResource:undefined.CatalogService:v1",
            "title": "The service is for CatalogService",
            "shortDescription": "Here we have the shortDescription for CatalogService",
            "description": "Here we have the description for CatalogService",
            "version": "1.0.0",
            "visibility": "public",
            "partOfGroups": [
              "sap.cds:service:capjs.ord:undefined.CatalogService"
            ],
            "partOfPackage": undefined,
            "releaseStatus": "active",
            "apiProtocol": "odata-v4",
            "resourceDefinitions": [
              {
                "type": "openapi-v3",
                "mediaType": "application/json",
                "url": "/.well-known/open-resource-discovery/v1/api-metadata/CatalogService.oas3.json",
                "accessStrategies": [
                  {
                    "type": "open"
                  }
                ]
              },
              {
                "type": "edmx",
                "mediaType": "application/xml",
                "url": "/.well-known/open-resource-discovery/v1/api-metadata/CatalogService.edmx",
                "accessStrategies": [
                  {
                    "type": "open"
                  }
                ]
              }
            ],
            "entryPoints": [
              "/browse"
            ],
            "extensible": {
              "supported": "no"
            },
            "entityTypeMappings": [
              {
                "entityTypeTargets": []
              }
            ]
          }
        ]
      });
  });
});
