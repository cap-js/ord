
const regexWithRemoval = (name) => {
  return name.replace(/[^a-zA-Z0-9]/g,'');
}
const regexWithUnderScore = (name) => {
  return regexWithRemoval(name.charAt(0)) + name.slice(1, name.length).replace(/[^a-zA-Z0-9]/g,'_');
}


const regexWithRemoval = (name) => {
  return name.replace(/[^a-zA-Z0-9]/g,'');
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
      shortDescription: " shortDescription for products Array",
      vendor: "customer:vendor:SAPCustomer:",
    },
  ],
  groupTypeId: "sap.cds:service", 
  packages: function getPackageData (name, policyLevel) {
    function createPackage(name, tag) {
      return {
        ordId: `customer.${regexWithRemoval(name)}:package:${regexWithRemoval(name)}${tag}`,
        title: `sample title for ${regexWithRemoval(name)}`,
        shortDescription: "Here is the shortDescription for packages Array",
        description: "Here is the description for packages Array",
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
      ordId: `customer.${regexWithRemoval(name)}:consumptionBundle:unknown:v1`,
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
