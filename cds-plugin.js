console.log("\n\n ORD working !!! \n\n");
// TODO : Comments on every function
const fs = require("fs");
const path = require("path");
const cds_dk = require("@sap/cds-dk");
cds_dk.app = require("express")();

const _ = {
    policyLevel : [
        {
            ordId: "sap:product:CapOrdPoC:",
            title: "ORD Reference App Incident Management",
            shortDescription: " shortDescription for products Array",
            vendor: "sap:vendor:SAP:",
        },
    ],
    products : [
        {
            ordId: "sap:product:CapOrdPoC:",
            title: "ORD Reference App Incident Management",
            shortDescription: " shortDescription for products Array",
            vendor: "sap:vendor:SAP:",
        },
    ] , 
    packages: (name) => [
        {
            "ordId": `sap.capordpoc:package:${name}-api:v1`,
            "title": `sample title for ${name} management`,
            "shortDescription": " here is the shortDescription for packages Array",
            "description": " here is the description for packages Array",
            "version": "1.0.0",
            "partOfProducts": [
                "sap:product:CapOrdPoC:"
            ],
            "vendor": "sap:vendor:SAP:"
        },
        {
            "ordId": `sap.capordpoc:package:i${name}-event:v1`,
            "title": `sample title for ${name} management`,
            "shortDescription": " here is the shortDescription for packages Array",
            "description": " here is the description for packages Array",
            "version": "1.0.0",
            "partOfProducts": [
                "sap:product:CapOrdPoC:"
            ],
            "vendor": "sap:vendor:SAP:"
        }
    ] , 
    consumptionBundles : [
        {
            ordId: "sap.capordpoc:consumptionBundle:noAuth:v1",
            version: "1.0.0",
            title: "Unprotected resources",
            shortDescription: "If we have another protected API then it will be another object",
            description: "This Consumption Bundle contains all resources of the reference app which are unprotected and do not require authentication",
        },
    ] , 
    baseTemplate : {
        openResourceDiscoveryV1: {
            bra: [
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

//Constructing the entityTypes array
//For POC this is in draft only
function createEntityTypeTemplate(srv, packageNameReg) {
    return {
        ordId: `${packageNameReg}:entityType:${srv}:v1`,
        localId: "Incidents",
        version: "1.0.0",
        title: "Incidents",
        level: "aggregate",
        description: "Description of the local Incidents Model",
        visibility: "public",
        releaseStatus: "active",
        partOfPackage: "sap.capordpoc:package:ord-reference-app-apis:v1",
    };
}

const getMetaData = async (data, res) => {
    if (data === "/") {
        res.status(200).send(_.baseTemplate);
    } else {
        const [serviceName, compilerType] = data?.split("/").pop().split(".");
        const cdsFileName = Object.values(cds.services).filter(
            (srv) =>
                srv.definition &&
                srv.definition.kind === "service" &&
                serviceName === srv.definition.name
        );
        const sourcePath = cdsFileName[0].definition["@source"];
        const compilerFunction = {
            edmx: {
                function: "edmx-v4",
                contentType: "application/xml",
            },
            asyncapi2: {
                function: "asyncapi",
                contentType: "application/json",
            },
            oas3: {
                function: "openapi",
                contentType: "application/json",
            },
        };
        const responseFile = await cds_dk
            .compile(`file:${sourcePath}`)
            .to[compilerFunction[compilerType].function]({
                service: cdsFileName[0].name,
            });
        return res.status(200).contentType(compilerFunction[compilerType].contentType).send(responseFile);
    }
}

const fGetORDVersion = () => { 
    return "1.6";
}

const fGetPackageJson = (key) => {
    const fGetPackageJsonPath = path.resolve(process.cwd(), "package.json");
    return (
        (fs.existsSync(fGetPackageJsonPath) && JSON.parse(fs.readFileSync(fGetPackageJsonPath, "utf8"))[key]) 
        || `This is an example ORD document.`
    );
}

const fGetPresets = (propertyName, defaultValue) => {
    return cds.env["ord"][propertyName] ?? defaultValue;
}

const fGetAPIResources = () => {
    const packageNameReg = "sap.capordpoc";
    const namespace = cds.model.namespace;

    const oEntityTypeTargets = Object.keys(cds.model.definitions)
        .filter((key) => cds.model.definitions[key].kind === "entity" && key.includes(namespace) && !key.includes(".texts"))
        .map((entity) => ({ ordId: `${packageNameReg}:entityType:${entity}:v1` }));

    const oApiResources = Object.values(cds.services)
        .filter((srv) => srv.definition && srv.definition.kind === "service")
        .map((srv) => fCreateAPIResourceTemplate(srv.definition.name, packageNameReg, oEntityTypeTargets, namespace));

    return fGetPresets("apiResources", undefined) ?? oApiResources;
}

const fGetPackages = () => {
    if (Object.keys(cds.model.definitions).filter((key) => cds.model.definitions[key].kind === "event").length){
        return fGetPresets("packages", _.packages(fGetPackageJson("name").replace(/\s/g, "-")))
    }
    return fGetPresets("packages", _.packages(fGetPackageJson("name").replace(/\s/g, "-")).slice(0,1))
}

const fGetEventResources = () => {
    const packageNameReg = "sap.capordpoc";
    const namespace = cds.model.namespace;
    const eventResources = Object.keys(cds.model.definitions)
                             .filter((key) => cds.model.definitions[key].kind === "event")
                             .map((srv) => fCreateEventResourceTemplate(srv, packageNameReg, namespace));
    return eventResources
}

const fReadORDExtensions = (srv) => {
    return Object.entries(srv).filter(([key]) => key.startsWith("@ORD.Extensions."))
                 .reduce((ordExtent, [key, value]) => ({...ordExtent, [key.slice("@ORD.Extensions.".length)]: value}), {});
}

const fCreateAPIResourceTemplate = (srv, packageNameReg, entityTypeTargets, namespace) => {
    const ordExtent = fReadORDExtensions(cds.model.definitions[srv]);
    return {
        ordId: `${packageNameReg}:apiResource:${namespace}.${srv}:v1`,
        title: ordExtent.title ?? `The service is for ${srv}`,
        shortDescription: ordExtent.shortDescription ?? `Here we have the shortDescription for ${srv}`,
        description: ordExtent.description ?? `Here we have the description for ${srv}`,
        version: ordExtent.version ?? "1.0.0",
        visibility: ordExtent.visibility ?? "public",
        partOfPackage: `${packageNameReg}:package:${fGetPackageJson("name").replace(/\s/g, "-")}:v1`,
        releaseStatus: ordExtent.active ?? "active",
        partOfConsumptionBundles: [
            {
                ordId: `${packageNameReg}:consumptionBundle:noAuth:v1`,
            },
        ],
        apiProtocol: ordExtent.apiProtocol ?? "odata-v4",
        // TODO : From where to get the package name - incidentManagement 
        // TODO : How are we generating this URL ? 
        resourceDefinitions: [
            {
                type: "openapi-v3",
                mediaType: "application/json",
                url: `/.well-known/open-resource-discovery/${fGetPackageJson("name").replace(/\s/g, "-")}/v1/api-metadata/${srv}.oas3.json`,
                accessStrategies: [{ type: "open" }],
            },
            {
                type: "edmx",
                mediaType: "application/xml",
                url: `/.well-known/open-resource-discovery/${fGetPackageJson("name").replace(/\s/g, "-")}/v1/api-metadata/${srv}.edmx`,
                accessStrategies: [{ type: "open" }],
            },
        ],
        entryPoints: [cds.services[srv].path],
        extensible: { supported: ordExtent['extensible.supported'] ?? "no" },
        entityTypeMappings: [{ entityTypeTargets }],
    };
}

const fCreateEventResourceTemplate = (srv,packageNameReg,namespace) => {
    const ordExtent = fReadORDExtensions(cds.model.definitions[srv]);
    return {
        ordId: `${packageNameReg}:eventResource:${namespace}.${srv}:v1`,
        title: ordExtent.title ?? `ODM ${fGetPackageJson("name").replace(/\s/g, "-")} Events`,
        shortDescription: ordExtent.shortDescription ?? "Example ODM Event",
        description: ordExtent.description ??  `This is an example event catalog that contains only a partial ODM ${fGetPackageJson("name").replace(/\s/g, "-")} V1 event`,
        version: ordExtent.version ?? "1.0.0",
        releaseStatus: ordExtent.releaseStatus ?? "beta",
        // TODO : From where to get the package name - incidents-mgmt 
        partOfPackage: `${packageNameReg}:package:${fGetPackageJson("name").replace(/\s/g, "-")}:v1`,
        visibility: ordExtent.visibility ?? "public",
        resourceDefinitions: [
            {
                type: "asyncapi-v2",
                mediaType: "application/json",
                // TODO : From where to get the package name - incidentManagement 
                // TODO : How are we generating this URL ? 
                url: `/.well-known/open-resource-discovery/${fGetPackageJson("name").replace(/\s/g, "-")}/v1/api-metadata/${cds.model.definitions[srv]._service.name}.asyncapi2.json`,
                accessStrategies: [
                    {
                        type: "open",
                    },
                ],
            },
        ],
        extensible: { supported: ordExtent['extensible.supported'] ?? "no" },
    };
}

const ORD = () => {
    // TODO : Error handling in plugin 
    try {
        const data = cds.env["ord"].application_namespace;
        if (data === undefined) {
            return { status:"Error" }
        }
        // TODO : Check for values if there are correct or not
        const oReturn = {
            openResourceDiscovery: fGetORDVersion(),
            policyLevel: fGetPresets("policyLevel", _.policyLevel),
            description: fGetPackageJson("description"),
            products: fGetPresets("products", _.products),
            packages: fGetPackages(),
            consumptionBundles: fGetPresets("consumptionBundles", _.consumptionBundles),
            apiResources: fGetAPIResources(),
            eventResources: fGetEventResources()
        };
        return oReturn;
    } catch (error) {
        console.log(error);
    }
}

cds_dk.on("bootstrap", (app) => {
    app.use("/.well-known/open-resource-discovery", async (req, res) => {
        await getMetaData(req.url, res);
    });

    app.get("/open-resource-discovery/v1/documents/1", async (req, res) => {
        try {
            const data = ORD();
            return res.status(200).send(data);
        } catch (error) {
            console.log(error);
        }
    });
});

module.exports = cds_dk.server;
