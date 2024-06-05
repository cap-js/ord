const cds = require("@sap/cds");
const path = require("path");
const { compile: openapi } = require("@cap-js/openapi");
const { compile: asyncapi } = require("@cap-js/asyncapi");

module.exports = class ORDBuildPlugin extends cds.build.BuildPlugin {

  static taskDefaults = {
    src: ".", nodeDest: "srv/srv", javaDest: "srv/src/main/resources"
  };

  async init() {
    const model = await cds.load(this.task.src + "/srv");
    const serviceNames = cds.reflect(model).services.map((service) => service.name);

    if (serviceNames.length > 0) {
      for (const serviceName of serviceNames) {
        const srvDefinition = model.definitions[serviceName];
        const options = { service: serviceName, as: "str", messages: [] };

        // Generate OpenAPI if the service has entities or actions
        if (Object.keys(srvDefinition.entities).length > 0 ||
          Object.keys(srvDefinition.actions).length > 0) {
          const result = openapi(model, options);
          await this._writeResult(result, serviceName, ".openapi.json");
        }

        // Generate AsyncAPI if the service has events
        if (Object.keys(srvDefinition.events).length > 0) {
          const result = asyncapi(model, options);
          await this._writeResult(result, serviceName, ".json");
        }
      }
    }
  }

  async _writeResult(content, serviceName, type) {
    const fileName = serviceName + type;
    const destPath = cds.env["project-nature"] === "nodejs" ? this.task.nodeDest : this.task.javaDest;
    const folderPath = type === ".json" ? "asyncapi" : "openapi";
    await this.write(content).to(path.join(destPath, folderPath, fileName));
  }
};
