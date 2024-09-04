
const regexWithRemoval = (name) => {
  if(name){
    return name.replace(/[^a-zA-Z0-9]/g,'');
  }
}

const nameWithDot = (name) => {
  return regexWithRemoval(name.charAt(0)) + name.slice(1, name.length).replace(/[^a-zA-Z0-9]/g,'.');
}

const nameWithSpaces = (name) => {
  return regexWithRemoval(name.charAt(0)) + name.slice(1, name.length).replace(/[^a-zA-Z0-9]/g,' ');
}

const defaultProductOrdId = (name) => `customer:product:${nameWithDot(name)}:`

/**
 * Module containing default configuration for ORD Document.
 * @module defaults
 */
module.exports = {
  $schema: "https://sap.github.io/open-resource-discovery/spec-v1/interfaces/Document.schema.json",
  openResourceDiscovery: "1.9",
  policyLevel: "none",
  description: "this is an application description",
  products: (name) => [
    { 
      ordId: defaultProductOrdId(name),
      title: nameWithSpaces(name),
      shortDescription: "Description for " +  nameWithSpaces(name),
      vendor: "customer:vendor:customer:",
    },
  ],
  groupTypeId: "sap.cds:service", 
  packages: function getPackageData (name, policyLevel,capNamespace) {
    function createPackage(name, tag) {
      return {
        ordId: `${regexWithRemoval(name)}:package:${capNamespace}${tag}`,
        title: nameWithSpaces(name),
        shortDescription: "Short description for " + nameWithSpaces(name),
        description: "Description for " + nameWithSpaces(name),
        version: "1.0.0",
        partOfProducts: [defaultProductOrdId(name)],
        vendor: "customer:vendor:Customer:"
      };
    }
    
    if(policyLevel.split(':')[0].toLowerCase() === 'sap') {
        return [createPackage(name, "-api:v1"), createPackage(name, "-event:v1")];
    }
    else {
        return [createPackage(name, ":v1")];
    }
  },
  consumptionBundles: (name) => [
    {
      ordId: `${regexWithRemoval(name)}:consumptionBundle:unknown:v1`,
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
