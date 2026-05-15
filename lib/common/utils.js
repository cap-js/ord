const {
    DATA_PRODUCT_ANNOTATION,
    DATA_PRODUCT_TYPE,
    DATA_PRODUCT_SIMPLE_ANNOTATION,
    ORD_EXTENSIONS_PREFIX,
} = require("../constants");
const _ = require("lodash");

module.exports = {
    isPrimaryDataProductService: (srvDefinition) => {
        return (
            srvDefinition[DATA_PRODUCT_ANNOTATION] === DATA_PRODUCT_TYPE.primary ||
            !!srvDefinition[DATA_PRODUCT_SIMPLE_ANNOTATION]
        );
    },
    readORDExtensions: (model, prefix = ORD_EXTENSIONS_PREFIX) => {
        return Object.entries(model) //
            .filter(([key]) => key.startsWith(prefix))
            .map(([key, value]) => [key.substring(prefix.length), value])
            .reduce((result, [key, value]) => _.set(result, key, value), {});
    },
    getRFC3339Date: () => {
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, "0");
        const day = String(now.getUTCDate()).padStart(2, "0");
        const hours = String(now.getUTCHours()).padStart(2, "0");
        const minutes = String(now.getUTCMinutes()).padStart(2, "0");
        const seconds = String(now.getUTCSeconds()).padStart(2, "0");

        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+01:00`;
    },
};
