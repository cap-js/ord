
const regexWithRemoval = (name) => {
  if(name){
    return name.replace(/[^a-zA-Z0-9]/g,'');
  }
}
const regexWithUnderScore = (name) => {
  return regexWithRemoval(name.charAt(0)) + name.slice(1, name.length).replace(/[^a-zA-Z0-9]/g,'_');
}

/**
 * Module containing default configuration for ORD Document.
 * @module defaults
 */
module.exports = {
  openResourceDiscovery: "1.9",
  policyLevel: "none",
  description: "this is an application description",
  products: (name) => [
    { 
      ordId: `customer:product:${regexWithUnderScore(name)}:`,
      title: `ORD App Title for ${regexWithRemoval(name)}`,
      shortDescription: " shortDescription for products",
      vendor: "customer:vendor:SAPCustomer:",
    },
  ],
  groupTypeId: "sap.cds:service", 
  packages: function getPackageData (name, policyLevel,capNamespace) {
    function createPackage(name, tag) {
      return {
        ordId: `${regexWithRemoval(name)}:package:${capNamespace}${tag}`,
        title: `sample title for ${regexWithRemoval(name)}`,
        shortDescription: "Here is the shortDescription for packages",
        description: "Here is the description for packages",
        version: "1.0.0",
        partOfProducts: [`customer:product:${regexWithUnderScore(name)}:`],
        vendor: "customer:vendor:SAP:"
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
