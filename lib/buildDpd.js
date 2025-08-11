const cds = require("@sap/cds");
const cds_dk = require("@sap/cds-dk");
const path = require("path");
const { generateDpdFiles, isDpdGenerationEnabled, DPD_BUILD_DEFAULT_PATH } = require("./dataProducts/dpd");
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
        
        const model = await this.model();
        
        const appConfig = this.initializeAppConfig(model);
        
        const dpdFiles = generateDpdFiles(model, appConfig);
        
        if (dpdFiles.length === 0) {
            Logger.info("No data product annotations found. No DPD files generated.");
            return [];
        }
        
        Logger.info(`Generated ${dpdFiles.length} DPD file(s)`);
        
        return [];
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