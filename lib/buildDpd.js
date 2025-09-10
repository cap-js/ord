const cds = require("@sap/cds");
const cds_dk = require("@sap/cds-dk");
const path = require("path");
const { generateDataProductFiles, isDpdGenerationEnabled, validateDpd, DPD_BUILD_DEFAULT_PATH } = require("./dataProducts/dpd");
const { Logger } = require("./logger");

module.exports = class DpdBuildPlugin extends cds_dk.build.Plugin {
    static taskDefaults = { src: cds.env.folders.srv };

    init() {
        const outputPath = cds.env.dpd?.dataProducts?.outputPath ||
                          cds.env.dpd?.outputPath ||
                          DPD_BUILD_DEFAULT_PATH;
        this.task.dest = path.join(cds.root, outputPath);
    }

    async build() {
        Logger.info("Starting DPD generation...");

        if (!isDpdGenerationEnabled()) {
            Logger.info("DPD generation is disabled. Enable it by setting cds.dpd.dataProducts.enabled=true in .cdsrc.json");
            return [];
        }

        try {
            const model = await this.model();

            const appConfig = this.initializeAppConfig(model);

            const dataProductFiles = await generateDataProductFiles(model, appConfig);

            if (dataProductFiles.length === 0) {
                Logger.info("No data product annotations found. No data product files generated.");
                return [];
            }

            Logger.info(`Generated ${dataProductFiles.length} data product file(s)`);

            const promises = await this.writeDataProductFiles(dataProductFiles);

            Logger.info(`Data product generation completed. Generated ${dataProductFiles.length} files.`);
            return promises;
        } catch (error) {
            Logger.error(`DPD generation failed: ${error.message}`);
            throw error;
        }
    }

    async writeDataProductFiles(dataProductFiles) {
        const promises = [];
        for (const file of dataProductFiles) {
            Logger.info(`Writing data product file: ${file.path}`);
            promises.push(
                this.write(file.content)
                    .to(file.path)
                    .then(() => {
                        Logger.info(`Successfully wrote: ${file.path}`);
                    })
                    .catch(err => {
                        Logger.error(`Failed to write ${file.path}: ${err.message}`);
                    })
            );
        }
        
        await Promise.all(promises);
        return promises;
    }

    initializeAppConfig(csn) {
        const packageJson = this.loadPackageJson();
        const packageName = packageJson.name;
        const appName = this.formatAppName(packageName);
        const ordNamespace = this.getNamespace(packageName);

        return {
            env: cds.env["dpd"] || cds.env["ord"],
            appName,
            ordNamespace,
            packageName
        };
    }

    loadPackageJson() {
        const packageJsonPath = path.join(cds.root, "package.json");
        if (!cds.utils.exists(packageJsonPath)) {
            throw new Error("package.json not found in the project root directory");
        }
        return require(packageJsonPath);
    }

    formatAppName(packageName) {
        return packageName.replace(/^[@]/, "").replace(/[@/]/g, "-");
    }

    getNamespace(packageName) {
        const vendorNamespace = "customer";
        const envNamespace = cds.env["dpd"]?.namespace || cds.env["ord"]?.namespace;
        return envNamespace || `${vendorNamespace}.${packageName.replace(/[^a-zA-Z0-9]/g, "")}`;
    }
};
