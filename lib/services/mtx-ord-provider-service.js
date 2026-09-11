const cds = require("@sap/cds/lib");
const { ord, getMetadata } = require("@cap-js/ord/lib");

const defaults = require("../defaults");
const { DOCUMENT_PERSPECTIVES } = require("../constants");
const { getCustomORDContent } = require("../extend-ord-with-custom");

module.exports = class MtxOrdProviderService extends cds.ApplicationService {
    init() {
        this.on("getOrdDocument", async (req) => {
            req._?.res?.set("Content-Type", "application/json");

            return defaults.adjustForPerspective(
                ord(
                    await (
                        await cds.connect.to("cds.xt.ModelProviderService")
                    ).getCsn({
                        tenant: req.data.tenant,
                        toggles: req.data.toggles,
                    }),
                    [getCustomORDContent(cds?.env?.["ord"]?.customOrdContentFile)],
                ),
                DOCUMENT_PERSPECTIVES.SystemInstance,
            );
        });

        this.on("getOrdResourceDefinition", async (req) => {
            const { response, contentType } = await getMetadata(
                req.data.resource,
                await (
                    await cds.connect.to("cds.xt.ModelProviderService")
                ).getCsn({
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
