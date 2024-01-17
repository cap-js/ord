console.log("\n\n ORD working !!! \n\n");

let fs = require("fs");
const path = require("path");
const cds_dk = require("@sap/cds-dk");
cds_dk.app = require("express")();

const createORDExtensionsObj = (srv) => {
    return Object.entries(srv).filter(([key]) => key.startsWith("@ORD.Extensions."))
                 .reduce((ordExtent, [key, value]) => ({...ordExtent, [key.slice("@ORD.Extensions.".length)]: value}), {});
}

const createAPIResourceTemplate = (srv, packageNameReg, entityTypeTargets, namespace) => {
    const ordExtent = createORDExtensionsObj(cds.model.definitions[srv]);
    return {
        ordId: `${packageNameReg}:apiResource:${namespace}.${srv}:v1`,
        title: ordExtent.title ?? `The service is for ${srv}`,
        shortDescription: ordExtent.shortDescription ?? `Here we have the shortDescription for ${srv}`,
        description: ordExtent.description ?? `Here we have the description for ${srv}`,
        version: ordExtent.version ?? "1.0.0",
        visibility: ordExtent.visibility ?? "public",
        partOfPackage: `${packageNameReg}:package:${"incidents-mgmt"}:v1`,
        releaseStatus: ordExtent.active ?? "active",
        partOfConsumptionBundles: [
            {
                ordId: `${packageNameReg}:consumptionBundle:noAuth:v1`,
            },
        ],
        apiProtocol: ordExtent.apiProtocol ?? "odata-v4",
        resourceDefinitions: [
            {
                type: "openapi-v3",
                mediaType: "application/json",
                url: `/.well-known/open-resource-discovery/${"incidentManagement"}/v1/api-metadata/${srv}.oas3.json`,
                accessStrategies: [{ type: "open" }],
            },
            {
                type: "edmx",
                mediaType: "application/xml",
                url: `/.well-known/open-resource-discovery/${"incidentManagement"}/v1/api-metadata/${srv}.edmx`,
                accessStrategies: [{ type: "open" }],
            },
        ],
        entryPoints: [cds.services[srv].path],
        extensible: { supported: ordExtent['extensible.supported'] ?? "no" },
        entityTypeMappings: [{ entityTypeTargets }],
    };
}

const createEventResourceTemplate = (srv,packageNameReg,namespace) => {
    const ordExtent = createORDExtensionsObj(cds.model.definitions[srv]);
    let eventResourceObj = {
        ordId: `${packageNameReg}:eventResource:${namespace}.${srv}:v1`,
        title: ordExtent.title ?? `"ODM Incident Management Events"`,
        shortDescription: "Example ODM Incident Management Event",
        description: "This is an example event catalog that contains only a partial ODM Incident Management V1 event",
        version: "1.0.0",
        releaseStatus: "beta",
        partOfPackage: `${packageNameReg}:package:${"incidents-mgmt"}:v1`,
        visibility: "public",
        resourceDefinitions: [
            {
                type: "asyncapi-v2",
                mediaType: "application/json",
                url: `/.well-known/open-resource-discovery/${"incidentManagement"}/v1/api-metadata/${cds.model.definitions[srv]._service.name}.asyncapi2.json`,
                accessStrategies: [
                    {
                        type: "open",
                    },
                ],
            },
        ],
        extensible: {
            supported: "no",
        },
    };
    // fill in the ORD doc if annotations are present
    // let ordExtent = createORDExtensionsObj(cds.model.definitions[srv]);
    // for (const [key, value] of Object.entries(ordExtent)) {
    //     if (eventResourceObj[key]) eventResourceObj[key] = value;
    // }

    return eventResourceObj;
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

function getPresets(envConf, presetMapping, ordRoot) {
    for (const [key, value] of Object.entries(envConf)) {
        if (presetMapping[key]) ordRoot[presetMapping[key]] = value;
    }
}

function getORD(ordRoot) {
    let allEntites = [];
    let srvList = [];
    let eventsList = [];
    let apiResources = [];
    let eventResources = [];
    let entityTypes = [];
    let packageNameReg = "sap.capordpoc";
    let namespace = cds.model.namespace;
    let appName = "sampleApp";
    let baseID;
    let envConfig;

    //Reading package.json
    let filePathPjson = path.resolve(process.cwd(), "package.json");
    if (fs.existsSync(filePathPjson)) {
        const package_json = JSON.parse(fs.readFileSync(filePathPjson, "utf8"));
        if (package_json.description) {
            ordRoot.description = package_json.description;
            appName = package_json.description;
        }
    }

    // Reading ORD root level preset
    if (cds.env["ord"] && Object.keys(cds.env["ord"]).length !== 0) {
        envConfig = cds.env["ord"];
        let baseID = envConfig.packageORD_ID;
        const presetMapping = {
            "ORD.description": "description",
            policyLevel: "policyLevel",
            packages: "packages",
            products: "products",
            consumptionBundles: "consumptionBundles",
            apiResources: "apiResources",
            eventResources: "eventResources",
        };

        getPresets(envConfig, presetMapping, ordRoot);
    }

    // Getting the services defined in the application
    for (let srv of cds.services) {
        if (srv.definition && srv.definition.kind === "service") {
            srvList.push(srv.definition.name);
        }
    }
    // Getting the entities present in application
    allEntites.push(
        Object.keys(cds.model.definitions).filter(
            (key) => cds.model.definitions[key].kind === "entity"
        )
    );
    allEntites = allEntites[0].filter((key) => key.includes(namespace));
    allEntites = allEntites.filter((key) => !key.includes(".texts"));

    //Getting the events present in the application
    eventsList = Object.keys(cds.model.definitions).filter(
        (key) => cds.model.definitions[key].kind === "event"
    );
    // eventsList.push(Object.keys(cds.model.definitions).filter(key => cds.model.definitions[key].kind === "event"));

    // Constructing the apiResource array for every service
    for (let srv of srvList) {
        const apiResource = createAPIResourceTemplate(
            srv,
            packageNameReg,
            allEntites,
            namespace
        );
        apiResources.push(apiResource);
    }

    //Constructing the eventResource array for every event
    for (let srv of eventsList) {
        const eventResourceTemplate = createEventResourceTemplate(
            srv,
            packageNameReg,
            eventsList,
            namespace
        );
        eventResources.push(eventResourceTemplate);
    }


    // for (let srv of allEntites) {
    //     const entityTypesTemplate = createEntityTypeTemplate(srv, packageNameReg);
    //     entityTypes.push(entityTypesTemplate);
    // }

    //Replacing the computed values to the hard-coded values
    ordRoot.apiResources = apiResources;
    ordRoot.eventResources = eventResources;
    ordRoot.entityTypes = entityTypes;
    if (baseID) {
        let ordString = JSON.stringify(ordRoot);
        ordString = ordString.replace(new RegExp("sap.capordpoc", "g"), baseID);
        ordRoot = JSON.parse(ordString);
    }

    return ordRoot;
}

function baseTemplate() {
    return {
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
    };
}

async function getMetaData(data, res) {
    if (data === "/") {
        res.status(200).send(baseTemplate());
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
        return res
            .status(200)
            .contentType(compilerFunction[compilerType].contentType)
            .send(responseFile);
    }
}

const fGetORDVersion = () => { 
    return "1.6";
}

function fGetDescription() {
    const fGetPackageJsonPath = path.resolve(process.cwd(), "package.json");
    return (
        (fs.existsSync(fGetPackageJsonPath) && JSON.parse(fs.readFileSync(fGetPackageJsonPath, "utf8")).description) 
        || "This is an example ORD document for Incident Management Application."
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
        .map((srv) => createAPIResourceTemplate(srv.definition.name, packageNameReg, oEntityTypeTargets, namespace));

    return fGetPresets("apiResources", undefined) ?? oApiResources;
}

const fGetEventResources = () => {
    const packageNameReg = "sap.capordpoc";
    const namespace = cds.model.namespace;
    const eventResources = Object.keys(cds.model.definitions)
                             .filter((key) => cds.model.definitions[key].kind === "event")
                             .map((srv) => createEventResourceTemplate(srv, packageNameReg, namespace));
    return eventResources
}

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
    packages : [
        {
            ordId: "sap.capordpoc:package:incidents-mgmt:v1",
            title:
                "sample Incident Management Application Open Resource Discovery Reference Application",
            shortDescription: " here is the shortDescription for packages Array",
            description: " here is the description for packages Array",
            version: "1.0.0",
            partOfProducts: ["sap:product:CapOrdPoC:"],
            vendor: "sap:vendor:SAP:",
        },
    ] , 
    consumptionBundles : [
        {
            ordId: "sap.capordpoc:consumptionBundle:noAuth:v1",
            version: "1.0.0",
            title: "Unprotected resources",
            shortDescription:
                "If we have another protected API then it will be another object",
            description:
                "This Consumption Bundle contains all resources of the reference app which are unprotected and do not require authentication",
        },
    ]

}

function ORD() {
    try {
        const data = cds.env["ord"].application_namespace;
        if (data === undefined) {
            console.log("not found ");
        }
        const oReturn = {
            openResourceDiscovery: fGetORDVersion(),
            policyLevel: fGetPresets("policyLevel", _.policyLevel),
            description: fGetDescription(),
            products: fGetPresets("products", _.products),
            packages: fGetPresets("packages", _.packages),
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
            const filePath = path.resolve("../data/ordV1.json");
            const ordRoot = fs.readFileSync(filePath, "utf-8");
            let finalORD = getORD(JSON.parse(ordRoot));
            //fs.writeFileSync('./ordGenerated.json', JSON.stringify(finalORD), 'utf8')
            let data = ORD();
            // return res.status(200).send({ finalORD, data });
            return res.status(200).send(data);
        } catch (error) {
            console.log(error);
        }
    });
});
module.exports = cds_dk.server;
