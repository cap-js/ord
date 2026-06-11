const fs = require("fs");
const cds = require("@sap/cds");
const { join } = require("path");

const { slice } = require("./common/slice");
const { DOCUMENT_PERSPECTIVES } = require("./constants");
const { resolveAccessStrategies } = require("./common/utils");

const sizeLimit = 2000000; // 2mb

/**
 * Module containing default configuration for ORD Document.
 * @module defaults
 */
module.exports = {
    $schema: "https://open-resource-discovery.github.io/specification/spec-v1/interfaces/Document.schema.json",
    openResourceDiscovery: "1.16",
    policyLevels: ["none"],
    groupTypeId: "sap.cds:service",
    description: "this is an application description",
    sizeLimit: sizeLimit,
    baseTemplate: (authConfig, document, tenantDocument) => {
        const accessStrategies = resolveAccessStrategies(authConfig);

        return {
            openResourceDiscoveryV1: {
                documents: [
                    ...Array(slice(document, sizeLimit).length)
                        .fill(0)
                        .map((_, i) => {
                            return {
                                url: `/ord/v1/documents/ord-document?part=${i}`,
                                perspective: DOCUMENT_PERSPECTIVES.SystemVersion,
                                accessStrategies,
                            };
                        }),
                    ...(!tenantDocument
                        ? []
                        : Array(slice(tenantDocument, sizeLimit).length)
                              .fill(0)
                              .map((_, i) => {
                                  return {
                                      url: `/ord/v1/documents/ord-document?part=${i}&perspective=${encodeURIComponent(DOCUMENT_PERSPECTIVES.SystemInstance)}`,
                                      perspective: DOCUMENT_PERSPECTIVES.SystemInstance,
                                      accessStrategies,
                                  };
                              })),
                ],
            },
        };
    },
    adjustForPerspective: (document, perspective) => {
        document.perspective = perspective;

        if (perspective === DOCUMENT_PERSPECTIVES.SystemVersion) {
            document.describedSystemVersion = cds.env["ord"]?.describedSystemVersion ?? {
                version: JSON.parse(fs.readFileSync(join(cds.root, "package.json"), "utf-8")).version,
            };
        } else if (perspective === DOCUMENT_PERSPECTIVES.SystemInstance) {
            (document.apiResources || []).forEach((apiResource) => {
                (apiResource.resourceDefinitions || []).forEach((apiResourceDefinition) => {
                    apiResourceDefinition.url += `?perspective=${encodeURIComponent(perspective)}`;
                });
            });

            (document.eventResources || []).forEach((eventResource) => {
                (eventResource.resourceDefinitions || []).forEach((eventResourceDefinition) => {
                    eventResourceDefinition.url += `?perspective=${encodeURIComponent(perspective)}`;
                });
            });
        }

        return document;
    },
};
