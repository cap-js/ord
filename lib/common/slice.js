const defaults = require("../defaults");

const ordMainPartKeys = Object.freeze([
    "$schema",
    "description",
    "perspective",
    "policyLevel",
    "policyLevels",
    "customPolicyLevel",
    "describedSystemType",
    "openResourceDiscovery",
    "describedSystemVersion",
    "describedSystemInstance",
]);

function getFileSizeInBytes(document) {
    return Buffer.byteLength(JSON.stringify(document), "utf8");
}

function split(document, limit = defaults.sizeLimit, chunk = 100) {
    if (getFileSizeInBytes(document) < limit) {
        return [document];
    }

    const slices = [];
    const ord = Object.fromEntries(
        ordMainPartKeys
            .filter((key) => key in document) //
            .map((key) => [key, document[key]]),
    );

    let slice = {};
    let sliceSize = 0;
    const ordSize = getFileSizeInBytes(ord);

    Object.keys(document)
        .filter((key) => !ordMainPartKeys.includes(key))
        .forEach((key) => {
            let start = 0;

            for (let i = 0; i < document[key].length; i += chunk) {
                const remaining = limit - ordSize - sliceSize;
                const additional = getFileSizeInBytes({
                    [key]: document[key].slice(start, i + chunk),
                });

                if (remaining < additional) {
                    slices.push(Object.assign(slice, { [key]: document[key].slice(start, i) }));

                    // prepare for the next slice
                    start = i;
                    slice = {};
                    sliceSize = 0;
                }
            }

            slice = Object.assign(slice, { [key]: document[key].slice(start) });
            sliceSize = getFileSizeInBytes(slice);
        });

    slices.push(Object.assign(slice, ord));

    return slices;
}

module.exports = {
    split,
};
