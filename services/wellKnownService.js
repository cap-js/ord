const { defaults, getMetadata } = require("../lib"); // Adjust paths as needed
const { Logger } = require("../lib/logger");
const cds = require("@sap/cds");

cds.on("served", async() => {
    for (let srv of cds.services) {
        if (srv.name === "wellKnownService") {
            console.log("served wellknown service");
            console.log(srv.name);
            srv.on("READ", "*", async (req) => {
                if (req?.req?.url === "/.well-known/open-resource-discovery") {
                    if (req._.req.url === "/") {
                        return [
                            {
                                id: "base-template-id",
                                contentType: "application/json",
                                response: JSON.stringify(defaults.baseTemplate),
                            },
                        ];
                    } else {
                        try {
                            const { contentType, response } = await getMetadata(
                                req._.req.url
                            );
                            return [
                                {
                                    id: "metadata-id",
                                    contentType,
                                    response,
                                },
                            ];
                        } catch (error) {
                            Logger.error(
                                error,
                                "Error while generating metadata"
                            );
                            req.error(500, "Failed to generate metadata");
                        }
                    }
                }
            });
        }
    }
});
