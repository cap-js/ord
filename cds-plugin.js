const cds = require("@sap/cds");
const { fs, path } = cds.utils
const { getAuthConfig } = require("./lib/authentication");

// load auth config before any service is started
cds.on("bootstrap", async () => {
    getAuthConfig();
});

function _lazyRegisterCompileTarget() {
    const ord = require("./lib/index").ord;
    Object.defineProperty(this, "ord", { ord });
    return ord;
}

const registerORDCompileTarget = () => {
    Object.defineProperty(cds.compile.to, "ord", {
        get: _lazyRegisterCompileTarget,
        configurable: true,
    });
};

registerORDCompileTarget();

let ordPromise = import('./lib/es-module.mjs').then((esModule) => esModule.ord);
let getMetadataPromise = import('./lib/es-module.mjs').then((esModule) => esModule.getMetadata);
cds.build?.register?.('ord', class OrdBuildPlugin extends cds.build.Plugin {

    static taskDefaults = { src: cds.env.folders.srv }

    //static hasTask() { return cds.requires.db?.kind === 'postgres' }

    init() {
        // different from the default build output structure
        this.task.dest = path.join(cds.root, '_ord_gen')
    }

    async build() {
        const model = await this.model();
        const ord = await ordPromise;
        const getMetadata = await getMetadataPromise;
        const ordDocument = ord(model);

        const promises = []
        promises.push(
            this.write(ordDocument).to('ord-document.json')
        )

        for (const apiResource of ordDocument.apiResources) {
            // skip apiResources that are not extensible?
            // if (apiResource.extensible?.supported === 'yes')

            if (apiResource.ordId.includes('OpenResourceDiscoveryService') || !apiResource.resourceDefinitions) {
                continue;
            }

            const subDir = path.join(this.task.dest, apiResource.ordId)

            for (const resourceDefinition of apiResource.resourceDefinitions) {
                const url = resourceDefinition.url;
                const fileName = url.split('/').pop();
                const { _, response } = await getMetadata(url, model);
                promises.push(
                    this.write(response).to(path.join(subDir, fileName))
                )
            }
        }

        return Promise.all(promises)
    }
})