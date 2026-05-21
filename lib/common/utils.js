const {
    DATA_PRODUCT_ANNOTATION,
    DATA_PRODUCT_TYPE,
    DATA_PRODUCT_SIMPLE_ANNOTATION,
    ORD_EXTENSIONS_PREFIX,
} = require("../constants");
const _ = require("lodash");

function getRFC3339Date() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const hours = String(now.getUTCHours()).padStart(2, "0");
    const minutes = String(now.getUTCMinutes()).padStart(2, "0");
    const seconds = String(now.getUTCSeconds()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+01:00`;
}

function isPrimaryDataProductService(service) {
    return service[DATA_PRODUCT_ANNOTATION] === DATA_PRODUCT_TYPE.primary || !!service[DATA_PRODUCT_SIMPLE_ANNOTATION];
}

function flattenEntityGraph(current, processed = []) {
    return [
        current, //
        ...Object.values(current.associations ?? []) //
            .filter(({ target }) => !processed.includes(target))
            .flatMap(({ target, _target }) => {
                processed.push(target);
                return flattenEntityGraph(_target, processed);
            }),
    ];
}

function readORDExtensions(model, prefix = ORD_EXTENSIONS_PREFIX) {
    return Object.entries(model) //
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => [key.substring(prefix.length), value])
        .reduce((result, [key, value]) => _.set(result, key, value), {});
}

module.exports = {
    getRFC3339Date,
    readORDExtensions,
    flattenEntityGraph,
    isPrimaryDataProductService,
};
