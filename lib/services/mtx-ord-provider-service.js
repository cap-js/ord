const cds = require("@sap/cds/lib");
const { ord, getMetadata } = require("@cap-js/ord/lib");

module.exports = class MtxOrdProviderService extends cds.ApplicationService {
    init() {
        this.on("getOrdDocument", async (req) => {
            req._?.res?.set("Content-Type", "application/json");

            return ord(
                await (
                    await cds.connect.to("cds.xt.ModelProviderService")
                ).getCsn({
                    for: req.data.for,
                    tenant: req.data.tenant,
                    toggles: req.data.toggles,
                }),
            );
        });

        this.on("getOrdResourceDefinition", async (req) => {
            const { response, contentType } = await getMetadata(
                req.data.resource,
                await (
                    await cds.connect.to("cds.xt.ModelProviderService")
                ).getCsn({
                    for: req.data.for,
                    tenant: req.data.tenant,
                    toggles: req.data.toggles,
                }),
            );

            req._?.res?.set("Content-Type", contentType);

            return response;
        });

        return super.init();
    }
};
