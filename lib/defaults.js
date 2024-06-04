/**
 * Module containing default configuration for ORD Document.
 * @module defaults
 */
module.exports = {
  openResourceDiscovery: "1.9",
  policyLevel: "sap:core:v1",
  description: "this is an application description",
  products: (name) => [
    {
      ordId: "sap:product:CapOrdPoC",
      title: `ORD App Title for ${name}`,
      shortDescription: " shortDescription for products Array",
      vendor: "sap:vendor:SAP",
    },
  ],
  groupTypeId: "sap.cds:service", 
  packages: function getPackageData (name, policyLevel) {
    function createPackage(name, tag) {
      return {
        ordId: `sap.capordpoc:package:${name}${tag}`,
        title: `sample title for ${name}`,
        shortDescription: "Here is the shortDescription for packages Array",
        description: "Here is the description for packages Array",
        version: "1.0.0",
        partOfProducts: ["sap:product:CapOrdPoC:"],
        vendor: "sap:vendor:SAP:"
      };
    }
    // let policyLevel = global.env.policyLevel || this.policyLevel;

    if(policyLevel.split(':')[0].toLowerCase() === 'sap') {
        return [createPackage(name, "-api:v1"), createPackage(name, "-event:v1")];
    }
    else {
        return [createPackage(name, ":v1")];
    }
  },
  consumptionBundles: [
    {
      ordId: "sap.capordpoc:consumptionBundle:noAuth:v1",
      version: "1.0.0",
      title: "Unprotected resources",
      shortDescription:
        "If we have another protected API then it will be another object",
      description:
        "This Consumption Bundle contains all resources of the reference app which are unprotected and do not require authentication",
    },
  ],
  apiResources: [],
  eventResources: [],
  entityTypes: [],
  baseTemplate: {
    openResourceDiscoveryV1: {
      documents: [
        {
          url: "/open-resource-discovery/v1/documents/1",
          accessStrategies: [
            {
              type: "open",
            },
          ],
        },
    ],
    packages: (name) => [
        {
            "ordId": `sap.capordpoc:package:${name}-api:v1`,
            "title": `sample title for ${name}`,
            "shortDescription": "here is the shortDescription for packages Array",
            "description": "here is the description for packages Array",
            "version": "1.0.0",
            "partOfProducts": [
                "sap:product:CapOrdPoC:"
            ],
            "vendor": "sap:vendor:SAP:"
        },
        {
            "ordId": `sap.capordpoc:package:${name}-event:v1`,
            "title": `sample title for ${name}`,
            "shortDescription": " here is the shortDescription for packages Array",
            "description": " here is the description for packages Array",
            "version": "1.0.0",
            "partOfProducts": [
                "sap:product:CapOrdPoC:"
            ],
            "vendor": "sap:vendor:SAP:"
        }
    ] , 
    consumptionBundles: [
        {
            ordId: "sap.capordpoc:consumptionBundle:noAuth:v1",
            version: "1.0.0",
            title: "Unprotected resources",
            shortDescription: "If we have another protected API then it will be another object",
            description: "This Consumption Bundle contains all resources of the reference app which are unprotected and do not require authentication",
        },
    ] , 
    apiResources: [],
    eventResources: [],
    entityTypes: [],
    baseTemplate : {
        openResourceDiscoveryV1: {
            documents: [
                {
                    url: "/open-resource-discovery/v1/documents/1",
                    accessStrategies: [
                        {
                            type: "open",
                        },
                    ],
                },
            ],
        },
    }
}
}}
