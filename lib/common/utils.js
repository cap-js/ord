const { DATA_PRODUCT_ANNOTATION, DATA_PRODUCT_TYPE, DATA_PRODUCT_SIMPLE_ANNOTATION } = require("../constants");

module.exports = {
    isPrimaryDataProductService: (srvDefinition) => {
        return (
            srvDefinition[DATA_PRODUCT_ANNOTATION] === DATA_PRODUCT_TYPE.primary ||
            !!srvDefinition[DATA_PRODUCT_SIMPLE_ANNOTATION]
        );
    },
};
