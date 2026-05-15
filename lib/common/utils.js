const { DATA_PRODUCT_ANNOTATION, DATA_PRODUCT_TYPE, DATA_PRODUCT_SIMPLE_ANNOTATION } = require("../constants");

module.exports = {
    isPrimaryDataProductService: (srvDefinition) => {
        return (
            srvDefinition[DATA_PRODUCT_ANNOTATION] === DATA_PRODUCT_TYPE.primary ||
            !!srvDefinition[DATA_PRODUCT_SIMPLE_ANNOTATION]
        );
    },
    getRFC3339Date: () => {
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, "0");
        const day = String(now.getUTCDate()).padStart(2, "0");
        const hours = String(now.getUTCHours()).padStart(2, "0");
        const minutes = String(now.getUTCMinutes()).padStart(2, "0");
        const seconds = String(now.getUTCSeconds()).padStart(2, "0");
        const offsetHours = "01";
        const offsetMinutes = "00";
        const offsetSign = "+";
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetSign}${offsetHours}:${offsetMinutes}`;
    },
};
